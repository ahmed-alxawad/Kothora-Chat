import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import { safeResource } from "../../lib/resource"
import { useApp } from "../../app-context"
import { api } from "../../lib/api"
import { displayDomain, safeUrl } from "../../lib/format"
import { navigate } from "../../lib/router"
import { relativeTime } from "../../lib/time"
import type { Conversation } from "../../lib/types"
import { Icon } from "../ui/Icon"
import { EmptyState, LoadError, PageHeader } from "../ui/States"

type Tab = "all" | "favorites" | "sources"
type Layout = "grid" | "list"

const LAYOUT_KEY = "kothora.library.layout"

function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "grid"
  } catch {
    return "grid"
  }
}

/** Everything you have made in Kothora: chats, favorites, and every source cited for you. */
export function LibraryPage() {
  const app = useApp()
  const [tab, setTab] = createSignal<Tab>("all")
  const [layout, setLayoutSignal] = createSignal<Layout>(readLayout())
  const [query, setQuery] = createSignal("")
  const [sources] = safeResource(() => tab() === "sources", api.librarySources)

  function setLayout(next: Layout) {
    setLayoutSignal(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      // A remembered view is a convenience only.
    }
  }

  const needle = () => query().trim().toLowerCase()
  const chats = createMemo(() =>
    (app.conversations() ?? [])
      .filter((c) => (tab() === "favorites" ? c.starred : true))
      .filter((c) => c.title.toLowerCase().includes(needle()))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  )
  const matchingSources = createMemo(() =>
    (sources() ?? []).filter((s) =>
      `${s.title} ${s.url} ${s.conversation_title}`.toLowerCase().includes(needle()),
    ),
  )
  const projectName = (c: Conversation) => app.projects()?.find((p) => p.id === c.project_id)?.name

  return (
    <div class="page">
      <PageHeader
        title="Library"
        actions={
          <>
            <div class="segmented" role="radiogroup" aria-label="Layout">
              <button
                type="button"
                role="radio"
                aria-checked={layout() === "grid"}
                aria-label="Grid"
                classList={{ active: layout() === "grid" }}
                onClick={() => setLayout("grid")}
              >
                <Icon name="grid" size={16} />
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={layout() === "list"}
                aria-label="List"
                classList={{ active: layout() === "list" }}
                onClick={() => setLayout("list")}
              >
                <Icon name="list" size={16} />
              </button>
            </div>
            <label class="search-field small">
              <Icon name="search" size={16} />
              <span class="visually-hidden">Search library</span>
              <input
                id="search-library"
                placeholder="Search library"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
            </label>
          </>
        }
      />
      <div class="tabs" role="tablist" aria-label="Library sections">
        <For
          each={
            [
              ["all", "All"],
              ["favorites", "Favorites"],
              ["sources", "Sources"],
            ] as [Tab, string][]
          }
        >
          {([id, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab() === id}
              classList={{ active: tab() === id }}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          )}
        </For>
      </div>

      <Switch>
        <Match when={tab() === "sources"}>
          <Show
            when={!sources.error}
            fallback={<LoadError error={sources.error} feature="Sources" />}
          >
            <ul class="row-list">
              <For
                each={matchingSources()}
                fallback={
                  <Show when={sources()}>
                    <EmptyState icon="link" title="No sources yet">
                      Sources cited in your answers collect here.
                    </EmptyState>
                  </Show>
                }
              >
                {(source) => (
                  <li class="source-row">
                    <span class="source-avatar large" aria-hidden="true">
                      {displayDomain(source.url).charAt(0).toUpperCase()}
                    </span>
                    <div class="source-row-text">
                      <a
                        href={safeUrl(source.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="list-title"
                      >
                        {source.title}
                      </a>
                      <span class="list-meta">
                        {displayDomain(source.url)} · cited in{" "}
                        <button
                          type="button"
                          class="link small"
                          onClick={() =>
                            navigate({ name: "chat", conversationId: source.conversation_id })
                          }
                        >
                          {source.conversation_title}
                        </button>
                      </span>
                    </div>
                    <span class="list-meta numeric">
                      {relativeTime(source.cited_at, new Date())}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Match>
        <Match when={true}>
          <Show
            when={chats().length > 0}
            fallback={
              <EmptyState
                icon={tab() === "favorites" ? "star" : "chat"}
                title={tab() === "favorites" ? "No favorites yet" : "No chats found"}
              >
                {tab() === "favorites"
                  ? "Choose Add to favorites in a chat's menu to keep it here."
                  : undefined}
              </EmptyState>
            }
          >
            <div class={layout() === "grid" ? "card-grid" : "row-list"}>
              <For each={chats()}>
                {(chat) => (
                  <a
                    class={layout() === "grid" ? "chat-card" : "list-row link-row"}
                    href={`/c/${chat.id}`}
                    onClick={(event) => {
                      event.preventDefault()
                      navigate({ name: "chat", conversationId: chat.id })
                    }}
                  >
                    <span class="list-title">{chat.title}</span>
                    <span class="list-meta">
                      <Show when={chat.starred}>
                        <Icon name="star" size={13} class="star-mark" />
                      </Show>
                      <Show when={projectName(chat)}>
                        <Icon name="folder" size={13} /> {projectName(chat)} ·{" "}
                      </Show>
                      {relativeTime(chat.updated_at, new Date())}
                    </span>
                  </a>
                )}
              </For>
            </div>
          </Show>
        </Match>
      </Switch>
    </div>
  )
}
