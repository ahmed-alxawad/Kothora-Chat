import { createResource, createSignal, Match, onCleanup, Show, Switch } from "solid-js"
import { AuthView } from "./components/auth/AuthView"
import { ChatView } from "./components/chat/ChatView"
import { Sidebar } from "./components/layout/Sidebar"
import { TopBar } from "./components/layout/TopBar"
import { PlansView } from "./components/plans/PlansView"
import { IS_DEMO } from "./env"
import { api, getToken, onUnauthorized, setToken } from "./lib/api"
import { navigate, route } from "./lib/router"

const MOBILE_QUERY = "(max-width: 860px)"
const SIDEBAR_KEY = "kothora.sidebar"

function initialSidebarOpen(): boolean {
  if (window.matchMedia(MOBILE_QUERY).matches) return false
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== "closed"
  } catch {
    return true
  }
}

export function App() {
  const [signedIn, setSignedIn] = createSignal(Boolean(getToken()))
  const [sidebarOpen, setSidebarOpenSignal] = createSignal(initialSidebarOpen())
  const [model, setModel] = createSignal("")
  const paymentResult = new URLSearchParams(window.location.search).get("payment")
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches

  const [user] = createResource(signedIn, api.me)
  // Any request rejected for an expired or revoked session returns the user to sign in.
  onUnauthorized(() => signOut())
  const [usage, { refetch: refetchUsage }] = createResource(signedIn, api.usage)
  const [conversations, { refetch: refetchConversations, mutate: setConversations }] =
    createResource(signedIn, api.conversations)

  const activeId = () => {
    const current = route()
    return current.name === "chat" ? current.conversationId : null
  }

  function setSidebarOpen(open: boolean) {
    setSidebarOpenSignal(open)
    if (isMobile()) return
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed")
    } catch {
      // Storage may be blocked; the choice then lasts for this visit.
    }
  }

  function closeSidebarOnMobile() {
    if (isMobile()) setSidebarOpen(false)
  }

  function newChat() {
    navigate({ name: "chat", conversationId: null })
    closeSidebarOnMobile()
  }

  function signOut() {
    setToken(null)
    setSignedIn(false)
    navigate({ name: "chat", conversationId: null }, { replace: true })
  }

  async function renameConversation(id: string, title: string) {
    const updated = await api.renameConversation(id, title)
    setConversations((all) => all?.map((c) => (c.id === id ? updated : c)))
  }

  async function deleteConversation(id: string) {
    await api.deleteConversation(id)
    setConversations((all) => all?.filter((c) => c.id !== id))
    if (activeId() === id) navigate({ name: "chat", conversationId: null }, { replace: true })
  }

  // Shortcuts from ChatGPT: Ctrl/Cmd+Shift+O new chat, Ctrl/Cmd+Shift+S toggle the sidebar.
  const onKey = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return
    const key = event.key.toLowerCase()
    if (key === "o") {
      event.preventDefault()
      newChat()
    } else if (key === "s") {
      event.preventDefault()
      setSidebarOpen(!sidebarOpen())
    }
  }
  document.addEventListener("keydown", onKey)
  onCleanup(() => document.removeEventListener("keydown", onKey))

  return (
    <Show when={signedIn()} fallback={<AuthView onSignedIn={() => setSignedIn(true)} />}>
      <div class="app" classList={{ "sidebar-open": sidebarOpen() }}>
        <Sidebar
          open={sidebarOpen()}
          conversations={conversations() ?? []}
          activeId={activeId()}
          user={user()}
          usage={usage()}
          onClose={() => setSidebarOpen(false)}
          onNewChat={newChat}
          onSelect={(id) => {
            navigate({ name: "chat", conversationId: id })
            closeSidebarOnMobile()
          }}
          onRename={renameConversation}
          onDelete={deleteConversation}
          onShowPlans={() => {
            navigate({ name: "plans" })
            closeSidebarOnMobile()
          }}
          onSignOut={signOut}
        />
        <Show when={sidebarOpen()}>
          <div class="scrim" aria-hidden="true" onClick={() => setSidebarOpen(false)} />
        </Show>

        <main class="main">
          <Show when={IS_DEMO}>
            <p class="demo-banner">
              Demo with sample answers. Search, models and payments are simulated.
            </p>
          </Show>
          <TopBar
            sidebarOpen={sidebarOpen()}
            usage={usage()}
            model={model()}
            onModelChange={setModel}
            onOpenSidebar={() => setSidebarOpen(true)}
            onNewChat={newChat}
            onShowPlans={() => navigate({ name: "plans" })}
          />
          <Switch>
            <Match when={route().name === "plans"}>
              <div class="page-scroll">
                <PlansView usage={usage()} paymentResult={paymentResult} />
              </div>
            </Match>
            <Match when={route().name === "chat"}>
              <ChatView
                conversationId={activeId()}
                user={user()}
                usage={usage()}
                model={model()}
                onConversationCreated={(id) => {
                  navigate({ name: "chat", conversationId: id }, { replace: true })
                  refetchConversations()
                }}
                onTurnFinished={() => {
                  refetchConversations()
                  refetchUsage()
                }}
                onShowPlans={() => navigate({ name: "plans" })}
              />
            </Match>
          </Switch>
        </main>
      </div>
    </Show>
  )
}
