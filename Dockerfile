# =============================================================================
# Stage 1: Build Frontend (Vite + React) & Backend (TypeScript + Hono)
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json vite.config.ts index.html ./
COPY src ./src

RUN npm run build

# =============================================================================
# Stage 2: Production Runner (Render Container)
# =============================================================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY sql ./sql

# Create ephemeral runtime cache directory (.cache) owned by node user
# Note: No local escala.csv is bundled; it is pulled from Supabase Storage on startup.
RUN mkdir -p /app/.cache && chown -R node:node /app

USER node

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/healthz || exit 1

CMD ["node", "dist/server/index.js"]

