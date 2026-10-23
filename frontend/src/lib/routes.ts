/** The app's screens. Each has a URL, so any of them can be reloaded or bookmarked. */
export type Route =
  | { name: "chat"; conversationId: string | null }
  | { name: "plans" }
  | { name: "projects" }
  | { name: "project"; projectId: string }
  | { name: "library" }
  | { name: "plugins"; tab: "plugins" | "skills" }
  | { name: "automations" }
  | { name: "code" }

const STATIC: Record<string, Route> = {
  "/billing": { name: "plans" },
  "/projects": { name: "projects" },
  "/library": { name: "library" },
  "/plugins": { name: "plugins", tab: "plugins" },
  "/skills": { name: "plugins", tab: "skills" },
  "/automations": { name: "automations" },
  "/code": { name: "code" },
}

export function parsePath(path: string): Route {
  const clean = path.replace(/\/+$/, "") || "/"
  if (STATIC[clean]) return STATIC[clean]
  const chat = /^\/c\/([\w-]+)$/.exec(clean)
  if (chat) return { name: "chat", conversationId: chat[1] }
  const project = /^\/p\/([\w-]+)$/.exec(clean)
  if (project) return { name: "project", projectId: project[1] }
  return { name: "chat", conversationId: null }
}

export function routePath(route: Route): string {
  switch (route.name) {
    case "chat":
      return route.conversationId ? `/c/${route.conversationId}` : "/"
    case "project":
      return `/p/${route.projectId}`
    case "plugins":
      return route.tab === "skills" ? "/skills" : "/plugins"
    default:
      return Object.keys(STATIC).find((path) => STATIC[path].name === route.name) ?? "/"
  }
}
