# Kothora web app

The browser app for Kothora Chat: a chat layout in the style of ChatGPT, Claude and
Perplexity, with answers that show their sources. Built with
[SolidJS](https://www.solidjs.com) and [Vite](https://vite.dev), with no other runtime
dependencies.

## Run it

| Goal | Command | Backend |
| --- | --- | --- |
| Develop against the real API | `npm run dev` → http://localhost:5173 | FastAPI on `:8000` (see `../backend`); Vite proxies `/api` to it |
| Build for production | `npm run build` → `dist/` | Served by Nginx next to the API (`nginx.conf`, `Dockerfile`) |
| Build the shareable demo | `npm run build:demo` → `dist-demo/kothora-demo.html` | None: a sample backend runs in the browser |

```bash
npm install
npm run dev          # needs the backend: cd ../backend && uvicorn kothora.main:app --reload
```

To check the backend end to end, run both and use the app as a user would: sign up,
ask a question, open a past chat, switch plans. Every request goes through the real
API, and the browser's network tab shows the JSON and the streamed events.

## Checks

```bash
npm run lint         # Prettier
npm run typecheck    # TypeScript, strict
npm test             # Vitest: Markdown parser, stream parser, routes, dates, formatting, session
npm run build
```

## How it is organized

```
src/
  index.tsx, App.tsx     Entry; App wires routes, dialogs, shortcuts and the shared state
  app-context.ts         Data and actions shared by every screen (useApp())
  env.ts                 IS_DEMO build flag
  components/
    layout/              Sidebar (nav, Projects, Recents), TopBar (Chat | Code, incognito),
                         AccountMenu, SearchDialog (Ctrl+K), ShortcutsDialog
    chat/                ChatView, Composer (+ menu, mode, model, voice), Messages,
                         SourceCards, Markdown
    pages/               Projects, Project, Library, Plugins & Skills, Automations,
                         Kothora Code, Plans
    settings/            SettingsDialog and its sections (General … API keys)
    extensions/          Plugins and Skills panels, shared by the page and Settings
    auth/                Sign in and sign up
    ui/                  Icon, Menu, Dialog, Toaster, empty/error states
  lib/
    api.ts               HTTP client, session token, streaming a reply
    resource.ts          Data loading that never throws (missing endpoints degrade)
    sse.ts, markdown.ts  Stream parser; Markdown to a tree (never HTML strings)
    router.ts, routes.ts URLs: /, /c/:id, /p/:id, /projects, /library, /plugins,
                         /skills, /automations, /code, /billing
    attachments.ts       Text files sent inside the message
    dictation.ts         Voice typing through the browser
    forecast.ts          "Will I run out this month?"
    time.ts, format.ts, theme.ts, toast.ts, clipboard.ts, types.ts
  demo/                  In-browser backend for the demo build, with sample data
  styles/                tokens, base, layout, chat, markdown, pages, app (new screens)
scripts/                 build-demo.mjs, export-plans.py
```

Screens for projects, favorites, library sources, automations, plugins, skills,
preferences and memory call routes the FastAPI backend does not have yet. They work in
the demo and show "not available on this server yet" against the real backend. The
routes they need are in [docs/frontend-api-contract.md](../docs/frontend-api-contract.md).

## How it talks to the backend

The app uses only the endpoints in the root README's API table. A reply streams as
Server-Sent Events from `POST /api/conversations/{id}/messages`:

| Event | The app |
| --- | --- |
| `meta` | Shows the source cards and "Reading N sources…". A second `meta` means the backend fell back to another model, so the text restarts. |
| `notice` | Shows a note above the answer, such as "Web search is unavailable right now." |
| `delta` | Appends text; the Markdown re-renders as it arrives. |
| `done` | Stores the saved message id, the final sources (with which were cited) and the model. |
| `error` | Shows an error card with Try again. |

HTTP errors keep their meaning: a 401 on any request (an expired session) returns to
sign-in, 429 (quota used up) offers the plans page, and other errors show the
backend's own message.

## Design

- **Layout.** A collapsible history sidebar and a centered column up to 768 px wide,
  like ChatGPT. An empty chat centers a greeting, the composer and suggestions, like
  Claude. Answers show source cards first, then the text with numbered citation pills,
  like Perplexity. Below 860 px the sidebar becomes a drawer.
- **Color.** Kothora's deep green with a burnt-orange accent, from the business
  document. Every color is a token in `styles/tokens.css`, defined for light and dark.
  The theme follows the system unless the user picks one in the account menu.
- **Type.** Instrument Sans for the interface, Bricolage Grotesque for headings, Hind
  Siliguri for Bangla, JetBrains Mono for code.
- **Keyboard.** Enter sends, Shift+Enter adds a line, Escape stops an answer,
  Ctrl/Cmd+K searches chats, Ctrl/Cmd+Shift+O starts a new chat, Ctrl/Cmd+Shift+S
  toggles the sidebar, Ctrl/Cmd+Shift+, opens Settings.

## Conventions

- **No HTML from data.** Model output and search results are rendered as DOM nodes
  from the Markdown tree, never with `innerHTML`, and links pass through `safeUrl`.
  Keep it that way: it is what makes the stored token safe from injected scripts.
- **Colors come from tokens.** Do not write a color in a component stylesheet; add a
  token to both themes in `tokens.css`.
- **Pure logic lives in `lib/` with a test.** Components stay thin.
- **Storage can fail.** Wrap every `localStorage` call in `try`; the app must work
  without it (private browsing, embedded frames).
- **No `confirm()` or `alert()`.** Embedded viewers suppress them. Confirm in the page,
  as the two-step Delete in the sidebar does.

## Needs backend work

These are visible in the app but need backend support first:

- **Regenerate.** "Try again" re-sends the question, so the backend stores the user
  message twice. A regenerate endpoint would avoid that.
- **Stopped answers.** Text from a stopped answer stays on screen but is not saved, so
  it is gone after a reload.
- **Follow-up suggestions** under an answer, as Perplexity shows.
- **Image and PDF uploads.** Text files already work: they travel inside the message.
- Everything in [docs/frontend-api-contract.md](../docs/frontend-api-contract.md).
