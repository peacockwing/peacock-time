Socket server deployment guide

Overview
- Run the Socket.IO server as a separate process (not serverless) so it can maintain WebSocket connections.
- Keep the `SOCKET_SECRET` value secret and shared only between your Next.js API server and the socket server.

Recommended hosts
- Render / Fly / Railway / Heroku / small VPS (DigitalOcean, Linode)
- For low-latency to users, choose a region near your primary user base.

Env variables to set on the socket server host
- `SOCKET_PORT` (optional)
- `SOCKET_SECRET` (required)

Env variables to set on your Next.js app host
- `NEXT_PUBLIC_SOCKET_URL` -> e.g. `https://sockets.example.com`
- `SOCKET_SECRET` -> same secret as socket server (keep private, do not expose in client)

Security
- The socket server exposes a `/broadcast` endpoint that accepts authenticated requests only. It checks `x-socket-secret` and an HMAC signature `x-socket-signature` for payload integrity.
- Do not commit `.env.local` with secrets to your repository.

Vercel note
- Vercel serverless functions cannot act as persistent WebSocket servers. Host the socket server externally and configure `NEXT_PUBLIC_SOCKET_URL` to point to it.

Start commands
- Locally:

```bash
SOCKET_SECRET=your-secret SOCKET_PORT=3001 node server/socket-server.js
```

- On a host, use their environment variable configuration and run `node server/socket-server.js` as a service.

Testing
- Use two browsers connected to your Next.js app; perform an action in one and confirm the other receives the event.

Troubleshooting
- If clients don't receive events, check:
  - socket server logs (connections, joins, broadcast attempts)
  - that `NEXT_PUBLIC_SOCKET_URL` is reachable from clients (CORS, TLS)
  - that API routes are sending the correct `x-socket-secret` and `x-socket-signature`
