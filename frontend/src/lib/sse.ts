import type { ChatEvent } from "./types"

/**
 * Incremental Server-Sent Events parser. Network chunks can split an event anywhere,
 * so unfinished text is kept until its blank-line terminator arrives.
 */
export class SseParser {
  private buffer = ""

  push(chunk: string): ChatEvent[] {
    this.buffer += chunk.replace(/\r\n/g, "\n")
    const events: ChatEvent[] = []
    let boundary = this.buffer.indexOf("\n\n")
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary)
      this.buffer = this.buffer.slice(boundary + 2)
      const event = parseBlock(block)
      if (event) events.push(event)
      boundary = this.buffer.indexOf("\n\n")
    }
    return events
  }
}

function parseBlock(block: string): ChatEvent | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
  if (!data) return null
  try {
    return JSON.parse(data) as ChatEvent
  } catch {
    throw new Error(`Malformed event from server: ${data.slice(0, 200)}`)
  }
}
