import { createSignal, Show } from "solid-js"
import { api } from "../../lib/api"
import { copyText } from "../../lib/clipboard"
import { modelLabel } from "../../lib/format"
import { toPlainText } from "../../lib/markdown"
import type { ThreadMessage } from "../../lib/types"
import { Icon } from "../ui/Icon"
import { Markdown } from "./Markdown"
import { SourceCards } from "./SourceCards"

export function UserMessage(props: { message: ThreadMessage }) {
  return (
    <article class="turn user" aria-label="Your message">
      <div class="user-bubble">{props.message.content}</div>
    </article>
  )
}

export function AssistantMessage(props: {
  message: ThreadMessage
  conversationId: string | null
  canExportBibliography: boolean
}) {
  const streaming = () => props.message.phase !== undefined && props.message.phase !== "done"
  const status = () => {
    const sources = props.message.sources.length
    switch (props.message.phase) {
      case "searching":
        return "Searching the web…"
      case "thinking":
        return sources ? `Reading ${sources} sources…` : "Thinking…"
      default:
        return ""
    }
  }

  return (
    <article class="turn assistant" aria-label="Kothora's answer" aria-busy={streaming()}>
      <Show when={props.message.notice}>
        <p class="inline-notice">
          <Icon name="alert" size={15} />
          {props.message.notice}
        </p>
      </Show>
      <Show when={props.message.sources.length > 0}>
        <SourceCards sources={props.message.sources} />
      </Show>
      <Show when={status()}>
        <p class="status-line" role="status">
          <span class="shimmer">{status()}</span>
        </p>
      </Show>
      <Show when={props.message.content}>
        <Show when={props.message.sources.length > 0}>
          <h3 class="section-label">Answer</h3>
        </Show>
        <Markdown text={props.message.content} sources={props.message.sources} />
      </Show>
      <Show when={!streaming() && props.message.content}>
        <AnswerActions
          message={props.message}
          conversationId={props.conversationId}
          canExportBibliography={props.canExportBibliography}
        />
      </Show>
    </article>
  )
}

function AnswerActions(props: {
  message: ThreadMessage
  conversationId: string | null
  canExportBibliography: boolean
}) {
  const [copied, setCopied] = createSignal(false)
  const [exportText, setExportText] = createSignal("")
  const [exportError, setExportError] = createSignal("")

  async function copy() {
    if (await copyText(toPlainText(props.message.content))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  // Shown as selectable text rather than a file download, which embedded viewers block.
  async function showBibliography() {
    setExportError("")
    try {
      setExportText(await api.bibliography(props.conversationId ?? "", props.message.id, "bibtex"))
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div class="answer-actions">
      <button
        type="button"
        class="icon-button"
        onClick={copy}
        aria-label={copied() ? "Copied" : "Copy answer"}
      >
        <Icon name={copied() ? "check" : "copy"} size={16} />
      </button>
      <Show when={props.canExportBibliography && props.message.sources.length > 0}>
        <button type="button" class="ghost small" onClick={showBibliography}>
          <Icon name="download" size={15} /> BibTeX
        </button>
      </Show>
      <Show when={props.message.model}>
        <span class="model-tag" title={props.message.model ?? undefined}>
          {props.message.route === "cache" ? "Cached · " : ""}
          {modelLabel(props.message.model ?? "")}
        </span>
      </Show>
      <Show when={exportError()}>
        <span class="error-text">{exportError()}</span>
      </Show>
      <Show when={exportText()}>
        <textarea class="bibliography" readOnly rows={6} value={exportText()} aria-label="BibTeX" />
      </Show>
    </div>
  )
}
