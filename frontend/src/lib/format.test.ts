import { describe, expect, it } from "vitest"
import { displayDomain, formatBdt, initials, modelLabel, safeUrl } from "./format"
import { parsePath, routePath } from "./routes"

describe("safeUrl", () => {
  it("allows http and https only", () => {
    expect(safeUrl("https://example.org/a")).toBe("https://example.org/a")
    expect(safeUrl("javascript:alert(1)")).toBeUndefined()
    expect(safeUrl("not a url")).toBeUndefined()
  })
})

describe("displayDomain", () => {
  it("drops common subdomains", () => {
    expect(displayDomain("https://en.wikipedia.org/wiki/Dhaka")).toBe("wikipedia.org")
    expect(displayDomain("https://www.bkash.com/")).toBe("bkash.com")
    expect(displayDomain("nonsense")).toBe("")
  })
})

describe("formatBdt and initials", () => {
  it("formats taka with separators", () => {
    expect(formatBdt(15300)).toBe("৳15,300")
  })

  it("takes first and last initials", () => {
    expect(initials("Asha Begum Rahman")).toBe("AR")
    expect(initials("asha")).toBe("A")
    expect(initials("  ")).toBe("?")
  })
})

describe("router paths", () => {
  it("round-trips every route", () => {
    for (const path of [
      "/",
      "/c/abc123",
      "/billing",
      "/projects",
      "/p/x1",
      "/library",
      "/plugins",
      "/skills",
      "/automations",
      "/code",
    ]) {
      expect(routePath(parsePath(path))).toBe(path)
    }
  })

  it("treats unknown paths as a new chat", () => {
    expect(parsePath("/whatever")).toEqual({ name: "chat", conversationId: null })
  })
})

describe("modelLabel", () => {
  it("turns model ids into readable names", () => {
    expect(modelLabel("anthropic/claude-sonnet-4.5")).toBe("Claude Sonnet 4.5")
    expect(modelLabel("llama3:8b-instruct-q4_K_M")).toBe("Llama3")
    expect(modelLabel("")).toBe("Kothora Auto")
  })
})
