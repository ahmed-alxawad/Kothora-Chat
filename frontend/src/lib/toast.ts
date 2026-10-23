import { createSignal } from "solid-js"

export type Toast = { id: number; message: string; tone: "info" | "error" }

const TOAST_MS = 4000
const [toasts, setToasts] = createSignal<Toast[]>([])
export { toasts }

let nextId = 1

/** A short message at the bottom of the screen, e.g. "Chat renamed" or a failed action. */
export function showToast(message: string, tone: Toast["tone"] = "info"): void {
  const id = nextId++
  setToasts((all) => [...all, { id, message, tone }])
  setTimeout(() => setToasts((all) => all.filter((toast) => toast.id !== id)), TOAST_MS)
}

/**
 * Report a failed action in words the user can act on. `planned` marks actions the
 * current backend may not have yet; there a 422 (unknown field) also means "not yet".
 */
export function toastError(
  action: string,
  err: unknown,
  options: { planned?: boolean } = {},
): void {
  const status = (err as { status?: number })?.status
  const unsupported = status === 404 || status === 405 || (options.planned && status === 422)
  const detail = unsupported
    ? "this server does not support it yet."
    : err instanceof Error
      ? err.message
      : String(err)
  showToast(`${action}: ${detail}`, "error")
}
