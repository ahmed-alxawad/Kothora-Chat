# Kothora Chat

**Kothora Chat** (the product the business plan calls *Kothora Ai*) is a
search-grounded AI chat for Bangladesh. Answers cite their sources, plans are
priced in BDT, and payment goes through SSLCommerz (cards, bKash, Nagad,
Rocket, net banking). It is the chat product of **Kothora AI**, a child company
of [YukiOshi](https://yukioshi.com). Its sibling product, **Kothora Code**, is
the paid edition of [YukiOshi Code](https://github.com/ahmed-alxawad/YukiOshiCode)
with fewer limits ([docs/yukioshi-code-analysis.md](docs/yukioshi-code-analysis.md)).

## What it does

| Feature | Where | Business document |
| --- | --- | --- |
| Cited answers: web results numbered `[n]`, citations checked against real sources | `services/grounding.py` | 2.1, UVP 1.4 |
| Cheapest-adequate routing: cache → local Llama → local code model → OpenRouter | `services/router.py` | 6.2 |
| Automatic fallback when a model is down (only before any text has streamed) | `services/chat.py` | 6.2 flag |
| Plans, quarterly (10%) and yearly (15%) billing, per-seat Business plans | `plans.py` | 4.1–4.4 |
| Monthly and daily quotas, reset at midnight Dhaka time; Premium has a fair-use cap | `services/subscriptions.py` | 4.1 flag |
| SSLCommerz checkout, IPN, server-side validation, idempotent activation | `services/payments/`, `services/billing.py` | 1.2, 3.3 |
| Education plan: verification gate, OpenAlex scholarly search, BibTeX and reference-list export | `api/billing.py`, `services/search.py`, `services/bibliography.py` | 4.3 |
| Per-query log of route, tokens, cost and latency (data for a learned router later) | `models.UsageRecord` | 2.1 (PPO), 8.3 |
| Web app: chat with streaming, citation chips, usage meter, plans and checkout | `frontend/` | — |

Where the business document left a decision open or contradicted itself, the
code takes one position and says so. See
[docs/business-decisions.md](docs/business-decisions.md) before changing prices or limits.

## Layout

```
backend/            FastAPI service (Python 3.11+)
  kothora/
    api/            HTTP routes: auth, account, chat (SSE), billing
    services/       routing, models, search, grounding, quotas, payments
    plans.py        plan catalog and price arithmetic
    models.py       SQLAlchemy tables
  tests/            pytest; every outbound HTTP call is faked
frontend/           SolidJS + Vite web app
deploy/             SearXNG config
docs/               decisions, YukiOshi Code analysis, deployment
docker-compose.yml  web + api + Postgres + Redis (+ Ollama, SearXNG profiles)
```

## Run it locally

Backend (SQLite and an in-process cache by default):

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
uvicorn kothora.main:app --reload            # http://localhost:8000/docs
```

Answers need at least one model. Either run [Ollama](https://ollama.com) with
`ollama pull llama3:8b-instruct-q4_K_M`, or set `KOTHORA_OPENROUTER_API_KEY`.
Web search is off until `KOTHORA_SEARCH_PROVIDER` is set (`searxng`, `brave` or
`tavily`). All settings are in `backend/kothora/config.py` and `.env.example`.

Frontend:

```bash
cd frontend
npm install
npm run dev                                  # http://localhost:5173, proxies /api to :8000
```

## Tests and checks

```bash
cd backend && ruff check . && ruff format --check . && pytest -q
cd frontend && npm run lint && npm test && npm run build
```

CI runs the same commands (`.github/workflows/ci.yml`).

## Deploy

`docker compose up -d` after filling in `.env` from `.env.example`. See
[docs/deployment.md](docs/deployment.md) for TLS, local models, search and
SSLCommerz setup.

## API

Interactive docs are served at `/docs`. The main endpoints:

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | Accounts (JWT bearer tokens) |
| `GET /api/account/usage` | Plan, quota used, models the plan may choose |
| `GET/POST /api/conversations`, `GET/PATCH/DELETE /api/conversations/{id}` | Conversations |
| `POST /api/conversations/{id}/messages` | Ask; streams `meta`, `notice`, `delta`, then `done` or `error` as SSE |
| `GET /api/conversations/{id}/messages/{mid}/bibliography?format=bibtex\|text` | Education plan export |
| `GET /api/billing/plans`, `POST /api/billing/checkout` | Prices and SSLCommerz checkout |
| `POST /api/billing/sslcommerz/ipn`, `POST /api/billing/sslcommerz/return/{outcome}` | Gateway callbacks |
| `POST /api/account/admin/education-verification` | Admin: record a student or educator check |

## License

Proprietary. © 2026 Kothora AI, a YukiOshi company. All rights reserved. See [LICENSE](LICENSE).
