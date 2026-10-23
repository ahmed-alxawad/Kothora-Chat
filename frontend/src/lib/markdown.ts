/**
 * A small Markdown parser for model answers. It returns a tree that components render
 * as DOM nodes, never as an HTML string, so model output and search snippets cannot
 * inject markup. It covers what chat models actually write: headings, paragraphs,
 * lists, fenced code, block quotes, tables, rules, and inline bold, italic, code,
 * links and [n] citations. Unclosed constructs (common mid-stream) degrade to text.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: Inline[] }
  | { kind: "citation"; n: number }

export type ListItem = { depth: number; inlines: Inline[] }

export type Block =
  | { kind: "heading"; level: number; inlines: Inline[] }
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "code"; lang: string; code: string; closed: boolean }
  | { kind: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { kind: "quote"; inlines: Inline[] }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][] }
  | { kind: "rule" }

const FENCE = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const LIST_ITEM = /^(\s*)([-*+]|(\d{1,9})[.)])\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/
const MAX_LIST_DEPTH = 3
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

/** Parse Markdown. `sourceCount` decides which [n] markers become citations. */
export function parseMarkdown(markdown: string, sourceCount = 0): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  const inline = (text: string) => parseInline(text, sourceCount)
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index++
      continue
    }

    const fence = FENCE.exec(line)
    if (fence) {
      const body: string[] = []
      index++
      while (index < lines.length && !lines[index].trim().startsWith(fence[1])) {
        body.push(lines[index++])
      }
      const closed = index < lines.length
      if (closed) index++
      blocks.push({ kind: "code", lang: fence[2], code: body.join("\n"), closed })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, inlines: inline(heading[2]) })
      index++
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ kind: "rule" })
      index++
      continue
    }

    if (isTableStart(lines, index)) {
      const header = splitRow(line).map(inline)
      index += 2
      const rows: Inline[][][] = []
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitRow(lines[index++]).map(inline))
      }
      blocks.push({ kind: "table", header, rows })
      continue
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = []
      while (index < lines.length && QUOTE.test(lines[index])) {
        quoted.push(QUOTE.exec(lines[index++])![1])
      }
      blocks.push({ kind: "quote", inlines: inline(quoted.join(" ")) })
      continue
    }

    const first = LIST_ITEM.exec(line)
    if (first) {
      const ordered = first[3] !== undefined
      // Collect each item's raw text first, so emphasis or a link that wraps onto a
      // continuation line is parsed as one span.
      const rawItems: { depth: number; text: string }[] = []
      while (index < lines.length) {
        const item = LIST_ITEM.exec(lines[index])
        if (item) {
          if ((item[3] !== undefined) !== ordered && item[1].length === 0) break
          const depth = Math.min(MAX_LIST_DEPTH, Math.floor(item[1].length / 2))
          rawItems.push({ depth, text: item[4] })
          index++
        } else if (lines[index].trim() && /^\s{2,}/.test(lines[index]) && rawItems.length) {
          // An indented continuation line belongs to the previous item.
          rawItems[rawItems.length - 1].text += " " + lines[index].trim()
          index++
        } else {
          break
        }
      }
      const items: ListItem[] = rawItems.map(({ depth, text }) => ({
        depth,
        inlines: inline(text),
      }))
      blocks.push({ kind: "list", ordered, start: ordered ? Number(first[3]) : 1, items })
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim() && !startsBlock(lines, index)) {
      paragraph.push(lines[index++].trim())
    }
    blocks.push({ kind: "paragraph", inlines: inline(paragraph.join(" ")) })
  }
  return blocks
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index]
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    isTableStart(lines, index)
  )
}

function isTableStart(lines: string[], index: number): boolean {
  const next = lines[index + 1]
  return lines[index].includes("|") && next !== undefined && TABLE_SEPARATOR.test(next)
}

function splitRow(line: string): string[] {
  let row = line.trim()
  if (row.startsWith("|")) row = row.slice(1)
  if (row.endsWith("|")) row = row.slice(0, -1)
  return row.split("|").map((cell) => cell.trim())
}

// Order matters: code spans first so their contents are never parsed further.
const INLINE =
  /`([^`\n]+)`|\*\*([^\n]+?)\*\*|__([^\n]+?)__|\[(\d{1,2})\]|\[([^\]\n]+)\]\(([^)\s]+)\)|(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])|(?<!\w)_(?!\s)([^_\n]+?)_(?!\w)/g

export function parseInline(text: string, sourceCount = 0): Inline[] {
  const result: Inline[] = []
  let last = 0
  const pushText = (value: string) => {
    if (!value) return
    const previous = result[result.length - 1]
    if (previous?.kind === "text") previous.text += value
    else result.push({ kind: "text", text: value })
  }

  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0
    const [whole, code, bold, boldAlt, citation, linkText, href, italic, italicAlt] = match
    let node: Inline | null = null
    if (code !== undefined) node = { kind: "code", text: code }
    else if (bold !== undefined || boldAlt !== undefined)
      node = { kind: "strong", children: parseInline(bold ?? boldAlt, sourceCount) }
    else if (citation !== undefined) {
      const n = Number(citation)
      // A citation to a source that does not exist stays visible as plain text.
      if (n >= 1 && n <= sourceCount) node = { kind: "citation", n }
    } else if (linkText !== undefined)
      node = { kind: "link", href, children: parseInline(linkText, sourceCount) }
    else if (italic !== undefined || italicAlt !== undefined)
      node = { kind: "em", children: parseInline(italic ?? italicAlt, sourceCount) }

    if (!node) continue
    pushText(text.slice(last, start))
    result.push(node)
    last = start + whole.length
  }
  pushText(text.slice(last))
  return result
}

/** Plain text of an answer, for copying: Markdown markers and citations removed. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/\[(\d{1,2})\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .trim()
}
