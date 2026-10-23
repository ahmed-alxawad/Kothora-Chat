import { For, Show } from "solid-js"
import type { Conversation, Usage, User } from "../lib/types"

export function Sidebar(props: {
  user: User | undefined
  usage: Usage | undefined
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
  onShowPlans: () => void
  onSignOut: () => void
}) {
  return (
    <aside class="sidebar">
      <div class="brand-row">
        <span class="brand">Kothora</span>
      </div>
      <button class="primary" onClick={() => props.onSelect(null)}>
        New chat
      </button>
      <nav class="conversation-list" aria-label="Conversations">
        <For each={props.conversations}>
          {(conversation) => (
            <div class="conversation" classList={{ active: conversation.id === props.activeId }}>
              <button class="title" onClick={() => props.onSelect(conversation.id)}>
                {conversation.title}
              </button>
              <button
                class="icon"
                aria-label={`Delete ${conversation.title}`}
                onClick={() => {
                  if (confirm(`Delete "${conversation.title}"?`)) props.onDelete(conversation.id)
                }}
              >
                ×
              </button>
            </div>
          )}
        </For>
      </nav>
      <Show when={props.usage}>
        {(usage) => <UsageMeter usage={usage()} onShowPlans={props.onShowPlans} />}
      </Show>
      <div class="account">
        <span class="muted small">{props.user?.email}</span>
        <button class="link" onClick={props.onSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  )
}

function UsageMeter(props: { usage: Usage; onShowPlans: () => void }) {
  const percent = () =>
    Math.min(100, Math.round((props.usage.used_this_month / props.usage.monthly_limit) * 100))
  return (
    <div class="usage">
      <div class="usage-head">
        <strong>{props.usage.plan_name}</strong>
        <button class="link" onClick={props.onShowPlans}>
          {props.usage.plan_id === "free" ? "Upgrade" : "Plans"}
        </button>
      </div>
      <div
        class="meter"
        role="meter"
        aria-valuenow={percent()}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${percent()}%` }} />
      </div>
      <span class="muted small">
        {props.usage.used_this_month} / {props.usage.monthly_limit} queries this month
        <Show when={props.usage.daily_limit !== null}>
          {" "}
          · {props.usage.used_today} / {props.usage.daily_limit} today
        </Show>
      </span>
    </div>
  )
}
