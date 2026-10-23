/**
 * Text files attached in the composer are sent inside the message, so they work with
 * today's backend. Images and PDFs need server-side upload, which is planned
 * (docs/frontend-api-contract.md).
 */
export type Attachment = { name: string; text: string }

export const MAX_ATTACHMENT_BYTES = 100 * 1024
const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|csv|tsv|json|xml|html|css|js|jsx|ts|tsx|py|java|c|cpp|h|go|rs|rb|php|sql|sh|yaml|yml|toml|ini|log)$/i

export class AttachmentError extends Error {}

export function checkAttachable(file: { name: string; size: number; type: string }): void {
  const isText = file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name)
  if (!isText) {
    throw new AttachmentError(`${file.name}: only text files can be attached for now.`)
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentError(`${file.name} is larger than ${MAX_ATTACHMENT_BYTES / 1024} KB.`)
  }
}

/** The message as sent: the question, then each file in a fenced block. */
export function withAttachments(question: string, attachments: Attachment[]): string {
  if (attachments.length === 0) return question
  const blocks = attachments.map((file) => {
    // A fence longer than any backtick run inside the file keeps the block intact.
    const longestRun = Math.max(0, ...(file.text.match(/`+/g) ?? []).map((run) => run.length))
    const fence = "`".repeat(Math.max(3, longestRun + 1))
    return `Attached file: ${file.name}\n${fence}\n${file.text}\n${fence}`
  })
  return `${question}\n\n${blocks.join("\n\n")}`
}
