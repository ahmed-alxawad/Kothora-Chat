import { SseParser } from "./sse"
import type {
  BillingCycle,
  ChatEvent,
  Conversation,
  ConversationDetail,
  Plan,
  Usage,
  User,
} from "./types"

const TOKEN_KEY = "kothora.token"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

// The token is kept in memory as well as in localStorage, so a session still works for
// this visit when storage is blocked (private browsing, sandboxed frames).
let memoryToken: string | null = null

export function getToken(): string | null {
  if (memoryToken) return memoryToken
  try {
    memoryToken = localStorage.getItem(TOKEN_KEY)
  } catch {
    // Storage is blocked; only the in-memory token exists.
  }
  return memoryToken
}

export function setToken(token: string | null): void {
  memoryToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage is blocked: the session lasts until the page is closed or reloaded.
  }
}

let unauthorizedHandler: (() => void) | null = null

/** Called when the API rejects the session (expired or revoked token). */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  const response = await fetch(path, { ...init, headers })
  if (response.status === 401 && token) unauthorizedHandler?.()
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response))
  return response
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body.detail === "string") return body.detail
    if (Array.isArray(body.detail)) return body.detail.map((d: { msg: string }) => d.msg).join("; ")
  } catch {
    // Not JSON; fall through to the status text.
  }
  return `${response.status} ${response.statusText}`
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  return (await send(path, init)).json() as Promise<T>
}

export const api = {
  register: (email: string, name: string, password: string) =>
    json<{ access_token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    }),
  login: (email: string, password: string) =>
    json<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => json<User>("/api/auth/me"),
  usage: () => json<Usage>("/api/account/usage"),
  plans: () => json<Plan[]>("/api/billing/plans"),
  checkout: (planId: string, cycle: BillingCycle, seats: number) =>
    json<{ gateway_url: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan_id: planId, cycle, seats }),
    }),
  conversations: () => json<Conversation[]>("/api/conversations"),
  createConversation: () => json<Conversation>("/api/conversations", { method: "POST" }),
  conversation: (id: string) => json<ConversationDetail>(`/api/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    json<Conversation>(`/api/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  deleteConversation: (id: string) => send(`/api/conversations/${id}`, { method: "DELETE" }),
  bibliography: async (conversationId: string, messageId: string, format: "bibtex" | "text") => {
    const path = `/api/conversations/${conversationId}/messages/${messageId}/bibliography`
    return (await send(`${path}?format=${format}`)).text()
  },
}

export type SendOptions = {
  model?: string
  webSearch: boolean
  scholarlySearch: boolean
  signal?: AbortSignal
}

/** Send a message and call onEvent for each streamed event. */
export async function streamMessage(
  conversationId: string,
  content: string,
  options: SendOptions,
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const response = await send(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content,
      model: options.model || null,
      web_search: options.webSearch,
      scholarly_search: options.scholarlySearch,
    }),
    signal: options.signal,
  })
  if (!response.body) throw new Error("This browser cannot read streamed responses")
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  const parser = new SseParser()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    for (const event of parser.push(value)) onEvent(event)
  }
}
