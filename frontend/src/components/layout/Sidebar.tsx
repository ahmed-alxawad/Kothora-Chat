import { createMemo, createSignal, For, Show } from "solid-js"
import { useApp } from "../../app-context"
import { api } from "../../lib/api"
import { navigate, route } from "../../lib/router"
import type { Route } from "../../lib/routes"
import { showToast, toastError } from "../../lib/toast"
import type { Conversation } from "../../lib/types"
import { Icon, Wordmark, type IconName } from "../ui/Icon"
import { Menu } from "../ui/Menu"
import { AccountMenu } from "./AccountMenu"

const VISIBLE_PROJECTS = 5

const NAV: { label: string; icon: IconName; route: Route }[] = [
  { label: "Library", icon: "library", route: { name: "library" } },
  { label: "Automations", icon: "clock", route: { name: "automations" } },
  { label: "Plugins", icon: "plug", route: { name: "plugins", tab: "plugins" } },
]

export function Sidebar(props: { open: boolean; onClose: () => void; onNavigate: () => void }) {
  const app = useApp()
  const [projectsOpen, setProjectsOpen] = createSignal(true)
  const [recentsOpen, setRecentsOpen] = createSignal(true)

  const activeConversation = () => {
    const current = route()
    return current.name === "chat" ? current.conversationId : null
  }
  const projects = createMemo(() =>
    [...(app.projects.error ? [] : (app.projects() ?? []))]
      .sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at),
      )
      .slice(0, VISIBLE_PROJECTS),
  )
  const recents = createMemo(() =>
    [...(app.conversations() ?? [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  )

  function go(next: Route) {
    navigate(next)
    props.onNavigate()
  }

  return (
    <aside class="sidebar" classList={{ open: props.open }} aria-label="Navigation">
      <div class="sidebar-head">
        <a
          class="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            app.newChat()
            props.onNavigate()
          }}
        >
          <Wordmark />
        </a>
        <div class="sidebar-head-actions">
          <button
            type="button"
            class="icon-button"
            onClick={app.openSearch}
            aria-label="Search chats (Ctrl+K)"
          >
            <Icon name="search" />
          </button>
          <button
            type="button"
            class="icon-button"
            onClick={props.onClose}
            aria-label="Close sidebar"
          >
            <Icon name="sidebar" />
          </button>
        </div>
      </div>

      <nav class="sidebar-nav">
        <button
          type="button"
          class="nav-item"
          onClick={() => {
            app.newChat()
            props.onNavigate()
          }}
        >
          <Icon name="edit" size={18} />
          <span>New chat</span>
          <kbd>Ctrl ⇧ O</kbd>
        </button>
        <For each={NAV}>
          {(item) => (
            <button
              type="button"
              class="nav-item"
              classList={{ active: route().name === item.route.name }}
              onClick={() => go(item.route)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          )}
        </For>
        <button type="button" class="nav-item" onClick={() => app.openSettings("personalization")}>
          <Icon name="sliders" size={18} />
          <span>Customize</span>
        </button>
      </nav>

      <div class="sidebar-scroll">
        <Show when={projects().length > 0}>
          <section class="sidebar-section">
            <SectionHeader
              label="Projects"
              open={projectsOpen()}
              onToggle={() => setProjectsOpen(!projectsOpen())}
            />
            <Show when={projectsOpen()}>
              <ul>
                <For each={projects()}>
                  {(project) => (
                    <li>
                      <a
                        class="side-link"
                        classList={{
                          active:
                            route().name === "project" &&
                            (route() as { projectId: string }).projectId === project.id,
                        }}
                        href={`/p/${project.id}`}
                        onClick={(event) => {
                          event.preventDefault()
                          go({ name: "project", projectId: project.id })
                        }}
                      >
                        <Icon name={project.pinned ? "pin" : "folder"} size={16} />
                        <span>{project.name}</span>
                      </a>
                    </li>
                  )}
                </For>
                <li>
                  <button
                    type="button"
                    class="side-link muted"
                    onClick={() => go({ name: "projects" })}
                  >
                    <Icon name="more" size={16} />
                    <span>All projects</span>
                  </button>
                </li>
              </ul>
            </Show>
          </section>
        </Show>

        <section class="sidebar-section">
          <SectionHeader
            label="Recents"
            open={recentsOpen()}
            onToggle={() => setRecentsOpen(!recentsOpen())}
          />
          <Show when={recentsOpen()}>
            <ul>
              <For
                each={recents()}
                fallback={<li class="history-empty">Your chats will appear here.</li>}
              >
                {(conversation) => (
                  <HistoryItem
                    conversation={conversation}
                    active={conversation.id === activeConversation()}
                    onSelect={() => go({ name: "chat", conversationId: conversation.id })}
                  />
                )}
              </For>
            </ul>
          </Show>
        </section>
      </div>

      <AccountMenu />
    </aside>
  )
}

function SectionHeader(props: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      class="section-toggle"
      aria-expanded={props.open}
      onClick={props.onToggle}
    >
      <span>{props.label}</span>
      <Icon name="chevronDown" size={15} class={props.open ? "" : "rotated"} />
    </button>
  )
}

