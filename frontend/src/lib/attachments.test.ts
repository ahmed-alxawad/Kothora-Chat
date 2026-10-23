import { describe, expect, it } from "vitest"
import { AttachmentError, checkAttachable, withAttachments } from "./attachments"

describe("attachments", () => {
  it("accepts text files and rejects others", () => {
    expect(() => checkAttachable({ name: "notes.md", size: 10, type: "" })).not.toThrow()
    expect(() => checkAttachable({ name: "data.csv", size: 10, type: "text/csv" })).not.toThrow()
    expect(() => checkAttachable({ name: "photo.jpg", size: 10, type: "image/jpeg" })).toThrow(
      AttachmentError,
    )
    expect(() =>
      checkAttachable({ name: "big.txt", size: 200 * 1024, type: "text/plain" }),
    ).toThrow(/larger/)
  })

  it("adds files after the question in fenced blocks", () => {
    expect(withAttachments("Summarise", [{ name: "a.txt", text: "hello" }])).toBe(
      "Summarise\n\nAttached file: a.txt\n```\nhello\n```",
    )
  })

  it("uses a longer fence when the file contains backticks", () => {
    const text = withAttachments("Q", [{ name: "r.md", text: "```js\nx\n```" }])
    expect(text).toContain("````\n```js\nx\n```\n````")
  })

  it("leaves a message without files unchanged", () => {
    expect(withAttachments("Q", [])).toBe("Q")
  })
})
