import { createSignal, onCleanup, Show, type JSX } from "solid-js"

/**
 * A popover menu anchored to its trigger. Closes on outside click, Escape, or when an
 * item calls `close`. Keyboard users reach items with Tab; Escape returns focus.
 */
export function Menu(props: {
  label: string
  trigger: JSX.Element
  triggerClass?: string
  placement?: "below" | "above" | "below-end"
  children: (close: () => void) => JSX.Element
}) {
  const [open, setOpen] = createSignal(false)
  let root: HTMLDivElement | undefined
  let button: HTMLButtonElement | undefined

  const close = () => setOpen(false)
  const onDocumentPointer = (event: PointerEvent) => {
    if (root && !root.contains(event.target as Node)) close()
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open()) {
      close()
      button?.focus()
    }
  }
  document.addEventListener("pointerdown", onDocumentPointer)
  document.addEventListener("keydown", onKey)
  onCleanup(() => {
    document.removeEventListener("pointerdown", onDocumentPointer)
    document.removeEventListener("keydown", onKey)
  })

  return (
    <div class="menu" ref={root}>
      <button
        ref={button}
        type="button"
        class={props.triggerClass}
        aria-label={props.label}
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
      >
        {props.trigger}
      </button>
      <Show when={open()}>
        <div class={`menu-panel ${props.placement ?? "below"}`} role="menu">
          {props.children(close)}
        </div>
      </Show>
    </div>
  )
}
