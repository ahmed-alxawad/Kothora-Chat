/**
 * An in-browser stand-in for the Kothora API, used only by the demo build. It answers
 * the same routes with the same JSON and Server-Sent Events as the FastAPI backend,
 * plus the planned routes in docs/frontend-api-contract.md, so the app runs unchanged
 * against it. Data lives in memory and resets on reload.
 */
import { findDemoAnswer } from "./answers"
import plans from "./plans.json"
import {
  daysAgo,
  seedAutomations,
  seedConnectors,
  seedMemories,
  seedPreferences,
  seedProjects,
  seedSkills,
} from "./seed"
import type { Conversation, LibrarySource, Message, Plan, Usage, User } from "../lib/types"

const STREAM_CHUNK_DELAY_MS = 18
const SEARCH_DELAY_MS = 700

type StoredConversation = Conversation & { messages: Message[]; temporary: boolean }

const user: User = {
  id: "demo-user",
  email: "asha@example.com",
  name: "Asha Rahman",
  is_admin: false,
  education_verified_until: null,
}
const conversations = new Map<string, StoredConversation>()
let projects = seedProjects()
let automations = seedAutomations()
const connectors = seedConnectors()
let skills = seedSkills()
let preferences = seedPreferences()
let memories = seedMemories()
let usedThisMonth = 37
let usedToday = 2

function newId(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
}

/** Past chats at different ages, so the sidebar and Library have something to show. */
function seedHistory(): void {
  const samples: [question: string, ageDays: number, projectId: string | null, starred: boolean][] =
    [
      ["Compare bKash and Nagad for sending money", 0.1, "p-thesis", false],
      ["How did the Padma Bridge change travel to Dhaka?", 1.1, null, true],
      ["Write a Python function to validate a Bangladeshi mobile number", 4, "p-shop", false],
      ["বাংলাদেশের রাজধানী কোথায়?", 12, "p-hsc", false],
    ]
  for (const [question, age, projectId, starred] of samples) {
    const when = daysAgo(age)
    const answer = findDemoAnswer(question)
    const id = newId()
    conversations.set(id, {
      id,
      title: question,
      created_at: when,
      updated_at: when,
      project_id: projectId,
      starred,
      temporary: false,
      messages: [
        message("user", question, when),
        {
          ...message("assistant", answer.text, when),
          sources: citedSources(answer.text, answer.sources),
          model: answer.model,
          route: answer.route,
        },
      ],
    })
  }
}

function message(role: Message["role"], content: string, when: string): Message {
  return { id: newId(), role, content, sources: [], model: null, route: null, created_at: when }
}

function citedSources(text: string, sources: ReturnType<typeof findDemoAnswer>["sources"]) {
  return sources.map((source, index) => ({
    ...source,
    n: index + 1,
    cited: text.includes(`[${index + 1}]`),
  }))
}

function usage(): Usage {
  const pro = (plans as Plan[]).find((plan) => plan.id === "pro")!
  return {
    plan_id: pro.id,
    plan_name: pro.name,
    seats: 1,
    used_today: usedToday,
    used_this_month: usedThisMonth,
    monthly_limit: pro.monthly_queries,
    daily_limit: pro.daily_queries,
    period_ends_at: daysAgo(-18),
    allowed_models: ["anthropic/claude-sonnet-4.5", "google/gemini-2.5-flash"],
    kothora_code: true,
    scholarly_search: false,
    bibliography_export: false,
  }
}

