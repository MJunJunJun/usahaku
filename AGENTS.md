# AGENTS.md — Situska (UsahaKu)

SaaS platform for Indonesian UMKM to build AI-generated business websites. UI copy is in Indonesian.

## Architecture

- `backend/` — FastAPI (Python 3.11), single-file `server.py`, Motor async MongoDB, uvicorn on port 8000
- `frontend/` — React 19, CRA + CRACO (not Vite), Tailwind CSS, shadcn/ui (new-york style), React Router v7, port 3000
- `gowa-data/` — WhatsApp gateway state (GoWA, go-whatsapp-web-multidevice)
- Docker Compose runs: redis, mongo, backend, frontend, gowa

## Running

### Docker (recommended for parity with production)
```bash
docker compose up --build        # builds and starts all services
docker compose down              # stop all
```
Frontend at http://localhost:3000. API requests to `/api/*` are proxied to backend automatically.

### Local (Windows)
```bash
start.cmd                        # starts MongoDB service, backend, frontend, GoWA
stop.cmd                         # kills everything
```
Backend runs as: `uvicorn server:app --host 127.0.0.1 --port 8000` (from `backend/` dir).
Logs: `backend.log`, `frontend.log`, `gowa.log`.

### Backend only
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8000
```

### Frontend only
```bash
cd frontend
yarn install                     # or npm install (but yarn.lock is canonical)
npm start                        # runs craco start, dev proxy to :8000
```

## Testing

### Backend (integration tests, requires running services)
```bash
cd backend
# Tests hit the live API — backend + frontend must be running
pytest                           # uses pytest-xdist, 2 workers, loadscope distribution
pytest -n 0                      # serial mode (do NOT use -p no:xdist, it errors)
pytest -k test_name              # single test
```
`conftest.py` expects `REACT_APP_BACKEND_URL` to point at the running frontend (reads from `/app/frontend/.env` in Docker).

### Frontend
```bash
cd frontend
npm test                         # craco test
```

## Key Conventions

- **Auth**: JWT httpOnly cookie + CSRF double-submit cookie. Client reads `csrf_token` cookie and sends as `X-CSRF-Token` header.
- **Backend env**: loaded from `backend/.env`. See `backend/.env.example` for all vars. JWT_SECRET auto-generates to `.runtime/jwt-secret` if unset.
- **Frontend path alias**: `@` → `src/` (configured in craco.config.js).
- **UI components**: shadcn/ui (new-york style), lucide-react icons, Radix primitives.
- **data-testid**: Required on all interactive elements (per `design_guidelines.json`).
- **Language**: Indonesian UI copy, professional SaaS tone. Code comments mix Indonesian/English.
- **Design system**: See `design_guidelines.json` — primary `#0EA5E9`, fonts Plus Jakarta Sans + Inter, surfaces use glass/blur patterns.

## Gotchas

- GoWA must never be publicly exposed. In Docker it's not port-mapped; locally it binds `127.0.0.1:3001`. Firewall script: `tools/block-public-gowa.ps1`.
- Admin requires TOTP MFA (`ADMIN_TOTP_SECRET` env var) on Docker deployments.
- Frontend dev proxy (`src/setupProxy.js`) routes `/api` to `http://127.0.0.1:8000`.
- Backend is a **single file** (`server.py`), not a package. Adding routes means editing that file.
- `resolutions` in `frontend/package.json` pin many transitive deps for security — do not remove without checking.
- Docker frontend build uses `yarn install --frozen-lockfile`. If `yarn.lock` is stale, rebuild fails.
- Tests are integration-only (no unit test isolation). They create real users/websites in the DB.