function HistoryItem(props: { conversation: Conversation; active: boolean; onSelect: () => void }) {
  const app = useApp()
  const [editing, setEditing] = createSignal(false)
  const [confirmingDelete, setConfirmingDelete] = createSignal(false)

  /** `planned`: the field is not in the current backend yet (favorites, projects). */
  async function update(
    changes: Parameters<typeof api.updateConversation>[1],
    labels: { action: string; done: string },
    planned: boolean,
  ) {
    try {
      await api.updateConversation(props.conversation.id, changes)
      app.refetchConversations()
      showToast(labels.done)
    } catch (err) {
      toastError(labels.action, err, { planned })
    }
  }

  async function commitRename(input: HTMLInputElement) {
    const title = input.value.trim()
    setEditing(false)
    if (title && title !== props.conversation.title)
      await update({ title }, { action: "Rename chat", done: "Chat renamed" }, false)
  }

  async function remove() {
    try {
      await api.deleteConversation(props.conversation.id)
      app.refetchConversations()
      if (props.active) app.newChat()
      showToast("Chat deleted")
    } catch (err) {
      toastError("Delete chat", err)
    }
  }

  return (
    <li class="history-item" classList={{ active: props.active }}>
      <Show
        when={editing()}
        fallback={
          <a
            class="history-link"
            href={`/c/${props.conversation.id}`}
            aria-current={props.active ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault()
              props.onSelect()
            }}
          >
            <Show when={props.conversation.starred}>
              <Icon name="star" size={13} class="star-mark" />
            </Show>
            {props.conversation.title}
          </a>
        }
      >
        <input
          class="history-rename"
          value={props.conversation.title}
          aria-label="Chat name"
          ref={(input) => queueMicrotask(() => input.select())}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitRename(event.currentTarget)
            if (event.key === "Escape") setEditing(false)
          }}
          onBlur={(event) => commitRename(event.currentTarget)}
        />
      </Show>
      <Menu
        label={`Options for ${props.conversation.title}`}
        triggerClass="icon-button history-more"
        placement="below-end"
        trigger={<Icon name="more" size={18} />}
      >
        {(close) => (
          <>
            <button
              type="button"
              role="menuitem"
              class="menu-item"
              onClick={() => {
                close()
                const starred = !props.conversation.starred
                update(
                  { starred },
                  starred
                    ? { action: "Add to favorites", done: "Added to favorites" }
                    : { action: "Remove from favorites", done: "Removed from favorites" },
                  true,
                )
              }}
            >
              <Icon name="star" size={16} />{" "}
              {props.conversation.starred ? "Remove from favorites" : "Add to favorites"}
            </button>
            <button
              type="button"
              role="menuitem"
              class="menu-item"
              onClick={() => {
                close()
                setEditing(true)
              }}
            >
              <Icon name="rename" size={16} /> Rename
            </button>
            <Show when={(app.projects() ?? []).length > 0 && !app.projects.error}>
              <div class="menu-section">
                <span class="menu-caption">Move to project</span>
              </div>
              <For each={app.projects()}>
                {(project) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={props.conversation.project_id === project.id}
                    class="menu-item indent"
                    onClick={() => {
                      close()
                      const leaving = props.conversation.project_id === project.id
                      update(
                        { project_id: leaving ? null : project.id },
                        {
                          action: "Move chat",
                          done: leaving ? "Removed from project" : `Moved to ${project.name}`,
                        },
                        true,
                      )
                    }}
                  >
                    <Icon name="folder" size={16} /> {project.name}
                    <Show when={props.conversation.project_id === project.id}>
                      <Icon name="check" size={16} class="menu-check" />
                    </Show>
                  </button>
                )}
              </For>
            </Show>
            {/* Two steps instead of confirm(), which embedded viewers suppress. */}
            <Show
              when={confirmingDelete()}
              fallback={
                <button
                  type="button"
                  role="menuitem"
                  class="menu-item danger"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Icon name="trash" size={16} /> Delete
                </button>
              }
            >
              <button
                type="button"
                role="menuitem"
                class="menu-item danger strong"
                onClick={() => {
                  close()
                  setConfirmingDelete(false)
                  remove()
                }}
              >
                <Icon name="trash" size={16} /> Delete for good
              </button>
            </Show>
          </>
        )}
      </Menu>
    </li>
  )
}
