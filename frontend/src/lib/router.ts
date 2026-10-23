import { createSignal } from "solid-js"
import { parsePath, routePath, type Route } from "./routes"

export type { Route }

const [route, setRoute] = createSignal<Route>(parsePath(window.location.pathname))
export { route }

/** `replace` updates the URL without a history entry, e.g. when a new chat gets its id. */
export function navigate(next: Route, options: { replace?: boolean } = {}): void {
  try {
    const path = routePath(next)
    if (options.replace) window.history.replaceState(null, "", path)
    else window.history.pushState(null, "", path)
  } catch {
    // Sandboxed frames (the demo) may refuse history changes; navigation still works in-page.
  }
  setRoute(next)
}

window.addEventListener("popstate", () => setRoute(parsePath(window.location.pathname)))
