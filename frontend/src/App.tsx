import { createResource, createSignal, onCleanup, onMount, Show } from "solid-js"
import { ChatView } from "./components/ChatView"
import { PlansView } from "./components/PlansView"
import { Sidebar } from "./components/Sidebar"
import { AuthForm } from "./components/AuthForm"
import { ApiError, api, getToken, setToken } from "./lib/api"

type View = "chat" | "plans"

function viewFromLocation(): View {
  return window.location.pathname.startsWith("/billing") ? "plans" : "chat"
}

export function App() {
  const [signedIn, setSignedIn] = createSignal(Boolean(getToken()))
  const [view, setView] = createSignal<View>(viewFromLocation())
  const [activeId, setActiveId] = createSignal<string | null>(null)
  const paymentResult = new URLSearchParams(window.location.search).get("payment")

  const [user] = createResource(signedIn, async () => {
    try {
      return await api.me()
    } catch (err) {
      // An expired token sends the user back to the sign-in form.
      if (err instanceof ApiError && err.status === 401) signOut()
      throw err
    }
  })
  const [usage, { refetch: refetchUsage }] = createResource(signedIn, api.usage)
  const [conversations, { refetch: refetchConversations }] = createResource(
    signedIn,
    api.conversations,
  )

  const onPopState = () => setView(viewFromLocation())
  onMount(() => window.addEventListener("popstate", onPopState))
  onCleanup(() => window.removeEventListener("popstate", onPopState))

  function navigate(next: View) {
    window.history.pushState(null, "", next === "plans" ? "/billing" : "/")
    setView(next)
  }

  function signOut() {
    setToken(null)
    setActiveId(null)
    setSignedIn(false)
  }

  async function deleteConversation(id: string) {
    await api.deleteConversation(id)
    if (activeId() === id) setActiveId(null)
    refetchConversations()
  }

  return (
    <Show when={signedIn()} fallback={<AuthForm onSignedIn={() => setSignedIn(true)} />}>
      <div class="layout">
        <Sidebar
          user={user()}
          usage={usage()}
          conversations={conversations() ?? []}
          activeId={activeId()}
          onSelect={(id) => {
            setActiveId(id)
            navigate("chat")
          }}
          onDelete={deleteConversation}
          onShowPlans={() => navigate("plans")}
          onSignOut={signOut}
        />
        <main class="main">
          <Show
            when={view() === "chat"}
            fallback={<PlansView usage={usage()} paymentResult={paymentResult} />}
          >
            <ChatView
              conversationId={activeId()}
              usage={usage()}
              onConversationCreated={(id) => {
                setActiveId(id)
                refetchConversations()
              }}
              onTurnFinished={() => {
                refetchConversations()
                refetchUsage()
              }}
              onShowPlans={() => navigate("plans")}
            />
          </Show>
        </main>
      </div>
    </Show>
  )
}
