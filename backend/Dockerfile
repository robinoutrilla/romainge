# ═══════════════════════════════════════════════════════════════
# Dockerfile — RomainGE Backend
# ═══════════════════════════════════════════════════════════════
# Build: docker build -t romainge-backend ./backend
# Run:   docker run -p 3001:3001 --env-file .env romainge-backend

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies only (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY . .

# Generate Prisma client (if using PostgreSQL)
RUN npx prisma generate 2>/dev/null || true

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server.js"]
