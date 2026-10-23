import {
  createEffect,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  Show,
  Switch,
  type JSX,
} from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useApp } from "../../app-context"
import { ApiError, api, streamMessage } from "../../lib/api"
import { navigate } from "../../lib/router"
import type { ChatEvent, Focus, Reasoning, ThreadMessage } from "../../lib/types"
import { Icon } from "../ui/Icon"
import { Composer } from "./Composer"
import { AssistantMessage, UserMessage } from "./Messages"

/** Within this distance of the bottom, new text keeps the view pinned to the latest line. */
const STICK_TO_BOTTOM_PX = 96

type TurnError = { message: string; quota: boolean; question: string }

export function ChatView(props: {
  conversationId: string | null
  onConversationCreated: (id: string) => void
}) {
  const app = useApp()
  const [thread, setThread] = createStore<{ messages: ThreadMessage[] }>({ messages: [] })
  const [focus, setFocus] = createSignal<Focus>("web")
  const [model, setModel] = createSignal("")
  const [reasoning, setReasoning] = createSignal<Reasoning>("standard")
  const [skillId, setSkillId] = createSignal<string | null>(null)
  const [streaming, setStreaming] = createSignal(false)
  const [error, setError] = createSignal<TurnError | null>(null)
  const [loadError, setLoadError] = createSignal("")
  const [atBottom, setAtBottom] = createSignal(true)
  let scroller: HTMLDivElement | undefined
  let abort: AbortController | undefined
  // The conversation the current turn writes to; selecting it must not reload it.
  let turnConversationId: string | null = null

  const isEmpty = () => thread.messages.length === 0 && !loadError()
  const projectId = () =>
    props.conversationId
      ? (app.conversations()?.find((c) => c.id === props.conversationId)?.project_id ?? null)
      : app.pendingProjectId()
  const projectName = () => app.projects()?.find((p) => p.id === projectId())?.name
  const usage = () => app.usage()
  const showPlans = () => navigate({ name: "plans" })

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && streaming()) abort?.abort()
  }
  document.addEventListener("keydown", onKey)
  onCleanup(() => {
    document.removeEventListener("keydown", onKey)
    abort?.abort()
  })

  createEffect(
    on(
      () => props.conversationId,
      async (id) => {
        if (id && id === turnConversationId) return
        abort?.abort()
        setError(null)
        setLoadError("")
        setThread("messages", [])
        if (!id) return
        try {
          const detail = await api.conversation(id)
          // Ignore a slow response for a conversation the user has already left.
          if (props.conversationId !== id) return
          setThread("messages", detail.messages)
          scrollToBottom("auto")
        } catch (err) {
          setLoadError(describe(err))
        }
      },
    ),
  )

  // Follow the answer as it streams, unless the reader has scrolled up to read.
  createEffect(
    on(
      () => [thread.messages.length, thread.messages[thread.messages.length - 1]?.content],
      () => {
        if (atBottom()) scrollToBottom("auto")
      },
      { defer: true },
    ),
  )

  function scrollToBottom(behavior: ScrollBehavior) {
    queueMicrotask(() => scroller?.scrollTo({ top: scroller.scrollHeight, behavior }))
  }

  function onScroll() {
    if (!scroller) return
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    setAtBottom(distance < STICK_TO_BOTTOM_PX)
  }

  function updatePending(change: (message: ThreadMessage) => void) {
    setThread(
      "messages",
      (message) => message.phase !== undefined && message.phase !== "done",
      produce(change),
    )
  }

  function dropPending() {
    setThread("messages", (messages) =>
      messages.filter(
        (message) => message.phase === undefined || message.phase === "done" || message.content,
      ),
    )
    updatePending((message) => (message.phase = "done"))
  }

  function applyEvent(event: ChatEvent) {
    switch (event.type) {
      case "meta":
        // A second meta means the router fell back to another model; start the text again.
        updatePending((message) => {
          message.sources = event.sources
          message.model = event.model
          message.content = ""
          message.phase = "thinking"
        })
        break
      case "notice":
        updatePending((message) => (message.notice = event.message))
        break
      case "delta":
        updatePending((message) => {
          message.content += event.text
          message.phase = "writing"
        })
        break
      case "done":
        updatePending((message) => {
          message.id = event.message_id
          message.sources = event.sources
          message.model = event.model
          message.route = event.route
          message.phase = "done"
        })
        break
      case "error":
        throw new Error(event.message)
    }
  }

  async function send(question: string) {
    if (streaming()) return
    setError(null)
    setStreaming(true)
    setAtBottom(true)
    abort = new AbortController()
    const now = new Date().toISOString()
    const base = { sources: [], model: null, route: null, created_at: now }
    setThread("messages", (messages) => [
      ...messages,
      { ...base, id: `local-user-${Date.now()}`, role: "user", content: question },
      {
        ...base,
        id: `local-answer-${Date.now()}`,
        role: "assistant",
        content: "",
        phase: focus() === "writing" ? "thinking" : "searching",
      },
    ])
    scrollToBottom("smooth")

    try {
      let conversationId = props.conversationId
      if (!conversationId) {
        conversationId = (
          await api.createConversation({
            projectId: app.pendingProjectId(),
            temporary: app.incognito(),
          })
        ).id
        turnConversationId = conversationId
        props.onConversationCreated(conversationId)
      }
      turnConversationId = conversationId
      await streamMessage(
        conversationId,
        question,
        {
          model: model(),
          webSearch: focus() === "web",
          scholarlySearch: focus() === "academic",
          reasoning: reasoning(),
          skillId: skillId(),
          signal: abort.signal,
        },
        applyEvent,
      )
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError"
      if (!aborted) {
        setError({
          message: describe(err),
          quota: err instanceof ApiError && err.status === 429,
          question,
        })
      }
    } finally {
      // A stopped answer keeps what was written so far, as other chat apps do.
      dropPending()
      setStreaming(false)
      turnConversationId = null
      app.refetchConversations()
      app.refetchUsage()
    }
  }

  return (
    <section class="chat" classList={{ "is-empty": isEmpty() }}>
      <div class="thread-scroll" ref={scroller} onScroll={onScroll}>
        <Switch>
          <Match when={isEmpty()}>
            <div class="welcome">
              <h1 class="greeting">
                <Switch fallback="What would you like to know?">
                  <Match when={app.incognito()}>Incognito chat</Match>
                  <Match when={projectName()}>{projectName()}</Match>
                </Switch>
              </h1>
              <Show when={app.incognito() || projectName()}>
                <p class="welcome-sub">
                  {app.incognito()
                    ? "This chat won't be saved to your history."
                    : "Chats here follow this project's instructions."}
                </p>
              </Show>
            </div>
          </Match>
          <Match when={loadError()}>
            <div class="thread">
              <ErrorCard message={`Could not open this chat. ${loadError()}`} />
            </div>
          </Match>
          <Match when={true}>
            <div class="thread">
              <For each={thread.messages}>
                {(message) =>
                  message.role === "user" ? (
                    <UserMessage message={message} />
                  ) : (
                    <AssistantMessage
                      message={message}
                      conversationId={props.conversationId}
                      canExportBibliography={usage()?.bibliography_export ?? false}
                    />
                  )
                }
              </For>
              <Show when={error()}>
                {(current) => (
                  <ErrorCard message={current().message}>
                    <Show
                      when={current().quota}
                      fallback={
                        <button
                          type="button"
                          class="secondary"
                          onClick={() => send(current().question)}
                        >
                          Try again
                        </button>
                      }
                    >
                      <button type="button" class="primary" onClick={showPlans}>
                        See plans
                      </button>
                    </Show>
                  </ErrorCard>
                )}
              </Show>
            </div>
          </Match>
        </Switch>
      </div>

      <div class="composer-dock">
        <Show when={!atBottom() && !isEmpty()}>
          <button
            type="button"
            class="jump-button"
            aria-label="Jump to latest"
            onClick={() => {
              setAtBottom(true)
              scrollToBottom("smooth")
            }}
          >
            <Icon name="arrowDown" size={18} />
          </button>
        </Show>
        <Composer
          streaming={streaming()}
          focus={focus()}
          academicAvailable={usage()?.scholarly_search ?? false}
          onFocusChange={setFocus}
          models={usage()?.allowed_models ?? []}
          model={model()}
          onModelChange={setModel}
          reasoning={reasoning()}
          onReasoningChange={setReasoning}
          skills={(app.skills.error ? [] : (app.skills() ?? [])).filter((s) => s.installed)}
          skillId={skillId()}
          onSkillChange={setSkillId}
          projectName={projectName()}
          incognito={app.incognito()}
          onSubmit={send}
          onStop={() => abort?.abort()}
          placeholder={isEmpty() ? "Ask anything…" : "Ask a follow-up…"}
        />
        <Show when={!isEmpty()}>
          <p class="disclaimer">Kothora can make mistakes. Check the sources.</p>
        </Show>
      </div>
    </section>
  )
}

function ErrorCard(props: { message: string; children?: JSX.Element }) {
  return (
    <div class="error-card" role="alert">
      <Icon name="alert" size={18} />
      <p>{props.message}</p>
      {props.children}
    </div>
  )
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
