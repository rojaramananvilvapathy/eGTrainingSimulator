# ── Stage 1: Build React Frontend ──────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Backend dependencies ──────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --workspace=backend --ignore-scripts
COPY backend/ ./backend/

# ── Stage 3: Production image ───────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/backend ./backend
COPY --from=frontend-builder /app/frontend/dist ./public
RUN addgroup -g 1001 -S nodejs &&     adduser -S egtraining -u 1001 -G nodejs &&     chown -R egtraining:nodejs /app
USER egtraining
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3   CMD curl -f http://localhost:4000/health || exit 1
CMD ["node", "backend/src/index.js"]
