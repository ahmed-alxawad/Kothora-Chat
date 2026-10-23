import { describe, expect, it } from "vitest"
import type { Conversation } from "./types"
import { groupConversations, relativeTime } from "./time"

const NOW = new Date(2026, 9, 23, 15, 0) // 23 Oct 2026, 15:00 local time

function chat(id: string, updated: Date): Conversation {
  const iso = updated.toISOString()
  return { id, title: id, created_at: iso, updated_at: iso }
}

describe("groupConversations", () => {
  it("groups by recency, newest first, and skips empty groups", () => {
    const groups = groupConversations(
      [
        chat("last-year", new Date(2025, 11, 2)),
        chat("today", new Date(2026, 9, 23, 9)),
        chat("yesterday", new Date(2026, 9, 22, 23)),
        chat("this-week", new Date(2026, 9, 19)),
        chat("this-month", new Date(2026, 9, 1)),
      ],
      NOW,
    )
    expect(groups.map((g) => [g.label, g.conversations.map((c) => c.id)])).toEqual([
      ["Today", ["today"]],
      ["Yesterday", ["yesterday"]],
      ["Previous 7 days", ["this-week"]],
      ["Previous 30 days", ["this-month"]],
      ["December 2025", ["last-year"]],
    ])
  })

  it("returns no groups for no conversations", () => {
    expect(groupConversations([], NOW)).toEqual([])
  })
})

describe("relativeTime", () => {
  it("picks the largest whole unit", () => {
    const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
    expect(relativeTime(at(30_000), NOW)).toBe("just now")
    expect(relativeTime(at(5 * 60_000), NOW)).toBe("5m ago")
    expect(relativeTime(at(3 * 3_600_000), NOW)).toBe("3h ago")
    expect(relativeTime(at(4 * 86_400_000), NOW)).toBe("4d ago")
    expect(relativeTime(at(65 * 86_400_000), NOW)).toBe("2mo ago")
    expect(relativeTime(at(400 * 86_400_000), NOW)).toBe("1y ago")
  })

  it("treats future times as now", () => {
    expect(relativeTime(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe("just now")
  })
})
