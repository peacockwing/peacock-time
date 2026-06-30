/*
Node script to POST a signed broadcast payload to the socket server `/broadcast` endpoint.
Usage:
  SOCKET_URL=http://localhost:3001 SOCKET_SECRET=... node scripts/test_broadcast.js
*/
const crypto = require('crypto');
const http = require('http');
const https = require('https');

const SOCKET_URL = process.env.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
const SOCKET_SECRET = process.env.SOCKET_SECRET;
if (!SOCKET_SECRET) {
  console.error('Set SOCKET_SECRET env var');
  process.exit(2);
}

const message = {
  action: 'new_log',
  familyCode: 'test-family',
  payload: {
    id: Date.now(),
    family_code: 'test-family',
    category_code: 'sleep',
    category_name_han: '잠듦',
    event_value: 'ok',
    event_date: '20240630',
    event_time: '12:00',
    display_emoji: '😴',
    actor_email: 'test@example.com',
  },
};

const body = JSON.stringify(message);
const sig = crypto.createHmac('sha256', SOCKET_SECRET).update(body).digest('hex');

const url = new URL('/broadcast', SOCKET_URL);
const lib = url.protocol === 'https:' ? https : http;

const opts = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-socket-signature': sig,
    'x-socket-secret': SOCKET_SECRET,
  }
};

const req = lib.request(opts, res => {
  console.log('status', res.statusCode);
  let data = '';
  res.on('data', c => data += c.toString());
  res.on('end', () => console.log('response:', data));
});
req.on('error', e => console.error('request error', e));
req.write(body);
req.end();
