# Deployment

The target is the single owned server described in the business document
(§6.1). Docker Compose runs the web app (Nginx), the API, PostgreSQL and Redis.
Ollama (local models) and SearXNG (web search) are optional profiles.

## 1. Configure

```bash
cp .env.example .env
openssl rand -hex 32        # use as KOTHORA_JWT_SECRET
openssl rand -hex 24        # use as POSTGRES_PASSWORD
```

Set `KOTHORA_PUBLIC_URL` and `KOTHORA_FRONTEND_URL` to the public HTTPS address.
SSLCommerz calls back to the public URL, so it must be reachable from the internet.
In production the API refuses to start with the default or a short JWT secret.

## 2. Start

```bash
docker compose --profile local-models --profile search up -d --build
docker compose exec ollama ollama pull llama3:8b-instruct-q4_K_M
docker compose exec ollama ollama pull codellama:7b-instruct-q4_K_M
```

Without local models, set `KOTHORA_LOCAL_ENABLED=false` and an OpenRouter key;
every query then goes to OpenRouter.

## 3. TLS

The `web` container serves plain HTTP on port 80. Put TLS in front of it with
the host's Nginx or Caddy and a Let's Encrypt certificate. If the front proxy
also buffers, keep buffering off for `/api/`, because answers stream as Server-Sent Events.

## 4. SSLCommerz

1. Get sandbox credentials from SSLCommerz, then set `KOTHORA_SSLCOMMERZ_STORE_ID`,
   `KOTHORA_SSLCOMMERZ_STORE_PASSWORD` and `KOTHORA_SSLCOMMERZ_SANDBOX=true`.
2. In the merchant panel, register the IPN URL: `https://<your domain>/api/billing/sslcommerz/ipn`.
3. Pay with the sandbox bKash and card test accounts, and check that `/api/account/usage`
   shows the new plan.
4. For live payments, switch to live credentials and set `KOTHORA_SSLCOMMERZ_SANDBOX=false`.

A payment activates a plan only after the server confirms it with SSLCommerz's
validation API, with a matching transaction id, amount and currency. Transactions that
SSLCommerz marks as risky are stored with status `review` and are not activated.

## 5. Operations

- **Backups.** Dump Postgres daily to off-site storage, e.g.
  `docker compose exec postgres pg_dump -U kothora kothora | gzip > kothora-$(date +%F).sql.gz`.
  The business document flags one server as a single point of failure.
- **Capacity.** CPU-only Llama 3 8B serves few people at once. Load-test before
  promising response times; paid tiers fall back to OpenRouter when the local model fails.
- **Schema changes.** Tables are created on start. Add Alembic before the first
  change to an existing table.
- **Admins.** Promote the first admin in SQL:
  `UPDATE users SET is_admin = true WHERE email = '…';`
