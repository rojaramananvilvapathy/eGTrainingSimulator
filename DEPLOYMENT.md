# eG Enterprise Simulation Platform — Deployment Guide

## Prerequisites

- Linux server (Ubuntu 22.04 recommended) — minimum 4 vCPU, 8 GB RAM
- Docker Engine 24+ and Docker Compose v2
- Domain name with DNS pointing to server (for SSL)
- PostgreSQL 16 (managed service recommended for production)

---

## 1. Clone and Configure

```bash
git clone https://github.com/your-org/eg-sim-platform.git
cd eg-sim-platform

# Copy environment template
cp backend/.env.example backend/.env
```

Edit `backend/.env` — set all required secrets:

```bash
DB_PASSWORD=<strong_password>
JWT_SECRET=<min_32_char_random_string>
JWT_REFRESH_SECRET=<different_32_char_random_string>
FLAG_SECRET=<another_32_char_random_string>
FRONTEND_URL=https://your-domain.com
```

Generate strong secrets:
```bash
openssl rand -hex 32   # run 3 times for the 3 secrets
```

---

## 2. Build Lab Docker Images

The simulation engine runs learner code in isolated Docker containers. Build the lab images first:

```bash
# Linux lab environment
docker build -f infra/lab-images/Dockerfile.linux-lab \
  -t eg-sim-linux-lab:latest infra/lab-images/

# Verify
docker images | grep eg-sim
```

---

## 3. SSL Certificates

```bash
mkdir -p infra/nginx/certs

# Self-signed (development/internal)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infra/nginx/certs/server.key \
  -out infra/nginx/certs/server.crt \
  -subj "/CN=your-domain.com/O=eG Innovations"

# Production: use Let's Encrypt
# certbot certonly --standalone -d your-domain.com
# cp /etc/letsencrypt/live/your-domain.com/fullchain.pem infra/nginx/certs/server.crt
# cp /etc/letsencrypt/live/your-domain.com/privkey.pem   infra/nginx/certs/server.key
```

---

## 4. Start the Platform

```bash
# Build and start all services
docker compose -f infra/docker-compose.yml --profile production up -d --build

# Run database migrations
docker compose -f infra/docker-compose.yml exec backend npm run migrate

# Check all services are healthy
docker compose -f infra/docker-compose.yml ps
```

Expected output:
```
NAME                STATUS
eg-sim-postgres     running (healthy)
eg-sim-backend      running (healthy)
eg-sim-frontend     running (healthy)
eg-sim-nginx        running
```

---

## 5. Create First Admin User

```bash
# Connect to backend container
docker compose -f infra/docker-compose.yml exec backend node -e "
const db = require('./src/db');
const bcrypt = require('bcryptjs');
async function createAdmin() {
  const hash = await bcrypt.hash('ChangeMe1!', 12);
  await db.query(
    \`INSERT INTO users (username, email, password_hash, role, display_name)
     VALUES ('admin', 'admin@your-org.com', \$1, 'superadmin', 'Platform Admin')\`,
    [hash]
  );
  console.log('Admin created');
  process.exit(0);
}
createAdmin().catch(console.error);
"
```

---

## 6. Import Lab Rooms

```bash
# Import all YAML rooms from scenario-engine/rooms/
docker compose -f infra/docker-compose.yml exec backend node -e "
const fs   = require('fs');
const path = require('path');
const db   = require('./src/db');
const { loadRoom } = require('../../scenario-engine/engine/parser');

// Get admin user ID first, then import rooms
// (see Admin Guide for UI-based import)
console.log('Use Admin UI to import and publish rooms.');
process.exit(0);
"
```

Or use the Admin UI: Login → Admin → Rooms → use the YAML import or Screenshot → Lab tools.

---

## 7. Post-Deployment Verification

```bash
# Health check
curl https://your-domain.com/api/health

# Expected: {"status":"ok","ts":"..."}

# Check active containers
curl -H "Authorization: Bearer <admin_token>" \
  https://your-domain.com/api/containers/admin/all
```

---

## Performance Targets (Phase 9)

| Metric | Target | How to verify |
|--------|--------|---------------|
| Container cold-start | < 10 seconds | `time docker run --rm eg-sim-linux-lab:latest echo ok` |
| API response (P95) | < 200ms | Check Nginx access logs |
| Terminal latency | < 200ms | Subjective — type in terminal and observe |
| DB query (P95) | < 50ms | Enable `LOG_LEVEL=debug` and check query timings |

If container cold-start exceeds 10s:
```bash
# Pre-pull lab images to warm the Docker image cache
docker pull eg-sim-linux-lab:latest
docker pull eg-sim-windows-sim:latest
```

---

## Monitoring

```bash
# View live backend logs
docker compose -f infra/docker-compose.yml logs -f backend

# View active lab containers
docker ps --filter label=eg-sim=true

# Cleanup timed-out containers manually
docker compose -f infra/docker-compose.yml exec backend node -e "
require('./src/services/containerService').cleanupTimedOutContainers()
  .then(() => { console.log('Cleanup done'); process.exit(0); });
"
```

---

## Backup

```bash
# Backup PostgreSQL
docker compose -f infra/docker-compose.yml exec postgres \
  pg_dump -U eg_sim_user eg_sim_platform | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20240115.sql.gz | docker compose exec -T postgres \
  psql -U eg_sim_user eg_sim_platform
```

---

## Updating the Platform

```bash
git pull origin main
docker compose -f infra/docker-compose.yml up -d --build backend frontend
docker compose -f infra/docker-compose.yml exec backend npm run migrate
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend can't connect to DB | Check `DB_HOST=postgres` (Docker service name) in .env |
| Containers fail to start | Verify Docker socket is mounted: `-v /var/run/docker.sock:/var/run/docker.sock` |
| WebSocket disconnects | Check Nginx proxy_read_timeout (should be 3600s for terminal sessions) |
| SSL cert errors | Verify cert files exist at `infra/nginx/certs/server.crt` and `server.key` |
| Flag always incorrect | Check `FLAG_SECRET` is the same across all backend instances |
