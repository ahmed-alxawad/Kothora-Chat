import { describe, expect, it } from "vitest"
import { parseInline, parseMarkdown, toPlainText } from "./markdown"

describe("parseMarkdown", () => {
  it("parses headings, paragraphs and rules", () => {
    expect(parseMarkdown("## Title\n\nOne\ntwo\n\n---")).toEqual([
      { kind: "heading", level: 2, inlines: [{ kind: "text", text: "Title" }] },
      { kind: "paragraph", inlines: [{ kind: "text", text: "One two" }] },
      { kind: "rule" },
    ])
  })

  it("parses fenced code and keeps an unclosed fence open while streaming", () => {
    expect(parseMarkdown("```py\nprint(1)\n```")).toEqual([
      { kind: "code", lang: "py", code: "print(1)", closed: true },
    ])
    expect(parseMarkdown("```\nx = **1**")).toEqual([
      { kind: "code", lang: "", code: "x = **1**", closed: false },
    ])
  })

  it("parses ordered lists with nesting and continuation lines", () => {
    const [list] = parseMarkdown("3. a\n  - b\n   more\n4. c")
    expect(list).toMatchObject({ kind: "list", ordered: true, start: 3 })
    if (list.kind !== "list") throw new Error("expected a list")
    expect(list.items.map((item) => item.depth)).toEqual([0, 1, 0])
    expect(list.items[1].inlines).toEqual([{ kind: "text", text: "b more" }])
  })

  it("parses tables", () => {
    const [table] = parseMarkdown("| Plan | BDT |\n|---|---:|\n| Pro | 1,500 |")
    expect(table).toEqual({
      kind: "table",
      header: [[{ kind: "text", text: "Plan" }], [{ kind: "text", text: "BDT" }]],
      rows: [[[{ kind: "text", text: "Pro" }], [{ kind: "text", text: "1,500" }]]],
    })
  })

  it("parses block quotes", () => {
    expect(parseMarkdown("> a\n> b")).toEqual([
      { kind: "quote", inlines: [{ kind: "text", text: "a b" }] },
    ])
  })

  it("returns nothing for empty input", () => {
    expect(parseMarkdown("")).toEqual([])
    expect(parseMarkdown("\n \n")).toEqual([])
  })
})

describe("parseInline", () => {
  it("parses bold, italic, code and links", () => {
    expect(parseInline("**b** *i* `c` [k](https://x.org)")).toEqual([
      { kind: "strong", children: [{ kind: "text", text: "b" }] },
      { kind: "text", text: " " },
      { kind: "em", children: [{ kind: "text", text: "i" }] },
      { kind: "text", text: " " },
      { kind: "code", text: "c" },
      { kind: "text", text: " " },
      { kind: "link", href: "https://x.org", children: [{ kind: "text", text: "k" }] },
    ])
  })

  it("turns [n] into citations only for sources that exist", () => {
    expect(parseInline("A [1][2]. B [7].", 2)).toEqual([
      { kind: "text", text: "A " },
      { kind: "citation", n: 1 },
      { kind: "citation", n: 2 },
      { kind: "text", text: ". B [7]." },
    ])
  })

  it("leaves snake_case and code contents alone", () => {
    expect(parseInline("use snake_case_name and `**not bold**`")).toEqual([
      { kind: "text", text: "use snake_case_name and " },
      { kind: "code", text: "**not bold**" },
    ])
  })
})

describe("toPlainText", () => {
  it("drops citations and emphasis markers", () => {
    expect(toPlainText("Dhaka is **big** [1].")).toBe("Dhaka is big.")
  })
})
