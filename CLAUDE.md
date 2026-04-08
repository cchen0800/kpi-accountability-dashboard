# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Frontend dev server (port 5173, proxies /api to localhost:5000)
npm install
npm run dev

# Backend (requires OPENAI_API_KEY in environment)
pip install -r requirements.txt
FLASK_DEBUG=1 python api/app.py   # runs on port 5000

# Production build
npm run build          # outputs to dist/
vite preview           # preview production build

# Docker (full stack)
docker-compose up --build
```

No test suite exists in this project.

## Architecture

Three-tier app: React SPA → Flask REST API → SQLite.

**Frontend** (`src/`): React 19 + Vite 6. Jotai for global state (atoms in `src/lib/store/`). API client with retry/backoff in `src/lib/api/core.js`. Three routes: `/` (Dashboard), `/pipeline` (Pipeline control), `/employees/:id` (Detail).

**Backend** (`api/`): Flask with SQLAlchemy ORM. Models in `api/models.py`. Routes split into `api/routes/employees.py` and `api/routes/pipeline.py`.

**The Pipeline** (`api/pipeline.py`): Core feature — a 3-stage agentic process using OpenAI:
1. **Generation**: GPT creates synthetic standup updates per employee using their `hidden_truth` field
2. **Extraction**: A separate GPT call extracts KPI metrics from updates (blind to hidden_truth)
3. **Reasoning**: Another GPT call analyzes accountability gaps and assigns flags

Stages run sequentially; within each stage, employees are processed in parallel via ThreadPoolExecutor. Frontend polls `/api/pipeline/status` every 2s during execution.

**Key design constraint**: Only Stage 1 sees `hidden_truth`. Stages 2-3 must detect issues from updates alone — this tests whether the AI pipeline can surface hidden problems without privileged info.

## Environment Variables

- `OPENAI_API_KEY` — required for pipeline
- `OPENAI_MODEL` — defaults to `gpt-4o-mini`
- `FLASK_DEBUG` — set to `1` for dev mode
- `CORS_ORIGIN` — defaults to `http://localhost:5173`
- `DB_DIR` — SQLite location, defaults to `./data`

## Git Configuration

**Do not add `Co-Authored-By` trailers to commits in this repository.**
