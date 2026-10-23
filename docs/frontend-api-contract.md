# API contract for planned features

The web app already has screens for the features below. The demo build serves them
from `frontend/src/demo/backend.ts`; the FastAPI backend does not have them yet, and
against it each screen says the feature is "not available on this server yet". This
page is the backend to-do list: implement these routes with these shapes and the
screens work without frontend changes. Types are in `frontend/src/lib/types.ts`.

All routes need the `Authorization: Bearer` token and act on the signed-in user's data.

## Changes to existing routes

| Route | Change |
| --- | --- |
| `POST /api/conversations` | Accept `{ project_id: string \| null, temporary: boolean }`. Temporary (incognito) chats are not listed and should be deleted after a short retention period. |
| `GET /api/conversations` | Add `project_id` and `starred` to each item. Exclude temporary chats. |
| `PATCH /api/conversations/{id}` | Accept any of `title`, `starred`, `project_id` (all optional; today `title` is required). |
| `POST /api/conversations/{id}/messages` | Accept `reasoning: "standard" \| "extended"` (prefer a reasoning model) and `skill_id` (prepend that skill's instructions to the system prompt). Also apply the project's instructions and the user's personalization. |
| `PATCH /api/auth/me` | Accept `{ name }`. |

## New routes

| Route | Request | Response |
| --- | --- | --- |
| `GET /api/projects` | | `Project[]` |
| `POST /api/projects` | `{ name }` | `Project` (201) |
| `PATCH /api/projects/{id}` | any of `name`, `instructions`, `pinned` | `Project` |
| `DELETE /api/projects/{id}` | | 204; the project's chats stay, with `project_id` set to null |
| `GET /api/library/sources` | | `LibrarySource[]`: every source marked `cited`, newest first |
| `GET /api/automations` | | `Automation[]` |
| `POST /api/automations` | `{ title, prompt, frequency, time }`, `frequency` is `daily`, `weekdays` (Sun–Thu) or `weekly`, `time` is `HH:MM` Dhaka time | `Automation` (201) |
| `PATCH /api/automations/{id}` | `{ enabled }` | `Automation` with `next_run_at` recomputed (null when paused) |
| `DELETE /api/automations/{id}` | | 204 |
| `GET /api/connectors` | | `Connector[]` |
| `PUT /api/connectors/{id}/connection` | | `Connector` with `connected: true` (real connectors need an OAuth flow first) |
| `DELETE /api/connectors/{id}/connection` | | `Connector` with `connected: false` |
| `GET /api/skills` | | `Skill[]`: Kothora's catalog plus the user's own |
| `POST /api/skills` | `{ name, description, instructions }` | `Skill` (201), `author: "me"`, installed |
| `PATCH /api/skills/{id}` | `{ installed }` | `Skill` |
| `DELETE /api/skills/{id}` | | 204; only the user's own skills |
| `GET /api/account/preferences` | | `Preferences` |
| `PUT /api/account/preferences` | `Preferences` | `Preferences` |
| `GET /api/account/memories` | | `Memory[]` |
| `DELETE /api/account/memories/{id}` | | 204 |

## Status codes the app relies on

- **404 or 405** on a route means "not built yet": the screen shows the not-available state.
- **401** anywhere returns the user to sign-in.
- **429** on sending a message offers the plans page.
- Errors use FastAPI's `{ "detail": "..." }`; the app shows `detail` to the user, so write it
  for them.

## Still frontend-only or not started

- File attachments are inlined into the message as text, so they work today. Images and
  PDFs need an upload route.
- Voice typing uses the browser's speech recognition; it needs no backend.
- Not started anywhere: regenerate and edit-and-resend, sharing a chat by link, answer
  feedback, follow-up suggestions, image generation, voice conversations.
