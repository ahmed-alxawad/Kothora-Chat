import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js"
import { ApiError, api, streamMessage } from "../lib/api"
import type { Message, Usage } from "../lib/types"
import { MessageView } from "./MessageView"

const PENDING_ID = "pending"

export function ChatView(props: {
  conversationId: string | null
  usage: Usage | undefined
  onConversationCreated: (id: string) => void
  onTurnFinished: () => void
  onShowPlans: () => void
}) {
  const [messages, setMessages] = createSignal<Message[]>([])
  const [draft, setDraft] = createSignal("")
  const [model, setModel] = createSignal("")
  const [webSearch, setWebSearch] = createSignal(true)
  const [scholarly, setScholarly] = createSignal(false)
  const [streaming, setStreaming] = createSignal(false)
  const [notice, setNotice] = createSignal("")
  const [error, setError] = createSignal<{ message: string; quota: boolean } | null>(null)
  let abort: AbortController | undefined
  let bottom: HTMLDivElement | undefined
  // The conversation the current turn is writing to; selecting it must not reload it.
  let turnConversationId: string | null = null

  onCleanup(() => abort?.abort())

  createEffect(
    on(
      () => props.conversationId,
      async (id) => {
        if (id && id === turnConversationId) return
        abort?.abort()
        setError(null)
        setNotice("")
        if (!id) return setMessages([])
        try {
          const detail = await api.conversation(id)
          // Ignore a slow response for a conversation the user has already left.
          if (props.conversationId === id) setMessages(detail.messages)
        } catch (err) {
          setError({ message: describe(err), quota: false })
        }
      },
    ),
  )

  createEffect(on(messages, () => bottom?.scrollIntoView({ block: "end" }), { defer: true }))

  function updatePending(change: (message: Message) => Message) {
    setMessages((all) => all.map((m) => (m.id === PENDING_ID ? change(m) : m)))
  }

  async function send(event: SubmitEvent) {
    event.preventDefault()
    const content = draft().trim()
    if (!content || streaming()) return
    setError(null)
    setNotice("")
    setStreaming(true)
    abort = new AbortController()
    const now = new Date().toISOString()
    const userMessage: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      sources: [],
      model: null,
      route: null,
      created_at: now,
    }
    const pending: Message = { ...userMessage, id: PENDING_ID, role: "assistant", content: "" }
    try {
      let conversationId = props.conversationId
      if (!conversationId) {
        conversationId = (await api.createConversation()).id
        turnConversationId = conversationId
        props.onConversationCreated(conversationId)
      }
      turnConversationId = conversationId
      setMessages((all) => [...all, userMessage, pending])
      setDraft("")
      await streamMessage(
        conversationId,
        content,
        {
          model: model(),
          webSearch: webSearch(),
          scholarlySearch: scholarly(),
          signal: abort.signal,
        },
        (chatEvent) => {
          switch (chatEvent.type) {
            case "meta":
              // A second meta means the router fell back to another model.
              updatePending((m) => ({
                ...m,
                content: "",
                sources: chatEvent.sources,
                model: chatEvent.model,
              }))
              break
            case "notice":
              setNotice(chatEvent.message)
              break
            case "delta":
              updatePending((m) => ({ ...m, content: m.content + chatEvent.text }))
              break
            case "done":
              updatePending((m) => ({
                ...m,
                id: chatEvent.message_id,
                sources: chatEvent.sources,
                model: chatEvent.model,
                route: chatEvent.route,
              }))
              break
            case "error":
              setError({ message: chatEvent.message, quota: false })
              setMessages((all) => all.filter((m) => m.id !== PENDING_ID))
              break
          }
        },
      )
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError({ message: describe(err), quota: err instanceof ApiError && err.status === 429 })
      }
      setMessages((all) => all.filter((m) => m.id !== PENDING_ID))
    } finally {
      setStreaming(false)
      turnConversationId = null
      props.onTurnFinished()
    }
  }

  return (
    <section class="chat">
      <div class="messages">
        <Show when={messages().length === 0}>
          <div class="empty">
            <h2>Ask anything</h2>
            <p class="muted">
              Kothora searches the web and cites its sources, so you can check every claim. Bangla
              or English.
            </p>
          </div>
        </Show>
        <For each={messages()}>
          {(message) => (
            <MessageView
              message={message}
              conversationId={props.conversationId ?? ""}
              canExportBibliography={props.usage?.bibliography_export ?? false}
              streaming={message.id === PENDING_ID}
            />
          )}
        </For>
        <div ref={bottom} />
      </div>
      <Show when={notice()}>
        <p class="notice">{notice()}</p>
      </Show>
      <Show when={error()}>
        {(current) => (
          <p class="error" role="alert">
            {current().message}{" "}
            <Show when={current().quota}>
              <button class="link" onClick={props.onShowPlans}>
                See plans
              </button>
            </Show>
          </p>
        )}
      </Show>
      <form class="composer" onSubmit={send}>
        <textarea
          rows={3}
          placeholder="Ask Kothora…"
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <div class="composer-bar">
          <label class="toggle">
            <input
              type="checkbox"
              checked={webSearch()}
              onChange={(e) => setWebSearch(e.currentTarget.checked)}
            />
            Web search
          </label>
          <Show when={props.usage?.scholarly_search}>
            <label class="toggle">
              <input
                type="checkbox"
                checked={scholarly()}
                onChange={(e) => setScholarly(e.currentTarget.checked)}
              />
              Scholarly search
            </label>
          </Show>
          <Show when={(props.usage?.allowed_models.length ?? 0) > 0}>
            <select
              value={model()}
              onChange={(e) => setModel(e.currentTarget.value)}
              aria-label="Model"
            >
              <option value="">Auto (cheapest that fits)</option>
              <For each={props.usage?.allowed_models}>
                {(id) => <option value={id}>{id}</option>}
              </For>
            </select>
          </Show>
          <Show
            when={streaming()}
            fallback={
              <button class="primary" type="submit" disabled={!draft().trim()}>
                Send
              </button>
            }
          >
            <button type="button" onClick={() => abort?.abort()}>
              Stop
            </button>
          </Show>
        </div>
      </form>
    </section>
  )
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