function librarySources(): LibrarySource[] {
  const found: LibrarySource[] = []
  for (const conversation of conversations.values()) {
    if (conversation.temporary) continue
    for (const reply of conversation.messages) {
      for (const source of reply.sources) {
        if (!source.cited) continue
        found.push({
          url: source.url,
          title: source.title,
          snippet: source.snippet,
          kind: source.kind,
          conversation_id: conversation.id,
          conversation_title: conversation.title,
          cited_at: reply.created_at,
        })
      }
    }
  }
  return found.sort((a, b) => b.cited_at.localeCompare(a.cited_at))
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function error(status: number, detail: string): Response {
  return json({ detail }, status)
}

const noContent = () => new Response(null, { status: 204 })

function summary({
  messages: _messages,
  temporary: _temporary,
  ...conversation
}: StoredConversation): Conversation {
  return conversation
}

/** Apply a JSON patch to the item with `id` in a list; 404 when it is missing. */
function patchIn<T extends { id: string }>(list: T[], id: string, changes: Partial<T>): Response {
  const item = list.find((entry) => entry.id === id)
  if (!item) return error(404, "Not found")
  Object.assign(item, changes)
  return json(item)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Stream an answer the way the backend does: meta, delta..., done. */
function answerStream(
  conversation: StoredConversation,
  question: string,
  webSearch: boolean,
  signal?: AbortSignal | null,
) {
  const answer = findDemoAnswer(question)
  const sources = webSearch ? answer.sources : []
  const text = webSearch ? answer.text : answer.text.replace(/\[\d{1,2}\]/g, "")
  const encoder = new TextEncoder()
  const event = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  const numbered = sources.map((source, index) => ({ ...source, n: index + 1 }))

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const aborted = () => signal?.aborted ?? false
      signal?.addEventListener("abort", () =>
        controller.error(new DOMException("The user aborted a request.", "AbortError")),
      )
      if (webSearch) await sleep(SEARCH_DELAY_MS)
      if (aborted()) return
      controller.enqueue(
        event({
          type: "meta",
          route: answer.route,
          model: answer.model,
          category: "simple",
          sources: numbered,
        }),
      )
      // Word-sized chunks, like a model streaming tokens.
      for (const chunk of text.match(/\S+\s*|\s+/g) ?? []) {
        if (aborted()) return
        controller.enqueue(event({ type: "delta", text: chunk }))
        await sleep(STREAM_CHUNK_DELAY_MS)
      }
      const now = new Date().toISOString()
      const reply: Message = {
        ...message("assistant", text, now),
        sources: citedSources(text, sources),
        model: answer.model,
        route: answer.route,
      }
      conversation.messages.push(reply)
      conversation.updated_at = now
      controller.enqueue(
        event({
          type: "done",
          message_id: reply.id,
          title: conversation.title,
          sources: reply.sources,
          route: reply.route,
          model: reply.model,
        }),
      )
      controller.close()
    },
  })
}

type Request = {
  method: string
  body: Record<string, any>
  params: string[]
  signal?: AbortSignal | null
}
type Route = [method: string, pattern: RegExp, handler: (request: Request) => Response]

