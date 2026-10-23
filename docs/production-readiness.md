# Production readiness

Review of Kothora Chat v0.1 against a production checklist. Scale assumed: one
server, launch-phase volume from the business document (§7: 100–500 paying
users, a few thousand free users). Last reviewed 23 October 2026.

## Verdict

**Ready for a closed beta (§9 Phase 1: 50–100 users). Not yet ready for public
launch.** The three launch blockers below are each a few days of work.

## Fixed in this review

| Issue | Evidence | Fix |
| --- | --- | --- |
| Parallel requests bypassed the quota | Test: 12 of 12 parallel requests passed a 5-per-day limit | The query is reserved in the same transaction as the quota check, under a per-user row lock. Now exactly 5 of 12 pass (`test_quota_reservation.py`, Postgres). |
| A stream the user stopped early was free, though OpenRouter had billed it | Test: a prepared turn counted 0 queries | The reservation counts from the start and is given back only when no answer is produced. |
| Web and scholarly answers shared one cache entry | Code review | The cache key includes the search scope. |
| Tests ran only on SQLite; production runs Postgres and Redis | — | The suite runs on Postgres 16 + Redis (77 pass locally); a new CI job does the same. |
| No limit on password guessing or free-account sign-ups | Code review | Nginx per-IP limits: 10 per minute on `/api/auth/`, 10 per second on the rest of `/api/`. |
| The health check did not touch the database | — | `/api/health` runs `SELECT 1` and returns 503 on failure; Compose waits on it. |

**Not verified:** the Nginx config and the Docker images were not built or run
(no Docker daemon or Nginx in the review environment), and the CI Postgres job
has not run yet. Run `docker compose config && docker compose build` and
`nginx -t` before deploying.

## Launch blockers

1. **Database migrations.** Tables are created on startup, so the first change to an
   existing column cannot be deployed safely. Add Alembic with a baseline revision
   and run `alembic upgrade head` on deploy. *About 1 day.*
2. **Account recovery and email verification.** There is no password reset, and
   sign-up does not verify the email, so one person can open many free accounts.
   Nginx limits only slow this down. *About 2–3 days*, including an email provider.
3. **Spend ceiling on OpenRouter.** Quotas cap queries, not dollars. Set a credit
   limit on the OpenRouter key and an alert at 80%. *Under 1 hour*, in OpenRouter's dashboard.

## Should fix soon after launch

- **Metrics and alerts.** Logs exist, but nothing pages anyone. Minimum: error rate,
  p95 latency per route, and daily OpenRouter cost (all derivable from `usage_records`),
  plus an alert when a payment stays `pending` for more than an hour.
- **Renewal reminders** before a wallet-paid period ends (§3.3 churn risk).
- **Backups tested by a restore**, not just taken.
- **Reservations left `reserved`** by a crash or an abandoned stream count against the
  user, which is deliberate and conservative. A support query for them:
  `SELECT * FROM usage_records WHERE route = 'reserved' AND created_at < now() - interval '10 minutes';`

## Accepted risks

| Risk | Why it is accepted for now |
| --- | --- |
| Token kept in `localStorage`, so an XSS bug could steal it | The UI never renders HTML from the model or from search results, and links are restricted to http(s). Move to an httpOnly cookie if the app ever renders Markdown as HTML. |
| Prompt injection through search snippets | The model has no tools and no access to other users' data; the worst case is a misleading answer, which its citations make checkable. |
| Free-tier fallback to the paid budget model when the local model is down | Bounded by the free quota (15 per month). `KOTHORA_LOCAL_FALLBACK_TO_OPENROUTER=false` turns it off. |
| A single server | Matches the business plan; mitigated by health checks, restarts and off-site backups. |

## Performance evidence

The API's own CPU work is about 1 ms per answer (measured: classification 14 µs,
prompt build 2 µs, citation marking 51 µs, 1.8 µs per streamed chunk). Model
inference takes seconds, so performance work belongs in model choice and the
local inference server, not the API. Load-test 50 concurrent users before the
public launch.
