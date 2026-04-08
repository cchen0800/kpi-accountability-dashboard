# KPI Accountability Dashboard

An agentic analysis pipeline that generates synthetic employee standups via GPT, extracts KPI metrics, and flags accountability gaps — all without privileged information.

**Stack:** React 19 + Vite, Flask + SQLAlchemy, SQLite, OpenAI GPT, Docker + Nginx

---

## Quick Start (Docker)

This is the recommended way to run the app. Docker handles all dependencies, builds the frontend, and serves everything behind Nginx on **port 3000**.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- An OpenAI API key

### 1. Clone and configure

```bash
git clone <repo-url>
cd kpi-accountability-dashboard
```

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
FLASK_SECRET_KEY=change-me-in-production
```

### 2. Build and run

```bash
docker compose up --build -d
```

This will:
- Build the React frontend (`npm run build`)
- Install Python dependencies
- Start the Flask API (Gunicorn, port 5000 internal)
- Start Nginx reverse proxy (port 3000 external)
- Auto-run the analysis pipeline if no data exists

### 3. Open the app

```
http://localhost:3000
```

### Useful commands

```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Rebuild after code changes
docker compose up --build -d

# Full reset (removes database and volumes)
docker compose down -v
docker compose up --build -d
```

---

## Local Development (without Docker)

For frontend-only development or when you want hot-reload.

### Prerequisites

- Node.js 22+
- Python 3.13+
- macOS note: port 5000 is used by AirPlay Receiver — disable it in System Settings > General > AirDrop & Handoff, or the Flask server won't start

### 1. Install dependencies

```bash
# Frontend
npm install

# Backend (use a virtual environment)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

Create a `.env` file as described above, and add:

```env
FLASK_DEBUG=1
```

### 3. Start both servers

```bash
# Terminal 1 — Backend (port 5000)
source venv/bin/activate
FLASK_DEBUG=1 python3 api/app.py

# Terminal 2 — Frontend (port 3000, proxies /api to Flask)
npm run dev
```

Open **http://localhost:3000**

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for the pipeline |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model used for all pipeline stages |
| `FLASK_SECRET_KEY` | Prod only | — | Secret key for Flask sessions |
| `FLASK_DEBUG` | No | — | Set to `1` for dev mode |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed CORS origin |
| `DB_DIR` | No | `./data` | SQLite database directory |

---

## Architecture

```
Browser (port 3000)
  └─ Nginx (static assets + reverse proxy)
       └─ Gunicorn / Flask (port 5000, internal)
            ├─ SQLite (data/data.db)
            └─ OpenAI API
```

### The Pipeline

Three sequential GPT stages, each running employee analyses in parallel:

1. **Generate Standups** — GPT creates 5 days of synthetic standups per employee using their `hidden_truth` field
2. **Extract KPIs** — A separate GPT call extracts structured metrics from standups (blind to hidden_truth)
3. **Flag Accountability** — A third GPT call analyzes gaps and assigns flags

Key constraint: only Stage 1 sees `hidden_truth`. Stages 2–3 must detect issues from the standups alone.

---

## Project Structure

```
├── api/
│   ├── app.py              # Flask app factory
│   ├── config.py           # Environment config
│   ├── models.py           # SQLAlchemy models
│   ├── pipeline.py         # 3-stage GPT pipeline
│   ├── openai_client.py    # OpenAI wrapper
│   └── routes/
│       ├── employees.py    # Employee CRUD endpoints
│       └── pipeline.py     # Pipeline trigger/status endpoints
├── src/
│   ├── App.jsx             # Router + layout
│   ├── pages/
│   │   ├── Dashboard.jsx   # Main KPI dashboard
│   │   ├── Pipeline.jsx    # Pipeline control UI
│   │   └── EmployeeDetail.jsx
│   ├── components/         # Shared UI components
│   └── lib/
│       ├── api/            # API client with retry/backoff
│       └── store/          # Jotai atoms
├── nginx/
│   └── nginx.conf          # Nginx reverse proxy config
├── Dockerfile              # Multi-stage build
├── docker-compose.yml      # Full stack orchestration
└── synthetic_data.json     # Employee seed data
```
