import { createSignal, For, Show } from "solid-js"
import { api } from "../lib/api"
import { safeUrl, splitCitations } from "../lib/citations"
import type { Message } from "../lib/types"

export function MessageView(props: {
  message: Message
  conversationId: string
  canExportBibliography: boolean
  streaming?: boolean
}) {
  const [exportError, setExportError] = createSignal("")
  const segments = () => splitCitations(props.message.content, props.message.sources.length)

  async function download(format: "bibtex" | "text") {
    setExportError("")
    try {
      const text = await api.bibliography(props.conversationId, props.message.id, format)
      const blob = new Blob([text], { type: "text/plain" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = format === "bibtex" ? "kothora-sources.bib" : "kothora-sources.txt"
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <article class={`message ${props.message.role}`}>
      <div class="bubble">
        <For each={segments()}>
          {(segment) =>
            segment.kind === "text" ? (
              <span>{segment.text}</span>
            ) : (
              <a
                class="cite"
                href={safeUrl(props.message.sources[segment.n - 1]?.url ?? "")}
                target="_blank"
                rel="noopener noreferrer"
                title={props.message.sources[segment.n - 1]?.title}
              >
                {segment.n}
              </a>
            )
          }
        </For>
        <Show when={props.streaming}>
          <span class="caret" aria-hidden="true" />
        </Show>
      </div>
      <Show when={props.message.role === "assistant" && props.message.sources.length > 0}>
        <ol class="sources">
          <For each={props.message.sources}>
            {(source) => (
              <li classList={{ uncited: source.cited === false }}>
                <a href={safeUrl(source.url)} target="_blank" rel="noopener noreferrer">
                  {source.title || source.url}
                </a>
                <Show when={source.kind === "scholarly" && source.year}>
                  <span class="muted">
                    {" "}
                    · {source.authors[0]}
                    {source.authors.length > 1 ? " et al." : ""} ({source.year})
                  </span>
                </Show>
              </li>
            )}
          </For>
        </ol>
        <Show when={props.canExportBibliography && !props.streaming}>
          <div class="export">
            <button class="link" onClick={() => download("bibtex")}>
              Export BibTeX
            </button>
            <button class="link" onClick={() => download("text")}>
              Export reference list
            </button>
            <Show when={exportError()}>
              <span class="error">{exportError()}</span>
            </Show>
          </div>
        </Show>
      </Show>
      <Show when={props.message.role === "assistant" && props.message.model && !props.streaming}>
        <div class="meta muted">
          {props.message.route === "cache" ? "cached · " : ""}
          {props.message.model}
        </div>
      </Show>
    </article>
  )
}
