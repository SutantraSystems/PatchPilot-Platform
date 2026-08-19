# PatchPilot

PatchPilot is a multi-tenant patch and vulnerability management dashboard. It tracks systems, system groups, patches, patch jobs, policies, vulnerabilities, and maintenance windows for an IT/SecOps team, with live job-progress updates over WebSocket.

**Stack:** React (Vite + TypeScript) frontend, FastAPI (Python) backend, MongoDB database.

---

## Prerequisites

Install these before you start:

- **Python 3.12.10** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 20.x (LTS)** and npm — [nodejs.org](https://nodejs.org/).
- **MongoDB Community Server** — [Download](https://www.mongodb.com/try/download/community), and make sure it's running locally (default: `mongodb://localhost:27017`) before you start the backend

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo_url>
cd PatchPilot
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate      # Windows (PowerShell)
# source .venv/bin/activate   # macOS/Linux

python -m pip install -r requirements.txt
```

Create a `.env` file inside `backend/` (see [Environment Variables](#environment-variables) below) — the app won't start without it.

Seed the database with initial demo data (**first-time setup only** — running it again re-seeds/duplicates data):

```bash
python mock_seed.py
```

Start the backend:

```bash
python -m uvicorn server:app --reload
```

The API will be running at `http://localhost:8000`.

### 3. Frontend setup

Open a new terminal:

```bash
cd frontend
npm install       # first-time setup only
npm run dev
```

The app will be running at `http://localhost:3000` (or the port Vite prints in the terminal), and will talk to the backend at `http://localhost:8000` by default.

---

## Ports

| Service | Default URL |
|---|---|
| Frontend (Vite dev server) | `http://localhost:3000` |
| Backend (FastAPI) | `http://localhost:8000` |
| MongoDB | `mongodb://localhost:27017` |

If any of these are already in use on your machine, the corresponding tool (Vite / uvicorn / mongod) will either fail to start or pick a different port — check its terminal output.

---

## Environment Variables

Create `backend/.env` with the following keys:

```env
JWT_SECRET=<a long, random string — do not use a guessable default>
MONGO_URL=mongodb://localhost:27017
DB_NAME=patchpilot
ADMIN_EMAIL=<email for the seeded admin account>
ADMIN_PASSWORD=<a strong password — do not use a guessable default>
```

> ⚠️ **Never commit `.env` to version control.** It's already excluded via `.gitignore`.

Optional — only needed if your backend runs somewhere other than `http://localhost:8000`, create `frontend/.env.local`:

```env
VITE_BACKEND_URL=http://localhost:8000
```

---

## First Login

After running `python mock_seed.py`, log in to the app at `http://localhost:3000/login` using the `ADMIN_EMAIL` / `ADMIN_PASSWORD` values you set in `backend/.env`.

---

## API Docs

FastAPI generates interactive API documentation automatically. With the backend running, open:

```
http://localhost:8000/docs
```

to browse and try every endpoint directly (Swagger UI).

---

## Project Structure

```
PatchPilot/
├── backend/
│   ├── server.py          # FastAPI app — all routes, auth, and business logic
│   ├── mock_seed.py        # Seeds MongoDB with demo tenant/data
│   ├── requirements.txt
│   ├── pytest.ini          # Test runner config (pytest-xdist, 2 workers)
│   ├── tests/               # Backend test suite
│   └── .env                 # Local secrets — not committed
├── frontend/
│   ├── src/
│   │   ├── pages/           # Login, Register
│   │   ├── components/      # Dashboard and feature components
│   │   ├── context/         # Auth and theme context
│   │   ├── hooks/           # TanStack Query data hooks
│   │   └── lib/             # API client
│   └── package.json
└── design_guidelines.json  # Theme, typography, and color tokens
```

---

## Available Scripts

**Backend** (from `backend/`, with the virtual environment active):

 `python -m uvicorn server:app --reload` | Start the API with hot reload |
 `python mock_seed.py` | Seed the database with demo data |
 `pytest` | Run the backend test suite |

**Frontend** (from `frontend/`):

`npm run dev` | Start the Vite dev server |
`npm run build` | Production build |

---

## Troubleshooting

- **Backend fails to start / connection refused errors** — MongoDB likely isn't running. Start it before running `uvicorn`.
- **Frontend loads but shows network/API errors** — the backend isn't running yet, or it's running on a different URL than `VITE_BACKEND_URL` expects. Confirm the backend terminal shows it's up at `http://localhost:8000` first.
- **Port already in use** — another process is using `3000` or `8000`. Stop it, or let Vite/uvicorn pick a different port and update `VITE_BACKEND_URL` accordingly.
- **Login fails after a fresh clone** — make sure you ran `python mock_seed.py` at least once, and that you're using the `ADMIN_EMAIL`/`ADMIN_PASSWORD` from your own `.env`, not the example values.

---

