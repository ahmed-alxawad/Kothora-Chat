import { createContext, useContext, type Accessor } from "solid-js"
import type { SafeResource } from "./lib/resource"
import type { Conversation, Project, Skill, Usage, User } from "./lib/types"

export type SettingsSection =
  | "general"
  | "account"
  | "privacy"
  | "billing"
  | "usage"
  | "capabilities"
  | "memory"
  | "personalization"
  | "skills"
  | "connectors"
  | "api"

/**
 * Data and actions the whole signed-in app shares. App.tsx creates it once; components
 * read it with useApp() instead of receiving the same props through every layer.
 */
export type AppState = {
  user: SafeResource<User>
  usage: SafeResource<Usage>
  conversations: SafeResource<Conversation[]>
  projects: SafeResource<Project[]>
  skills: SafeResource<Skill[]>
  updateUser: (user: User) => void
  refetchConversations: () => void
  refetchUsage: () => void
  refetchProjects: () => void
  refetchSkills: () => void
  /** Incognito: new chats are not saved to history. */
  incognito: Accessor<boolean>
  setIncognito: (on: boolean) => void
  /** The project the next new chat belongs to (set from a project page). */
  pendingProjectId: Accessor<string | null>
  setPendingProjectId: (id: string | null) => void
  openSettings: (section?: SettingsSection) => void
  openSearch: () => void
  openShortcuts: () => void
  newChat: (options?: { projectId?: string | null }) => void
  signOut: () => void
}

export const AppContext = createContext<AppState>()

export function useApp(): AppState {
  const state = useContext(AppContext)
  if (!state) throw new Error("useApp() must be used inside <AppContext.Provider>")
  return state
}
