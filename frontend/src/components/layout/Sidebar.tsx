import { createMemo, createSignal, For, Show } from "solid-js"
import { groupConversations } from "../../lib/time"
import type { Conversation, Usage, User } from "../../lib/types"
import { Icon, KothoraMark } from "../ui/Icon"
import { Menu } from "../ui/Menu"
import { AccountMenu } from "./AccountMenu"

export function Sidebar(props: {
  open: boolean
  conversations: Conversation[]
  activeId: string | null
  user: User | undefined
  usage: Usage | undefined
  onClose: () => void
  onNewChat: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onShowPlans: () => void
  onSignOut: () => void
}) {
  const [query, setQuery] = createSignal("")
  const groups = createMemo(() => {
    const needle = query().trim().toLowerCase()
    const matching = needle
      ? props.conversations.filter((conversation) =>
          conversation.title.toLowerCase().includes(needle),
        )
      : props.conversations
    return groupConversations(matching, new Date())
  })

  return (
    <aside class="sidebar" classList={{ open: props.open }} aria-label="Chats">
      <div class="sidebar-head">
        <a
          class="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            props.onNewChat()
          }}
        >
          <KothoraMark size={26} />
          <span>Kothora</span>
        </a>
        <button
          type="button"
          class="icon-button"
          onClick={props.onClose}
          aria-label="Close sidebar"
        >
          <Icon name="sidebar" />
        </button>
      </div>

      <button type="button" class="new-chat" onClick={props.onNewChat}>
        <Icon name="plus" size={17} />
        <span>New chat</span>
        <kbd>Ctrl ⇧ O</kbd>
      </button>

      <label class="sidebar-search">
        <Icon name="search" size={16} />
        <span class="visually-hidden">Search chats</span>
        <input
          id="chat-search"
          type="search"
          placeholder="Search chats"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      <nav class="history">
        <For
          each={groups()}
          fallback={
            <p class="history-empty">
              {query() ? "No chats match your search." : "Your chats will appear here."}
            </p>
          }
        >
          {(group) => (
            <section class="history-group">
              <h2 class="history-label">{group.label}</h2>
              <ul>
                <For each={group.conversations}>
                  {(conversation) => (
                    <HistoryItem
                      conversation={conversation}
                      active={conversation.id === props.activeId}
                      onSelect={() => props.onSelect(conversation.id)}
                      onRename={(title) => props.onRename(conversation.id, title)}
                      onDelete={() => props.onDelete(conversation.id)}
                    />
                  )}
                </For>
              </ul>
            </section>
          )}
        </For>
      </nav>

      <AccountMenu
        user={props.user}
        usage={props.usage}
        onShowPlans={props.onShowPlans}
        onSignOut={props.onSignOut}
      />
    </aside>
  )
}

function HistoryItem(props: {
  conversation: Conversation
  active: boolean
  onSelect: () => void
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = createSignal(false)
  const [confirmingDelete, setConfirmingDelete] = createSignal(false)

  async function commitRename(input: HTMLInputElement) {
    const title = input.value.trim()
    setEditing(false)
    if (title && title !== props.conversation.title) await props.onRename(title)
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
                setEditing(true)
              }}
            >
              <Icon name="edit" size={16} /> Rename
            </button>
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
                onClick={async () => {
                  close()
                  setConfirmingDelete(false)
                  await props.onDelete()
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
