export type Segment = { kind: "text"; text: string } | { kind: "citation"; n: number }

const CITATION = /\[(\d{1,2})\]/g

/** Split an answer into plain text and [n] citation markers that point at a real source. */
export function splitCitations(text: string, sourceCount: number): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const match of text.matchAll(CITATION)) {
    const n = Number(match[1])
    if (n < 1 || n > sourceCount) continue
    const start = match.index ?? 0
    if (start > last) segments.push({ kind: "text", text: text.slice(last, start) })
    segments.push({ kind: "citation", n })
    last = start + match[0].length
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) })
  return segments
}

/** Only http(s) links are rendered, so a hostile search result cannot inject javascript: URLs. */
export function safeUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined
  } catch {
    return undefined
  }
}

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString("en-US")}`
}
