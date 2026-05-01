# Logistics platform

Web app for supply-chain workflows: supplier → operations → warehouse checklists, dashboards, and demo data. The UI is a React (Vite) client; the API is FastAPI with a local SQLite database by default.

## Prerequisites

- **Python** 3.11 or newer (3.12 is fine)
- **Node.js** 18 or newer (for the frontend)
- **npm** (bundled with Node)

## Quick start (development)

Run the **API** and **UI** in two separate terminals.

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

- **Windows (PowerShell):** `.\.venv\Scripts\Activate.ps1`
- **macOS / Linux:** `source .venv/bin/activate`

Install dependencies and start the server:

```bash
pip install -r requirements.txt
copy env.example .env
```

On macOS/Linux use `cp env.example .env` instead of `copy`.

Start Uvicorn from the `backend` folder (reload is optional but useful while developing):

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

What happens on startup:

- Tables are created and lightweight migrations run.
- Demo users and sample data are seeded (see **Demo logins** below).
- The SQLite file is created next to the backend app as `smartflow_ai.db` (unless you override `DATABASE_URL` in `.env`).

Useful URLs:

- API root: http://127.0.0.1:8000/
- OpenAPI docs: http://127.0.0.1:8000/docs
- JSON under: http://127.0.0.1:8000/api/v1/

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

The dev server listens on **http://localhost:5173** and proxies `/api` to `http://127.0.0.1:8000`, so the browser talks to the backend without CORS issues during local development.

Leave the backend running on port **8000** before using the UI.

## Demo logins

Password for all demo accounts: **`demo1234`**

| Role        | Email                     |
| ----------- | ------------------------- |
| Executive   | `executive@smartflow.ai`  |
| Operations  | `operations@smartflow.ai` |
| Warehouse   | `inventory@smartflow.ai`  |
| Supplier    | `supplier@smartflow.ai`   |

## Configuration (optional)

Edit `backend/.env` (copied from `backend/env.example`). Common variables:

- **`CORS_ORIGINS`** — Comma-separated origins allowed by the API (default includes `http://localhost:5173`).
- **`DATABASE_URL`** — Default is SQLite: `sqlite:///./smartflow_ai.db`. You can point this at another database if you configure SQLAlchemy-compatible URLs.
- **`MAPBOX_*`**, **`OPENROUTESERVICE_*`**, **`GRAPHHOPPER_*`** — Optional; used for richer route geometry on some map endpoints.
- **`TWILIO_*`**, **`SMS_PHONE_*`** — Optional SMS; without Twilio, handoff messages are logged only.

Frontend API base path is `/api/v1` via the Vite dev proxy; no extra `.env` is required for a standard local run.

## Production-style frontend build

```bash
cd frontend
npm run build
npm run preview
```

`preview` serves the built assets; you still need the API running separately, and production deployments usually put the static build behind a reverse proxy that also forwards `/api` to the backend.

## Troubleshooting

- **UI loads but API errors** — Confirm Uvicorn is up on port **8000** and that nothing else is bound to that port.
- **Login fails** — Restart the backend once so `ensure_demo_accounts` can repair passwords; use `demo1234` and the emails above.
- **CORS errors in the browser** — If you change the UI origin, add it to `CORS_ORIGINS` in `backend/.env` and restart the API.

## Project layout

- `backend/` — FastAPI application (`app.main:app`), SQLite by default, migrations/seed on startup.
- `frontend/` — Vite + React SPA, dev server on port 5173 with `/api` proxy to the backend.
