import { createSignal, For, Show } from "solid-js"
import type { Focus } from "../../lib/types"
import { Icon, type IconName } from "../ui/Icon"
import { Menu } from "../ui/Menu"

const FOCUS_OPTIONS: { id: Focus; label: string; hint: string; icon: IconName }[] = [
  { id: "web", label: "Web", hint: "Search the web and cite sources", icon: "globe" },
  {
    id: "academic",
    label: "Academic",
    hint: "Search published papers (Education plan)",
    icon: "book",
  },
  { id: "writing", label: "Writing", hint: "No search: write, edit, translate", icon: "pen" },
]

const MAX_TEXTAREA_PX = 220

export function Composer(props: {
  streaming: boolean
  focus: Focus
  academicAvailable: boolean
  onFocusChange: (focus: Focus) => void
  onSubmit: (text: string) => void
  onStop: () => void
  placeholder?: string
  autofocus?: boolean
}) {
  const [text, setText] = createSignal("")
  let textarea: HTMLTextAreaElement | undefined

  const current = () =>
    FOCUS_OPTIONS.find((option) => option.id === props.focus) ?? FOCUS_OPTIONS[0]

  function resize() {
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_PX)}px`
  }

  function submit(event?: Event) {
    event?.preventDefault()
    const value = text().trim()
    if (!value || props.streaming) return
    props.onSubmit(value)
    setText("")
    queueMicrotask(resize)
  }

  return (
    <form class="composer" onSubmit={submit}>
      <label class="visually-hidden" for="composer-input">
        Message Kothora
      </label>
      <textarea
        id="composer-input"
        ref={textarea}
        rows={1}
        placeholder={props.placeholder ?? "Ask anything…"}
        value={text()}
        autofocus={props.autofocus}
        onInput={(event) => {
          setText(event.currentTarget.value)
          resize()
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.isComposing) submit(event)
        }}
      />
      <div class="composer-bar">
        <Menu
          label={`Focus: ${current().label}`}
          triggerClass="focus-button"
          placement="above"
          trigger={
            <>
              <Icon name={current().icon} size={16} />
              <span>{current().label}</span>
              <Icon name="chevronDown" size={14} />
            </>
          }
        >
          {(close) => (
            <For each={FOCUS_OPTIONS}>
              {(option) => {
                const locked = () => option.id === "academic" && !props.academicAvailable
                return (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={props.focus === option.id}
                    class="menu-item"
                    disabled={locked()}
                    onClick={() => {
                      props.onFocusChange(option.id)
                      close()
                    }}
                  >
                    <Icon name={locked() ? "lock" : option.icon} size={16} />
                    <span class="menu-item-text">
                      <span>{option.label}</span>
                      <span class="menu-item-hint">{option.hint}</span>
                    </span>
                    <Show when={props.focus === option.id}>
                      <Icon name="check" size={16} class="menu-check" />
                    </Show>
                  </button>
                )
              }}
            </For>
          )}
        </Menu>
        <Show
          when={props.streaming}
          fallback={
            <button
              type="submit"
              class="send-button"
              disabled={!text().trim()}
              aria-label="Send message"
            >
              <Icon name="send" size={18} />
            </button>
          }
        >
          <button
            type="button"
            class="send-button stop"
            onClick={props.onStop}
            aria-label="Stop answering"
          >
            <Icon name="stop" size={14} />
          </button>
        </Show>
      </div>
    </form>
  )
}
