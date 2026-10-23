import { describe, expect, it } from "vitest"
import { formatBdt, safeUrl, splitCitations } from "./citations"

describe("splitCitations", () => {
  it("splits text around citations that point at real sources", () => {
    expect(splitCitations("Dhaka is the capital [1][2].", 2)).toEqual([
      { kind: "text", text: "Dhaka is the capital " },
      { kind: "citation", n: 1 },
      { kind: "citation", n: 2 },
      { kind: "text", text: "." },
    ])
  })

  it("leaves invented citation numbers as plain text", () => {
    expect(splitCitations("Claim [7].", 2)).toEqual([{ kind: "text", text: "Claim [7]." }])
  })

  it("returns nothing for empty text", () => {
    expect(splitCitations("", 3)).toEqual([])
  })
})

describe("safeUrl", () => {
  it("allows http and https only", () => {
    expect(safeUrl("https://example.org/a")).toBe("https://example.org/a")
    expect(safeUrl("javascript:alert(1)")).toBeUndefined()
    expect(safeUrl("not a url")).toBeUndefined()
  })
})

describe("formatBdt", () => {
  it("formats taka with thousands separators", () => {
    expect(formatBdt(15300)).toBe("৳15,300")
  })
})
