Docker deployment notes

Quick start (local)
1. Copy example env and set a secure secret:

```bash
cp .env.example .env.local
# edit .env.local and set SOCKET_SECRET
node scripts/generate_socket_secret.js # optional -> appends SOCKET_SECRET to .env.local
```

2. Build and run with docker-compose:

```bash
docker compose up --build -d
```
4. Initialize the database schema (only required once after first deployment):

```bash
npm run prisma:dbpush
```
Note: This repository now configures Docker Compose to load `.env` and `.env.local` into containers.
If you use custom shell environment variables instead of `.env.local`, ensure `DATABASE_URL` or `SUPABASE_DB_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SOCKET_SECRET` are defined.

```bash
docker compose up --build -d
```

3. Open the app at http://localhost:3000 and the socket server at port 3001.

Production notes
- Use a managed container host (Render, Fly, DigitalOcean App Platform, etc.) or a VM with Docker.
- Ensure `SOCKET_SECRET` is stored in the host's secret manager and injected into the containers.
- For scaling sockets across multiple instances, use the Socket.IO Redis adapter and run a Redis instance; configure the adapter in `server/socket-server.js`.
 - For scaling sockets across multiple instances, use the Socket.IO Redis adapter and run a Redis instance; configure the adapter in `server/socket-server.js`.
	 - The project docker-compose includes a `redis` service. To enable adapter, set `REDIS_URL=redis://redis:6379` in your environment.
	 - Install required packages in production image: `@socket.io/redis-adapter` and `redis`.
- Use TLS termination (proxy/load balancer) in front of containers; clients should connect to `wss://...`.

Scaling checklist
- Add Redis adapter for Socket.IO to enable pub/sub across instances.
- Use sticky sessions or adapter-based scaling behind load balancer.
- Monitor connections and set resource limits.

Security
- Never expose `SOCKET_SECRET` to the browser. Only set `NEXT_PUBLIC_SOCKET_URL` for clients.
- Keep `SUPABASE_SERVICE_ROLE_KEY` out of client code and secure in the server environment.

