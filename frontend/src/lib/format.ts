/** Only http(s) links are rendered, so a hostile search result cannot inject javascript: URLs. */
export function safeUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/** "en.wikipedia.org" -> "wikipedia.org"; "" for anything that is not a URL. */
export function displayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^(www|en|bn|m)\./, "")
  } catch {
    return ""
  }
}

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString("en-US")}`
}

/** Up to two initials for an avatar: "Asha Rahman" -> "AR". */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => Array.from(word)[0])
  return (
    letters.length > 1 ? letters[0] + letters[letters.length - 1] : (letters[0] ?? "?")
  ).toUpperCase()
}

export const AUTO_MODEL_LABEL = "Kothora Auto"

/** A readable model name: "anthropic/claude-sonnet-4.5" -> "Claude Sonnet 4.5". Empty means Auto. */
export function modelLabel(id: string): string {
  if (!id) return AUTO_MODEL_LABEL
  const name = id.split("/").pop() ?? id
  // Local tags such as "llama3:8b-instruct-q4_K_M" keep only the model name.
  return name
    .split(":")[0]
    .split("-")
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
}
