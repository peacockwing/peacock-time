Production TLS and Redis provisioning

Summary:
- Use `docker-compose.prod.yml` with `nginx` + `certbot` for TLS via Let's Encrypt.
- Provide a `REDIS_URL` (managed Redis or cloud provider) for Socket.IO scaling via `@socket.io/redis-adapter`.

Quick steps (example):
1. DNS: point `yourdomain.example` A/AAAA to your host public IP.
2. Create `.env.production` with:
   - `SOCKET_SECRET=...`
   - `REDIS_URL=redis://:password@redis-host:6379`
   - `DATABASE_URL=postgresql://...` (production Postgres connection string; if using Supabase, use the Supabase Postgres URL)
   - `SUPABASE_DB_URL=postgresql://...` (optional fallback if your deployment provider sets this instead)
   - `SUPABASE_URL=https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key`
   - `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`
3. Boot once without `nginx` TLS to allow certbot http challenge, or run certbot on the host to generate certs.
4. Start production stack:

```bash
SOCKET_SECRET=... REDIS_URL=redis://... docker compose -f docker-compose.prod.yml up -d --build
```

Redis providers:
- Redis Cloud: https://redis.com/
- AWS ElastiCache (Redis)
- Render managed Redis

Security notes:
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Store `SOCKET_SECRET` and `REDIS_URL` as secrets in your GitHub repository or deployment platform.
- Consider placing the socket server behind an internal-only network and terminate TLS at the edge (nginx/load balancer).
