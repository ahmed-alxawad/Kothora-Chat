import { createMemo, createSignal, For, Show } from "solid-js"
import { useApp } from "../../app-context"
import { navigate } from "../../lib/router"
import { groupConversations } from "../../lib/time"
import { Dialog } from "../ui/Dialog"
import { Icon } from "../ui/Icon"

const MAX_RESULTS = 40

/** Ctrl+K: find a chat by title and open it. Enter opens the first result. */
export function SearchDialog(props: { onClose: () => void }) {
  const app = useApp()
  const [query, setQuery] = createSignal("")
  const groups = createMemo(() => {
    const needle = query().trim().toLowerCase()
    const matches = (app.conversations() ?? [])
      .filter((conversation) => conversation.title.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS)
    return groupConversations(matches, new Date())
  })

  function open(id: string) {
    navigate({ name: "chat", conversationId: id })
    props.onClose()
  }

  return (
    <Dialog label="Search chats" onClose={props.onClose} hideClose>
      <div class="search-dialog">
        <label class="search-field">
          <Icon name="search" size={18} />
          <span class="visually-hidden">Search chats</span>
          <input
            id="search-chats"
            placeholder="Search chats…"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              const first = groups()[0]?.conversations[0]
              if (event.key === "Enter" && first) open(first.id)
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <div class="search-results">
          <button
            type="button"
            class="search-result"
            onClick={() => {
              app.newChat()
              props.onClose()
            }}
          >
            <Icon name="edit" size={16} />
            <span>New chat</span>
          </button>
          <For each={groups()} fallback={<p class="search-empty">No chats match “{query()}”.</p>}>
            {(group) => (
              <section>
                <h3 class="history-label">{group.label}</h3>
                <For each={group.conversations}>
                  {(conversation) => (
                    <button
                      type="button"
                      class="search-result"
                      onClick={() => open(conversation.id)}
                    >
                      <Icon name={conversation.starred ? "star" : "chat"} size={16} />
                      <span>{conversation.title}</span>
                    </button>
                  )}
                </For>
              </section>
            )}
          </For>
        </div>
        <Show when={query()}>
          <p class="search-hint">Searches chat titles.</p>
        </Show>
      </div>
    </Dialog>
  )
}
