# YukiOshi Code analysis, and how it relates to Kothora

Repository: `ahmed-alxawad/YukiOshiCode`, analyzed at commit `ec1bab9` (21 October 2026).

## What it is

YukiOshi Code (`yukioshi`) is a terminal AI coding agent from YukiOshi. It is
a fork of [opencode](https://github.com/anomalyco/opencode); its sandbox and code-indexing packages come from
Kilo Code. It is proprietary, and the source is public only for a limited testing period.

| Aspect | Finding |
| --- | --- |
| Runtime and language | Bun 1.3, TypeScript, Effect-TS, in a Turborepo monorepo |
| Size | 17 packages, about 280k lines of TypeScript outside tests, about 810 test files |
| Largest packages | `opencode` (agent core and CLI, about 103k lines), `core` (38k), `ui` (34k, SolidJS), `sdk` (31k), `tui` (28k, OpenTUI) |
| Models | Claude, Codex, Grok, Gemini, **OpenRouter**, Kimi, Moonshot, Z.AI, NVIDIA NIM, and any OpenAI-compatible server |
| Modes | Build, Plan, Goal, Reasoning, Research, Auto |
| Safety | 5 permission modes, hard blocks on destructive commands and secret files, OS sandbox (bubblewrap or Seatbelt), repository trust, credentials in the OS keychain |
| Limits it already enforces | `--max-turns`, `--max-cost`, `budget` limits on tokens and spend, a 2-hour cap on scheduled runs |
| Distribution | Single binaries for Linux, macOS and Windows (x64 and arm64), with SHA256-checked installers |
| Quality bar | CI on three platforms, smoke tests, oxlint, Prettier, Husky hooks |

## Relationship to the Kothora products

The business plan describes three products: **Kothora Ai** (chat), **Kothora Code**
(coding assistant) and **Kothora Computer** (agentic, on the roadmap).

- **Kothora Code = YukiOshi Code with fewer limits.** YukiOshi Code is the engine.
  Kothora Code is the commercial edition that Pro, Premium and the Business plans
  include. The business plan (§2.2) lists code completion, debugging, sandbox
  execution, GitHub integration and token tracking. YukiOshi Code already has
  each of these: edits, the shell tool, the sandbox package, `/pr` and the GitHub
  Action, and `/usage`. So Kothora Code is mostly packaging and entitlements, not new engine work.
- **Kothora Chat (this repository)** is the chat product. It is a separate code
  base because it serves a different user (the browser, not the terminal) and has
  a different cost model (per query, metered against a BDT plan).

## What Kothora Chat reuses, and what it deliberately does not

| From YukiOshi Code | In Kothora Chat |
| --- | --- |
| OpenRouter and any OpenAI-compatible provider | Same idea: one streaming client (`services/llm.py`) for OpenRouter and local Ollama or llama.cpp |
| SolidJS for the web UI (`packages/ui`) | The frontend is SolidJS + Vite |
| Budgets and cost limits | Plan quotas and per-query cost logging (`usage_records`) |
| Evidence, not claims (post-turn verification) | Answers cite their sources, and citations to sources that do not exist are discarded |
| Proprietary license | Same terms in `LICENSE` |
| Bun and Effect-TS backend | **Not reused.** The business plan's architecture (§6.1) specifies FastAPI, PostgreSQL, Redis and Nginx, and the chat backend follows it |

## What Kothora Code needs to become a product

These are the steps to turn YukiOshi Code into Kothora Code. They are not done in this repository:

1. **Entitlement check.** Have the CLI sign in to a Kothora account and read
   `GET /api/account/usage`. If `kothora_code` is true, unlock the paid limits.
2. **Hosted model access.** Point the CLI's OpenRouter provider at a Kothora
   proxy instead of the user's own key. Kothora can then meter coding tokens
   against the plan (§2.2, "token usage tracking").
3. **Define what "more limitations" means for YukiOshi Code**, for example lower
   default `--max-cost` and `--max-turns`, no background subagents, or no
   scheduled tasks. Then lift those limits for Kothora Code users. This is a
   product decision for the founders.
4. **Branding.** Use Kothora's green and orange palette and logo through the
   existing theme JSON (`packages/tui/src/theme/assets/`).
