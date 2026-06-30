const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
// capture raw body for HMAC verification
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
const server = http.createServer(app);

const socketOrigins = (process.env.SOCKET_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: socketOrigins.length > 0
    ? { origin: socketOrigins, methods: ['GET', 'POST'] }
    : { origin: '*' },
});

const SOCKET_SECRET = process.env.SOCKET_SECRET;

const safeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
};

// If REDIS_URL is provided, attempt to configure Redis adapter for scaling
const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');

    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('Socket.IO Redis adapter configured');
      })
      .catch((err) => {
        console.error('Failed to connect Redis for Socket.IO adapter:', err);
      });
  } catch (err) {
    console.warn('Redis adapter packages not installed. To enable scaling, install @socket.io/redis-adapter and redis.');
  }
}

const PORT = process.env.SOCKET_PORT || 3001;

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join', (familyCode) => {
    if (!familyCode || typeof familyCode !== 'string') return;
    socket.join(familyCode);
    console.log(`Socket ${socket.id} joined room ${familyCode}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Socket.IO server listening on port ${PORT}`);
});

// HTTP broadcast endpoint for trusted servers
app.post('/broadcast', (req, res) => {
  const providedSecret = req.headers['x-socket-secret'];
  const providedSig = req.headers['x-socket-signature'];

  const now = new Date().toISOString();
  const requesterIp = req.ip || req.connection?.remoteAddress || 'unknown';

  if (!SOCKET_SECRET) {
    console.warn(`[${now}] /broadcast refused: SOCKET_SECRET not set`);
    return res.status(500).json({ error: 'Socket server misconfigured' });
  }

  if (!providedSecret || !safeCompare(providedSecret, SOCKET_SECRET)) {
    console.warn(`[${now}] /broadcast unauthorized from ${requesterIp} - bad secret`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  if (providedSig) {
    const hmac = crypto.createHmac('sha256', SOCKET_SECRET).update(raw).digest('hex');
    if (!safeCompare(hmac, providedSig)) {
      console.warn(`[${now}] /broadcast signature mismatch from ${requesterIp}`);
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const { action, familyCode, payload } = req.body || {};
  if (!action || !familyCode) {
    console.warn(`[${now}] /broadcast bad request from ${requesterIp} - missing fields`);
    return res.status(400).json({ error: 'Missing action or familyCode' });
  }

  console.log(`[${now}] /broadcast action=${action} family=${familyCode} from=${requesterIp} payloadKeys=${Object.keys(payload || {}).slice(0,10).join(',')}`);

  switch (action) {
    case 'new_log':
      io.to(familyCode).emit('new_log', payload);
      break;
    case 'update_log':
      io.to(familyCode).emit('update_log', payload);
      break;
    case 'delete_log':
      io.to(familyCode).emit('delete_log', payload);
      break;
    case 'tabs_update':
      io.to(familyCode).emit('tabs_update', payload);
      break;
    default:
      console.warn(`[${now}] /broadcast invalid action=${action}`);
      return res.status(400).json({ error: 'Invalid action' });
  }

  return res.json({ success: true });
});
