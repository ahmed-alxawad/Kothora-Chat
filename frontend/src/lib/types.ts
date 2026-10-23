export type Source = {
  n: number
  title: string
  url: string
  snippet: string
  kind: "web" | "scholarly"
  authors: string[]
  year: number | null
  doi: string | null
  cited?: boolean
}

export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  sources: Source[]
  model: string | null
  route: string | null
  created_at: string
}

export type Conversation = {
  id: string
  title: string
  created_at: string
  updated_at: string
  // Planned backend fields (docs/frontend-api-contract.md); absent on the current API.
  project_id?: string | null
  starred?: boolean
}

export type ConversationDetail = Conversation & { messages: Message[] }

export type User = {
  id: string
  email: string
  name: string
  is_admin: boolean
  education_verified_until: string | null
}

export type Usage = {
  plan_id: string
  plan_name: string
  seats: number
  used_today: number
  used_this_month: number
  monthly_limit: number
  daily_limit: number | null
  period_ends_at: string | null
  allowed_models: string[]
  kothora_code: boolean
  scholarly_search: boolean
  bibliography_export: boolean
}

export type BillingCycle = "monthly" | "quarterly" | "yearly"

export type Plan = {
  id: string
  name: string
  audience: string
  features: string[]
  monthly_bdt: number | null
  monthly_queries: number
  daily_queries: number | null
  per_seat: boolean
  min_seats: number
  requires_verification: boolean
  purchasable: boolean
  prices: { cycle: BillingCycle; total_bdt: number; per_month_bdt: number }[]
}

export type ChatEvent =
  | { type: "meta"; route: string; model: string; category: string; sources: Source[] }
  | { type: "notice"; message: string }
  | { type: "delta"; text: string }
  | {
      type: "done"
      message_id: string
      title: string
      sources: Source[]
      route: string
      model: string
    }
  | { type: "error"; message: string }

/** What the thread view tracks per answer while it streams. */
export type AnswerPhase = "searching" | "thinking" | "writing" | "done"

export type ThreadMessage = Message & {
  phase?: AnswerPhase
  notice?: string
}

/** Where an answer should look: the web, scholarly literature, or nowhere (writing help). */
export type Focus = "web" | "academic" | "writing"

/*
 * Features below are served by the demo backend today and are specified for the real
 * backend in docs/frontend-api-contract.md. Against a server without them, the pages
 * say the feature is not available yet.
 */

export type Project = {
  id: string
  name: string
  instructions: string
  pinned: boolean
  created_at: string
  updated_at: string
}

export type LibrarySource = {
  url: string
  title: string
  snippet: string
  kind: "web" | "scholarly"
  conversation_id: string
  conversation_title: string
  cited_at: string
}

export type Frequency = "daily" | "weekdays" | "weekly"

export type Automation = {
  id: string
  title: string
  prompt: string
  frequency: Frequency
  /** Local time in Bangladesh, "HH:MM". */
  time: string
  enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
}

export type Connector = {
  id: string
  name: string
  description: string
  category: string
  connected: boolean
}

export type Skill = {
  id: string
  name: string
  description: string
  instructions: string
  author: "kothora" | "me"
  installed: boolean
}

export type ResponseLanguage = "auto" | "en" | "bn"

export type Preferences = {
  response_language: ResponseLanguage
  about_me: string
  instructions: string
  memory_enabled: boolean
}

export type Memory = { id: string; text: string; created_at: string }

export type Reasoning = "standard" | "extended"

export type Payment = {
  tran_id: string
  plan_id: string
  cycle: string
  seats: number
  amount_bdt: number
  status: string
  gateway_card_type: string | null
  created_at: string
}