const ROUTES: Route[] = [
  ["POST", /^\/api\/auth\/(login|register)$/, () => json({ access_token: "demo-token" })],
  ["GET", /^\/api\/auth\/me$/, () => json(user)],
  [
    "PATCH",
    /^\/api\/auth\/me$/,
    ({ body }) => json(Object.assign(user, { name: String(body.name ?? user.name) })),
  ],
  ["GET", /^\/api\/account\/usage$/, () => json(usage())],
  [
    "GET",
    /^\/api\/account\/payments$/,
    () =>
      json([
        {
          tran_id: "KTH-DEMO-0001",
          plan_id: "pro",
          cycle: "monthly",
          seats: 1,
          amount_bdt: 1500,
          status: "paid",
          gateway_card_type: "BKASH-BKash",
          created_at: daysAgo(12),
        },
      ]),
  ],
  ["GET", /^\/api\/account\/preferences$/, () => json(preferences)],
  [
    "PUT",
    /^\/api\/account\/preferences$/,
    ({ body }) => json((preferences = { ...preferences, ...body })),
  ],
  ["GET", /^\/api\/account\/memories$/, () => json(memories)],
  [
    "DELETE",
    /^\/api\/account\/memories\/([\w-]+)$/,
    ({ params }) => {
      memories = memories.filter((memory) => memory.id !== params[0])
      return noContent()
    },
  ],
  ["GET", /^\/api\/billing\/plans$/, () => json(plans)],
  [
    "POST",
    /^\/api\/billing\/checkout$/,
    () => error(503, "Payments are turned off in the demo. The live app opens SSLCommerz here."),
  ],

  [
    "GET",
    /^\/api\/conversations$/,
    () =>
      json(
        Array.from(conversations.values())
          .filter((c) => !c.temporary)
          .map(summary),
      ),
  ],
  [
    "POST",
    /^\/api\/conversations$/,
    ({ body }) => {
      const now = new Date().toISOString()
      const conversation: StoredConversation = {
        id: newId(),
        title: "New chat",
        created_at: now,
        updated_at: now,
        project_id: body.project_id ?? null,
        starred: false,
        temporary: Boolean(body.temporary),
        messages: [],
      }
      conversations.set(conversation.id, conversation)
      return json(summary(conversation), 201)
    },
  ],
  [
    "GET",
    /^\/api\/conversations\/([\w-]+)$/,
    ({ params }) => {
      const conversation = conversations.get(params[0])
      return conversation
        ? json({ ...summary(conversation), messages: conversation.messages })
        : error(404, "Conversation not found")
    },
  ],
  [
    "PATCH",
    /^\/api\/conversations\/([\w-]+)$/,
    ({ params, body }) => {
      const conversation = conversations.get(params[0])
      if (!conversation) return error(404, "Conversation not found")
      for (const field of ["title", "starred", "project_id"] as const) {
        if (field in body) Object.assign(conversation, { [field]: body[field] })
      }
      return json(summary(conversation))
    },
  ],
  [
    "DELETE",
    /^\/api\/conversations\/([\w-]+)$/,
    ({ params }) => {
      conversations.delete(params[0])
      return noContent()
    },
  ],
  [
    "POST",
    /^\/api\/conversations\/([\w-]+)\/messages$/,
    ({ params, body, signal }) => {
      const conversation = conversations.get(params[0])
      if (!conversation) return error(404, "Conversation not found")
      const question = String(body.content ?? "").trim()
      if (!question) return error(422, "Write a question first")
      const now = new Date().toISOString()
      if (conversation.messages.length === 0)
        conversation.title = question.split("\n")[0].slice(0, 60)
      conversation.messages.push(message("user", question, now))
      usedThisMonth++
      usedToday++
      return new Response(answerStream(conversation, question, body.web_search !== false, signal), {
        headers: { "Content-Type": "text/event-stream" },
      })
    },
  ],

  ["GET", /^\/api\/projects$/, () => json(projects)],
  [
    "POST",
    /^\/api\/projects$/,
    ({ body }) => {
      const now = new Date().toISOString()
      const project = {
        id: newId(),
        name: String(body.name),
        instructions: "",
        pinned: false,
        created_at: now,
        updated_at: now,
      }
      projects = [project, ...projects]
      return json(project, 201)
    },
  ],
  [
    "PATCH",
    /^\/api\/projects\/([\w-]+)$/,
    ({ params, body }) =>
      patchIn(projects, params[0], { ...body, updated_at: new Date().toISOString() }),
  ],
  [
    "DELETE",
    /^\/api\/projects\/([\w-]+)$/,
    ({ params }) => {
      projects = projects.filter((project) => project.id !== params[0])
      for (const conversation of conversations.values()) {
        if (conversation.project_id === params[0]) conversation.project_id = null
      }
      return noContent()
    },
  ],

  ["GET", /^\/api\/library\/sources$/, () => json(librarySources())],

  ["GET", /^\/api\/automations$/, () => json(automations)],
  [
    "POST",
    /^\/api\/automations$/,
    ({ body }) => {
      const automation = {
        id: newId(),
        title: String(body.title),
        prompt: String(body.prompt),
        frequency: body.frequency,
        time: String(body.time),
        enabled: true,
        next_run_at: daysAgo(-1),
        last_run_at: null,
      }
      automations = [automation, ...automations]
      return json(automation, 201)
    },
  ],
  [
    "PATCH",
    /^\/api\/automations\/([\w-]+)$/,
    ({ params, body }) =>
      patchIn(automations, params[0], {
        ...body,
        next_run_at: body.enabled === false ? null : daysAgo(-1),
      }),
  ],
  [
    "DELETE",
    /^\/api\/automations\/([\w-]+)$/,
    ({ params }) => {
      automations = automations.filter((automation) => automation.id !== params[0])
      return noContent()
    },
  ],

  ["GET", /^\/api\/connectors$/, () => json(connectors)],
  [
    "PUT",
    /^\/api\/connectors\/([\w-]+)\/connection$/,
    ({ params }) => patchIn(connectors, params[0], { connected: true }),
  ],
  [
    "DELETE",
    /^\/api\/connectors\/([\w-]+)\/connection$/,
    ({ params }) => patchIn(connectors, params[0], { connected: false }),
  ],

  ["GET", /^\/api\/skills$/, () => json(skills)],
  [
    "POST",
    /^\/api\/skills$/,
    ({ body }) => {
      const skill = {
        id: newId(),
        name: String(body.name),
        description: String(body.description ?? ""),
        instructions: String(body.instructions ?? ""),
        author: "me" as const,
        installed: true,
      }
      skills = [...skills, skill]
      return json(skill, 201)
    },
  ],
  [
    "PATCH",
    /^\/api\/skills\/([\w-]+)$/,
    ({ params, body }) => patchIn(skills, params[0], { installed: Boolean(body.installed) }),
  ],
  [
    "DELETE",
    /^\/api\/skills\/([\w-]+)$/,
    ({ params }) => {
      skills = skills.filter((skill) => skill.id !== params[0] || skill.author !== "me")
      return noContent()
    },
  ],
]

function handle(path: string, init: RequestInit): Response {
  const method = (init.method ?? "GET").toUpperCase()
  const body = typeof init.body === "string" && init.body ? JSON.parse(init.body) : {}
  const [route] = path.split("?")
  for (const [routeMethod, pattern, handler] of ROUTES) {
    const match = pattern.exec(route)
    if (match && routeMethod === method) {
      return handler({ method, body, params: match.slice(1), signal: init.signal })
    }
  }
  return error(404, "Not Found")
}

/** Route every /api request to the in-browser backend; everything else goes to the network. */
export function installDemoBackend(): void {
  seedHistory()
  const networkFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    // A fixed base: sandboxed frames have an opaque origin that URL() cannot resolve against.
    const { pathname, search } = new URL(url, "http://demo.invalid")
    if (!pathname.startsWith("/api/")) return networkFetch(input, init)
    return handle(pathname + search, init)
  }
}
