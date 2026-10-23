import { describe, expect, it } from "vitest"
import { SseParser } from "./sse"

describe("SseParser", () => {
  it("parses complete events", () => {
    const parser = new SseParser()
    const events = parser.push(
      'data: {"type":"delta","text":"a"}\n\ndata: {"type":"delta","text":"b"}\n\n',
    )
    expect(events).toEqual([
      { type: "delta", text: "a" },
      { type: "delta", text: "b" },
    ])
  })

  it("keeps an event split across chunks until it is complete", () => {
    const parser = new SseParser()
    expect(parser.push('data: {"type":"del')).toEqual([])
    expect(parser.push('ta","text":"বাংলা"}\r\n')).toEqual([])
    expect(parser.push("\r\n")).toEqual([{ type: "delta", text: "বাংলা" }])
  })

  it("ignores comments and blank blocks", () => {
    expect(new SseParser().push(": keep-alive\n\n\n\n")).toEqual([])
  })

  it("fails loudly on malformed data", () => {
    expect(() => new SseParser().push("data: {oops\n\n")).toThrow(/Malformed event/)
  })
})
