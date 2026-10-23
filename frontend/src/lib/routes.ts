/** The app's screens. Each has a URL so a chat can be reloaded or shared with its owner. */
export type Route = { name: "chat"; conversationId: string | null } | { name: "plans" }

export function parsePath(path: string): Route {
  if (path.startsWith("/billing")) return { name: "plans" }
  const chat = /^\/c\/([\w-]+)/.exec(path)
  return { name: "chat", conversationId: chat ? chat[1] : null }
}

export function routePath(route: Route): string {
  if (route.name === "plans") return "/billing"
  return route.conversationId ? `/c/${route.conversationId}` : "/"
}
