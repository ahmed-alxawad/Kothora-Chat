import { onCleanup, onMount, Show, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { Icon } from "./Icon"

/**
 * A modal dialog. Escape or the backdrop closes it, focus moves inside on open and
 * returns to the opener on close.
 */
export function Dialog(props: {
  label: string
  onClose: () => void
  size?: "small" | "large"
  hideClose?: boolean
  children: JSX.Element
}) {
  let panel: HTMLDivElement | undefined
  const opener = document.activeElement as HTMLElement | null
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") props.onClose()
  }

  onMount(() => {
    document.addEventListener("keydown", onKey)
    const first = panel?.querySelector<HTMLElement>("input, textarea, button, [href]")
    first?.focus()
  })
  onCleanup(() => {
    document.removeEventListener("keydown", onKey)
    opener?.focus?.()
  })

  return (
    <Portal>
      <div
        class="dialog-backdrop"
        onPointerDown={(e) => e.target === e.currentTarget && props.onClose()}
      >
        <div
          ref={panel}
          class={`dialog ${props.size ?? "small"}`}
          role="dialog"
          aria-modal="true"
          aria-label={props.label}
        >
          <Show when={!props.hideClose}>
            <button
              type="button"
              class="icon-button dialog-close"
              aria-label="Close"
              onClick={props.onClose}
            >
              <Icon name="x" />
            </button>
          </Show>
          {props.children}
        </div>
      </div>
    </Portal>
  )
}
