/**
 * An in-browser stand-in for the Kothora API, used only by the demo build. It answers
 * the same routes with the same JSON and Server-Sent Events as the FastAPI backend,
 * so the app runs unchanged against it. Data lives in memory and resets on reload.
 */
import { findDemoAnswer } from "./answers"
import plans from "./plans.json"
import type { Conversation, Message, Plan, Usage, User } from "../lib/types"

const DEMO_USER: User = {
  id: "demo-user",
  email: "asha@example.com",
  name: "Asha Rahman",
  is_admin: false,
  education_verified_until: null,
}

const HOUR_MS = 60 * 60 * 1000
const STREAM_CHUNK_DELAY_MS = 18
const SEARCH_DELAY_MS = 700

type StoredConversation = Conversation & { messages: Message[] }

const conversations = new Map<string, StoredConversation>()
let usedThisMonth = 37
let usedToday = 2

function newId(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
}

/** Past chats at different ages, so the sidebar shows its date groups. */
function seedHistory(): void {
  const samples: [string, number][] = [
    ["Compare bKash and Nagad for sending money", 2 * HOUR_MS],
    ["How did the Padma Bridge change travel to Dhaka?", 26 * HOUR_MS],
    ["Write a Python function to validate a Bangladeshi mobile number", 4 * 24 * HOUR_MS],
    ["বাংলাদেশের রাজধানী কোথায়?", 12 * 24 * HOUR_MS],
  ]
  for (const [question, age] of samples) {
    const when = new Date(Date.now() - age).toISOString()
    const answer = findDemoAnswer(question)
    const id = newId()
    conversations.set(id, {
      id,
      title: question,
      created_at: when,
      updated_at: when,
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
    period_ends_at: new Date(Date.now() + 18 * 24 * HOUR_MS).toISOString(),
    allowed_models: ["anthropic/claude-sonnet-4.5", "google/gemini-2.5-flash"],
    kothora_code: true,
    scholarly_search: false,
    bibliography_export: false,
  }
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

function summary({ messages: _messages, ...conversation }: StoredConversation): Conversation {
  return conversation
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

async function handle(path: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase()
  const body = typeof init.body === "string" && init.body ? JSON.parse(init.body) : {}
  const [route] = path.split("?")

  if (route === "/api/auth/login" || route === "/api/auth/register")
    return json({ access_token: "demo-token" })
  if (route === "/api/auth/me") return json(DEMO_USER)
  if (route === "/api/account/usage") return json(usage())
  if (route === "/api/billing/plans") return json(plans)
  if (route === "/api/billing/checkout")
    return error(503, "Payments are turned off in the demo. The live app opens SSLCommerz here.")

  if (route === "/api/conversations") {
    if (method === "POST") {
      const now = new Date().toISOString()
      const conversation: StoredConversation = {
        id: newId(),
        title: "New chat",
        created_at: now,
        updated_at: now,
        messages: [],
      }
      conversations.set(conversation.id, conversation)
      return json(summary(conversation), 201)
    }
    return json(Array.from(conversations.values(), summary))
  }

  const match = /^\/api\/conversations\/([\w-]+)(\/messages)?$/.exec(route)
  const conversation = match ? conversations.get(match[1]) : undefined
  if (!match || !conversation) return error(404, "Conversation not found")

  if (match[2] && method === "POST") {
    const question = String(body.content ?? "").trim()
    if (!question) return error(422, "Write a question first")
    const now = new Date().toISOString()
    if (conversation.messages.length === 0) conversation.title = question.slice(0, 60)
    conversation.messages.push(message("user", question, now))
    usedThisMonth++
    usedToday++
    return new Response(
      answerStream(conversation, question, body.web_search !== false, init.signal),
      {
        headers: { "Content-Type": "text/event-stream" },
      },
    )
  }
  if (method === "PATCH") {
    conversation.title = String(body.title ?? conversation.title)
    return json(summary(conversation))
  }
  if (method === "DELETE") {
    conversations.delete(conversation.id)
    return new Response(null, { status: 204 })
  }
  return json({ ...summary(conversation), messages: conversation.messages })
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
