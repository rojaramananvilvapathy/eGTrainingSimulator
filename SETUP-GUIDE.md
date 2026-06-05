# eGTrainingSimulator — CI/CD Setup Guide

## Overview

This package gives you a **fully automated CI/CD pipeline**:
- Every push to `main` → auto-deploy to DigitalOcean
- Droplet is created automatically if it doesn't exist
- Destroy droplet manually (via GitHub Actions) when not in use → zero billing
- Recreate and redeploy on-demand

---

## Architecture

```
GitHub push to main
       ↓
GitHub Actions
  ├── Job 1: Build Docker image & test
  ├── Job 2: Create DigitalOcean droplet (if missing)
  ├── Job 3: Deploy via SSH + health check
  └── (Manual) Job 4: Destroy droplet to save cost
```

**Monthly cost (BLR1, s-2vcpu-4gb-amd): ~$24/month if always-on**
**Your cost with destroy-when-idle: Pay only for hours used (~$0.036/hr)**

---

## Step 1 — Files to Add to Your GitHub Repo

Copy these files into your `eGTrainingSimulator` repository:

```
eGTrainingSimulator/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← CI/CD pipeline
├── Dockerfile                  ← Multi-stage Docker build
├── docker-compose.prod.yml     ← Production containers
├── nginx.conf                  ← Reverse proxy config
├── do-manage.sh                ← Local DO management script
└── health-check.sh             ← Post-deploy smoke tests
```

---

## Step 2 — Adjust Dockerfile Paths

Open `Dockerfile` and verify these match your repo:

| Line | What to check |
|------|---------------|
| `COPY frontend/package*.json` | Is your React app in `frontend/`? Change if different |
| `COPY --from=backend-builder /app/src` | Is your backend code in `src/`? |
| `COPY --from=backend-builder /app/server.js` | Is your entry point `server.js`? |
| `COPY --from=frontend-builder /app/frontend/build ./public` | Where does React build go? |

---

## Step 3 — Add GitHub Secrets

Go to: **GitHub → eGTrainingSimulator → Settings → Secrets and variables → Actions**

Add these secrets:

| Secret Name | How to get it |
|---|---|
| `DO_API_TOKEN` | DigitalOcean → API → Generate New Token (read+write) |
| `DO_SSH_KEY_FINGERPRINT` | Run: `doctl compute ssh-key list` → copy Fingerprint column |
| `DO_SSH_PRIVATE_KEY` | Run: `cat ~/.ssh/id_rsa` → paste the entire private key |

### Generate DigitalOcean API Token
1. Login to cloud.digitalocean.com
2. Go to **API → Tokens**
3. Click **Generate New Token**
4. Name: `egtraining-github-actions`
5. Scope: **Read + Write**
6. Copy the token → paste as `DO_API_TOKEN` secret

### Get SSH Key Fingerprint
```bash
# Install doctl first
brew install doctl                    # macOS
# OR: snap install doctl              # Ubuntu

# Authenticate
doctl auth init                       # paste your DO_API_TOKEN

# List SSH keys in your DO account
doctl compute ssh-key list
# Copy the Fingerprint (e.g., ab:12:cd:34:...)
```

If you don't have an SSH key in DigitalOcean yet:
```bash
# Generate key pair
ssh-keygen -t ed25519 -C "egtraining-deploy"

# Add public key to DigitalOcean
doctl compute ssh-key import egtraining-key --public-key-file ~/.ssh/id_ed25519.pub

# Then get the fingerprint
doctl compute ssh-key list
```

---

## Step 4 — Add /health Endpoint to Your Backend

Make sure your `server.js` (or `app.js`) has this route:

```javascript
// Health check endpoint (required for CI/CD checks)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

---

## Step 5 — Add .dockerignore

Create `.dockerignore` in your repo root to keep Docker images small:

```
node_modules
frontend/node_modules
.git
.github
*.md
.env
.env.*
npm-debug.log
```

---

## Step 6 — Trigger First Deployment

```bash
# Push the CI/CD files to main
git add .github/ Dockerfile docker-compose.prod.yml nginx.conf
git commit -m "feat: add CI/CD pipeline and Docker config"
git push origin main
```

Then watch it run at:
**GitHub → Actions tab → 🚀 eGTraining CI/CD Pipeline**

---

## Step 7 — Managing the Droplet (Cost Saving)

### Destroy droplet (stop billing)
- Go to **GitHub → Actions → Run workflow**
- Select action: **destroy**
- Click **Run workflow**
- ✅ Droplet deleted, billing stops immediately

### Redeploy from scratch
- Go to **GitHub → Actions → Run workflow**
- Select action: **create-and-deploy**
- OR just push any commit to main

### Using local script
```bash
chmod +x do-manage.sh
export DO_SSH_KEY_FINGERPRINT="your:fingerprint:here"

./do-manage.sh status    # Check if droplet exists
./do-manage.sh create    # Create new droplet
./do-manage.sh destroy   # Destroy droplet
./do-manage.sh ip        # Get current IP
```

### Run health checks locally
```bash
chmod +x health-check.sh
./health-check.sh <DROPLET_IP> 3000
```

---

## Troubleshooting

### Build fails: "Cannot find frontend/"
→ Your React app folder name differs. Update `Dockerfile` line:
```dockerfile
COPY your-folder-name/package*.json ./
```

### Deploy fails: "Permission denied (publickey)"
→ Check `DO_SSH_PRIVATE_KEY` secret — paste the full key including `-----BEGIN-----` and `-----END-----`

### Health check fails after deploy
→ SSH into the droplet and check logs:
```bash
ssh root@<DROPLET_IP>
docker logs egtraining-backend --tail 50
docker ps -a
```

### App not accessible on port 80
→ Check DigitalOcean firewall:
```bash
doctl compute firewall list
# Add rule to allow port 80 and 3000 from all IPs
```

---

## Cost Summary

| Scenario | Monthly Cost |
|---|---|
| Always-on (2vCPU/4GB/BLR1) | ~$24/month |
| Destroy after work (8hrs/day) | ~$8/month |
| Destroy when not needed | Pay per hour (~₹3/hr) |

**Recommendation**: Use GitHub Actions "destroy" workflow after each training session, and "Run workflow → deploy" to bring it back up.
