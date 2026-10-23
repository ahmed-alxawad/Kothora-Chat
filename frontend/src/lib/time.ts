import type { Conversation } from "./types"

export type ConversationGroup = { label: string; conversations: Conversation[] }

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Group conversations by last activity, newest first, the way chat apps label history:
 * Today, Yesterday, Previous 7 days, Previous 30 days, then one group per month.
 * Day boundaries use the viewer's local time.
 */
export function groupConversations(conversations: Conversation[], now: Date): ConversationGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const groups = new Map<string, Conversation[]>()
  const sorted = [...conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  for (const conversation of sorted) {
    const label = groupLabel(new Date(conversation.updated_at), startOfToday)
    const group = groups.get(label)
    if (group) group.push(conversation)
    else groups.set(label, [conversation])
  }
  return Array.from(groups, ([label, items]) => ({ label, conversations: items }))
}

function groupLabel(date: Date, startOfToday: number): string {
  const time = date.getTime()
  if (time >= startOfToday) return "Today"
  if (time >= startOfToday - DAY_MS) return "Yesterday"
  if (time >= startOfToday - 7 * DAY_MS) return "Previous 7 days"
  if (time >= startOfToday - 30 * DAY_MS) return "Previous 30 days"
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

/** Compact age, as list views show it: "just now", "5m ago", "3h ago", "4d ago", "2mo ago". */
export function relativeTime(iso: string, now: Date): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = seconds / 60
  if (minutes < 60) return `${Math.floor(minutes)}m ago`
  const hours = minutes / 60
  if (hours < 24) return `${Math.floor(hours)}h ago`
  const days = hours / 24
  if (days < 30) return `${Math.floor(days)}d ago`
  const months = days / 30
  if (months < 12) return `${Math.floor(months)}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
