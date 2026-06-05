# ─────────────────────────────────────────────────
# Stage 1: Build React Frontend
# ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
# ADJUST PATH if your frontend folder is named differently
COPY frontend/package*.json ./
RUN npm ci --only=production=false

COPY frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────
# Stage 2: Build Backend
# ─────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# ─────────────────────────────────────────────────
# Stage 3: Production Image
# ─────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy backend (production deps only)
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/src ./src
COPY --from=backend-builder /app/server.js ./server.js
COPY --from=backend-builder /app/package.json ./package.json

# Copy built React frontend into backend's public folder
# ADJUST 'public' if your static serve path is different
COPY --from=frontend-builder /app/frontend/build ./public

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S egtraining -u 1001 -G nodejs && \
    chown -R egtraining:nodejs /app

USER egtraining

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
