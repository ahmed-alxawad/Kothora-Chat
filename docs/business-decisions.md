# Business decisions in the code

Source: *Kothora AI Business Documentation*, Draft v1, 19 September 2026.
That document flags 19 issues (Appendix A) and lists open items (Appendix B).
Some of them change what the code has to do. This page records the position
the code takes on each one, so the founders can confirm it or overturn it. Each
setting named below can be changed without touching the logic.

## Decisions taken in code

| # | Flag | What the code does | Change it in |
| --- | --- | --- | --- |
| 5 | Premium "unlimited queries" conflicts with a per-query cost model | Premium is capped at **3,000 queries per month and 200 per day** (fair use). Allowances are per query, so one heavy user cannot run up unbounded OpenRouter costs. | `plans.py` |
| 6 | Quarterly prices mislabeled; 5% vs 10% discount | **10%**, matching the 720 / 1,350 / 1,800 per-month figures, **billed per quarter**: 2,160 / 4,050 / 5,400 BDT. | `KOTHORA_QUARTERLY_DISCOUNT` |
| — | Yearly discount | **15%**: 8,160 / 15,300 / 20,400 BDT, which matches the document. | `KOTHORA_YEARLY_DISCOUNT` |
| 9 | Kothora Computer in both Premium and a separate Max tier | Not built (roadmap). No Max tier exists, and Premium does not list Kothora Computer until the founders pick one packaging. | — |
| 12 | Institution seat price is over 3× the student price | Business Basic stays at 2,500 BDT per seat as written. Institutions buy Education seats through Enterprise (custom quote) until an institutional tier is decided. | `plans.py` |
| 14 | Gateway fees, the 5.5% OpenRouter fee and taxes are missing from unit economics | Each answered query records its tokens, OpenRouter's reported cost in USD, the route and the latency in `usage_records`. That is the measured cost per query the plan's §8.3 asks for. Fees and VAT still need to be added on top in the finance model. | `models.UsageRecord` |
| 16 | Whether SSLCommerz supports automatic recurring debits | Assumed **no**. Every paid period is a separate payment and a separate `subscriptions` row. Renewing the same plan extends the current period; switching plans starts now, with no proration. | `services/subscriptions.py` |
| 17 | Standalone Kothora Code costs the same as Pro, which includes it | Kothora Code is not sold standalone here. Pro, Premium and the Business plans include it (`kothora_code: true` in `/api/account/usage`). | `plans.py` |
| 18 | One 16 GB server runs everything | Each component can be swapped out: local models use any OpenAI-compatible URL, the cache is Redis or in-process, and the database is any SQLAlchemy URL. Paid tiers fall back to OpenRouter when the local model is down. Load testing is still needed. | `config.py` |
| — | "Free tier with usage limits" (§2.1) has no numbers | **15 queries per month, 5 per day**, local model only, with web citations. | `plans.py` |
| — | Education "higher limits" has no numbers | **1,000 per month, 100 per day.** Checkout needs an admin-recorded verification that is still valid; re-verification works by setting a new expiry date. | `plans.py`, admin endpoint |
| — | Business per-seat limits are not stated | 800 (Business Basic) and 3,000 (Business Premium) per seat. The purchaser's account holds one pooled allowance until member accounts exist. | `plans.py` |

## Routing rules (§6.2)

1. **Cache.** Only standalone first questions are cached, because a follow-up depends on its
   conversation. The cache key includes the plan's model access, so a Basic
   user never receives an answer written by a premium model.
2. **Simple question** (short, a single question, no reasoning cue) → local Llama 3 8B.
3. **Coding question** (code, a language name, an error message) → local CodeLlama 7B.
4. **Everything else** → OpenRouter. Basic and Free never use OpenRouter
   unless the local model is down; then they fall back to the budget model, which
   `KOTHORA_LOCAL_FALLBACK_TO_OPENROUTER=false` turns off.

The classifier is a deliberately simple heuristic. The PPO-trained router in §2.1
needs labeled data first: `usage_records` stores the category, route, cost and
latency of every query, which is the dataset a learned router would train on.

## Not built yet

These items are out of scope for this first version or blocked on a founder decision:

- Kothora Computer (agentic workflows): roadmap, packaging undecided (flags 7, 9).
- Kothora Code: this is a separate product; see `yukioshi-code-analysis.md`.
- Business features: SSO, admin console, audit-log UI, team workspaces, fine-tuning.
- File and image uploads (§2.1).
- Automated student verification (SheerID or similar); it is recorded by an admin for now.
- Renewal reminder emails for wallet payments.
- Database migrations (Alembic). Tables are created on start for now.

## Open items that still need the founders (Appendix B)

- What counts as one "query" in an allowance. The code reserves one when a message
  is accepted and keeps it for every answer, including cache hits and answers the
  user stops partway (the model has already been paid). It gives the query back only
  when no answer could be produced.
- How OpenRouter credits are bought from Bangladesh (card at a 5.5% fee, or crypto at 5%).
- VAT treatment of subscription prices. Prices are shown and charged as stated, with no tax added.
- Whether Bangladeshi students qualify for Google's free AI Plus offer, which
  would undercut the 750 BDT Education plan.
