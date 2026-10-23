import { For } from "solid-js"
import { toasts } from "../../lib/toast"

export function Toaster() {
  return (
    <div class="toaster" role="status" aria-live="polite">
      <For each={toasts()}>
        {(toast) => <div class={`toast ${toast.tone}`}>{toast.message}</div>}
      </For>
    </div>
  )
}
