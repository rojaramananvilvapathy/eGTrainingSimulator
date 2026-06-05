# eG Enterprise Simulation Platform

A **TryHackMe-style gamified learning platform** for mastering eG Enterprise —
covering installation, prerequisites, configuration, and troubleshooting via
real-time terminal and GUI simulations with flag capture.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, xterm.js, Zustand |
| Backend API | Node.js 20, Express 4, Socket.IO |
| Database | PostgreSQL 16 |
| Simulation Engine | Docker (per-user sandboxed containers) |
| Terminal Protocol | WebSocket via Socket.IO `/terminal` namespace |
| Auth | JWT (access + refresh token rotation) |
| CI/CD | GitHub Actions |
| Reverse Proxy | Nginx |

---

## Monorepo Structure

```
eg-sim-platform/
├── frontend/               React app (Vite)
│   └── src/
│       ├── components/
│       │   ├── terminal/   xterm.js terminal component
│       │   ├── lab/        Lab room UI
│       │   ├── gamification/ XP, badges, leaderboard
│       │   └── common/     Shared UI components
│       ├── pages/          Route-level page components
│       ├── store/          Zustand state stores
│       └── utils/          API client, helpers
├── backend/                Node.js/Express API
│   └── src/
│       ├── routes/         auth, rooms, flags, leaderboard, containers
│       ├── middleware/      JWT auth, rate limiter
│       ├── services/        flagService, containerService, terminalService, tokenService
│       ├── db/             PostgreSQL pool + migrations
│       └── config/         logger
├── scenario-engine/        YAML room definitions + parser/validator
│   ├── rooms/              Lab YAML files (one per lab)
│   └── engine/             parser.js, validator.js
├── infra/                  Docker, Nginx config
│   ├── lab-images/         Dockerfiles for lab environments
│   └── nginx/              Reverse proxy config
└── .github/workflows/      CI/CD pipelines
```

---

## Quick Start (Development)

### 1. Prerequisites

- Node.js ≥ 18, npm ≥ 9
- Docker + Docker Compose
- PostgreSQL 16 (or use Docker Compose)

### 2. Environment setup

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, FLAG_SECRET
```

### 3. Start all services

```bash
# From project root
docker compose -f infra/docker-compose.yml up postgres -d   # Start DB
npm install                                                   # Install all workspaces
npm run db:migrate                                            # Run migrations
npm run dev                                                   # Start backend + frontend
```

Frontend: http://localhost:5173  
Backend API: http://localhost:4000/api  
Health check: http://localhost:4000/health

---

## Adding a New Lab Room

1. Create a YAML file in `scenario-engine/rooms/` following the schema
2. Validate it: `node -e "require('./scenario-engine/engine/parser').loadRoom(require('fs').readFileSync('scenario-engine/rooms/your-room.yaml','utf8'))"`
3. Import it via the admin API: `POST /api/rooms` with the YAML as `yaml_definition`
4. Publish it: `PATCH /api/rooms/:id/publish` with `{ "status": "published" }`

---

## Flag Format

```
eGSIM{<hmac-sha256(userId:roomId:taskId:sessionId, FLAG_SECRET)>}
```

Flags are session-scoped — unique per user per lab session. First capture awards a 50% XP bonus.

---

## Roadmap Phases

| Phase | Focus |
|-------|-------|
| 1 | Foundation (this scaffold) ✅ |
| 2 | Simulation engine (Docker + xterm.js) 🚧 |
| 3 | Prerequisites labs (Linux & Windows) 🚧 |
| 4 | Installation labs |
| 5 | Configuration labs |
| 6 | Troubleshooting labs |
| 7 | Gamification (XP, badges, leaderboard) |
| 8 | Admin & content tools |
| 9 | Launch & polish |

---

## License

Internal use — eG Innovations.
