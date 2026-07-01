FROM node:20-alpine

WORKDIR /app

# Install dependencies (production)
COPY package*.json ./
# --ignore-scripts: this image doesn't use Prisma, and the root
# postinstall script (`prisma generate`) would fail here since the
# `prisma` CLI is a devDependency omitted by --omit=dev.
# Use `npm ci` when a lockfile exists; otherwise fall back to `npm install`
RUN if [ -f package-lock.json ]; then \
			npm ci --omit=dev --ignore-scripts; \
		else \
			npm install --omit=dev --ignore-scripts; \
		fi

# Install Redis adapter packages for Socket.IO scaling support
RUN npm install @socket.io/redis-adapter redis --no-audit --no-fund --silent

# Copy full repo (server code lives in /server)
COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/socket-server.js"]
