import { createSignal, Match, onCleanup, Show, Switch } from "solid-js"
import { AppContext, type AppState, type SettingsSection } from "./app-context"
import { AuthView } from "./components/auth/AuthView"
import { ChatView } from "./components/chat/ChatView"
import { SearchDialog } from "./components/layout/SearchDialog"
import { ShortcutsDialog } from "./components/layout/ShortcutsDialog"
import { Sidebar } from "./components/layout/Sidebar"
import { TopBar } from "./components/layout/TopBar"
import { AutomationsPage } from "./components/pages/AutomationsPage"
import { CodePage } from "./components/pages/CodePage"
import { LibraryPage } from "./components/pages/LibraryPage"
import { PlansView } from "./components/pages/PlansView"
import { PluginsPage } from "./components/pages/PluginsPage"
import { ProjectPage } from "./components/pages/ProjectPage"
import { ProjectsPage } from "./components/pages/ProjectsPage"
import { SettingsDialog } from "./components/settings/SettingsDialog"
import { Toaster } from "./components/ui/Toaster"
import { IS_DEMO } from "./env"
import { api, getToken, onUnauthorized, setToken } from "./lib/api"
import { safeResource } from "./lib/resource"
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
  return (
    <Show when={signedIn()} fallback={<AuthView onSignedIn={() => setSignedIn(true)} />}>
      <SignedInApp
        onSignOut={() => {
          setToken(null)
          setSignedIn(false)
          navigate({ name: "chat", conversationId: null }, { replace: true })
        }}
      />
    </Show>
  )
}

function SignedInApp(props: { onSignOut: () => void }) {
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches
  const [sidebarOpen, setSidebarOpenSignal] = createSignal(initialSidebarOpen())
  const [settings, setSettings] = createSignal<SettingsSection | null>(null)
  const [searchOpen, setSearchOpen] = createSignal(false)
  const [shortcutsOpen, setShortcutsOpen] = createSignal(false)
  const [incognito, setIncognito] = createSignal(false)
  const [pendingProjectId, setPendingProjectId] = createSignal<string | null>(null)
  const paymentResult = new URLSearchParams(window.location.search).get("payment")

  const [user, { mutate: setUser }] = safeResource(api.me)
  const [usage, { refetch: refetchUsage }] = safeResource(api.usage)
  const [conversations, { refetch: refetchConversations }] = safeResource(api.conversations)
  const [projects, { refetch: refetchProjects }] = safeResource(api.projects)
  const [skills, { refetch: refetchSkills }] = safeResource(api.skills)

  // Any request rejected for an expired or revoked session returns the user to sign in.
  onUnauthorized(props.onSignOut)

  function setSidebarOpen(open: boolean) {
    setSidebarOpenSignal(open)
    if (isMobile()) return
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed")
    } catch {
      // Storage may be blocked; the choice then lasts for this visit.
    }
  }
  const closeSidebarOnMobile = () => isMobile() && setSidebarOpen(false)

  const state: AppState = {
    user,
    usage,
    conversations,
    projects,
    skills,
    updateUser: (next) => setUser(next),
    refetchConversations,
    refetchUsage,
    refetchProjects,
    refetchSkills,
    incognito,
    setIncognito,
    pendingProjectId,
    setPendingProjectId,
    openSettings: (section = "general") => setSettings(section),
    openSearch: () => setSearchOpen(true),
    openShortcuts: () => setShortcutsOpen(true),
    newChat: (options = {}) => {
      setPendingProjectId(options.projectId ?? null)
      navigate({ name: "chat", conversationId: null })
      closeSidebarOnMobile()
    },
    signOut: props.onSignOut,
  }

  // ChatGPT-style shortcuts. Ctrl/Cmd+K: search; +Shift+O: new chat; +Shift+S: sidebar;
  // +Shift+comma: settings.
  const onKey = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    const action =
      key === "k" && !event.shiftKey
        ? () => setSearchOpen(true)
        : !event.shiftKey
          ? null
          : key === "o"
            ? () => state.newChat()
            : key === "s"
              ? () => setSidebarOpen(!sidebarOpen())
              : key === "," || key === "<"
                ? () => setSettings("general")
                : null
    if (!action) return
    event.preventDefault()
    action()
  }
  document.addEventListener("keydown", onKey)
  onCleanup(() => document.removeEventListener("keydown", onKey))

  return (
    <AppContext.Provider value={state}>
      <div class="app" classList={{ "sidebar-open": sidebarOpen() }}>
        <Sidebar
          open={sidebarOpen()}
          onClose={() => setSidebarOpen(false)}
          onNavigate={closeSidebarOnMobile}
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
          <TopBar sidebarOpen={sidebarOpen()} onOpenSidebar={() => setSidebarOpen(true)} />
          <Switch>
            <Match when={route().name === "chat"}>
              <ChatView
                conversationId={(route() as { conversationId: string | null }).conversationId}
                onConversationCreated={(id) => {
                  setPendingProjectId(null)
                  // Incognito chats get no URL, so a reload cannot reopen them.
                  if (!incognito())
                    navigate({ name: "chat", conversationId: id }, { replace: true })
                }}
              />
            </Match>
            <Match when={route().name !== "chat"}>
              <div class="page-scroll">
                <Switch>
                  <Match when={route().name === "plans"}>
                    <PlansView usage={usage()} paymentResult={paymentResult} />
                  </Match>
                  <Match when={route().name === "projects"}>
                    <ProjectsPage />
                  </Match>
                  <Match
                    when={
                      route().name === "project" && (route() as { projectId: string }).projectId
                    }
                  >
                    {(projectId) => <ProjectPage projectId={projectId()} />}
                  </Match>
                  <Match when={route().name === "library"}>
                    <LibraryPage />
                  </Match>
                  <Match
                    when={
                      route().name === "plugins" && (route() as { tab: "plugins" | "skills" }).tab
                    }
                  >
                    {(tab) => <PluginsPage tab={tab()} />}
                  </Match>
                  <Match when={route().name === "automations"}>
                    <AutomationsPage />
                  </Match>
                  <Match when={route().name === "code"}>
                    <CodePage />
                  </Match>
                </Switch>
              </div>
            </Match>
          </Switch>
        </main>
      </div>

      <Show when={settings()}>
        {(section) => <SettingsDialog section={section()} onClose={() => setSettings(null)} />}
      </Show>
      <Show when={searchOpen()}>
        <SearchDialog onClose={() => setSearchOpen(false)} />
      </Show>
      <Show when={shortcutsOpen()}>
        <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />
      </Show>
      <Toaster />
    </AppContext.Provider>
  )
}
