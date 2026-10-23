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
  index.tsx              Entry: theme, demo switch, render
  App.tsx                Shell: sign-in gate, sidebar, top bar, routes, shortcuts
  env.ts                 IS_DEMO build flag
  components/
    auth/AuthView.tsx      Sign in and sign up
    layout/Sidebar.tsx     New chat, search, history grouped by date, rename and delete
    layout/AccountMenu.tsx Plan, usage meter, theme, sign out
    layout/TopBar.tsx      Model picker and upgrade button
    chat/ChatView.tsx      One conversation: loading, sending, streaming, scrolling, errors
    chat/Composer.tsx      Message box with the Web / Academic / Writing focus picker
    chat/Messages.tsx      User bubble; answer with status, sources, Markdown and actions
    chat/SourceCards.tsx   Source cards shown above an answer
    chat/Markdown.tsx      Renders parsed Markdown, code blocks and citation pills
    plans/PlansView.tsx    Plans, billing cycles and checkout
    ui/Icon.tsx            Inline icon set and the Kothora mark
    ui/Menu.tsx            Popover menu used by every dropdown
  lib/
    api.ts               HTTP client, session token, streaming a reply
    sse.ts               Incremental Server-Sent Events parser
    markdown.ts          Markdown → tree (never HTML strings)
    router.ts, routes.ts URL routes: /, /c/:id, /billing
    time.ts              History date groups and the greeting
    theme.ts             System / light / dark preference
    format.ts            Safe links, domains, taka, initials, model names
    clipboard.ts         Copy with a failure result
    types.ts             Shapes shared with the backend API
  demo/
    backend.ts           In-browser stand-in for the API (demo build only)
    answers.ts           Sample answers with real sources
    plans.json           Plan catalog exported from the backend (npm run export-plans)
  styles/
    tokens.css           Colors, fonts, sizes for light and dark
    base.css             Element defaults, buttons, menus, switches
    layout.css           Sidebar, top bar, drawer on phones
    chat.css             Welcome screen, thread, sources, composer
    markdown.css         Answer typography, tables, code, citations
    pages.css            Plans and sign-in
scripts/
  build-demo.mjs         Packs the demo into one HTML page
  export-plans.py        Copies the backend's plan catalog into src/demo/plans.json
```

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
  Ctrl/Cmd+Shift+O starts a new chat, Ctrl/Cmd+Shift+S toggles the sidebar.

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
- **File and image uploads** in the composer.
