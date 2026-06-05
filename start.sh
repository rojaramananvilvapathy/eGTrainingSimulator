#!/bin/bash

# Clean up any leftover containers from previous session
echo "Cleaning up old lab containers..."
docker ps --filter label=eg-sim=true --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null
docker exec eg-sim-postgres psql -U eg_sim_user -d eg_sim_platform \
  -c "UPDATE lab_containers SET status='stopped', terminated_at=NOW() WHERE status='running';" 2>/dev/null

# Ensure networks exist
docker network create eg-sim-lab-net 2>/dev/null || true
docker network create infra_eg-sim-internal 2>/dev/null || true

echo "Starting platform..."
cd /root/eg-sim-platform
npm run dev
