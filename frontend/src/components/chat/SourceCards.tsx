import { createSignal, For, Show } from "solid-js"
import { displayDomain, safeUrl } from "../../lib/format"
import type { Source } from "../../lib/types"

const VISIBLE_CARDS = 3

/** Sources as a row of cards above the answer; the last card expands the full list. */
export function SourceCards(props: { sources: Source[] }) {
  const [expanded, setExpanded] = createSignal(false)
  const visible = () => (expanded() ? props.sources : props.sources.slice(0, VISIBLE_CARDS))
  const hidden = () => props.sources.length - VISIBLE_CARDS

  return (
    <section class="sources" aria-label="Sources">
      <h3 class="section-label">Sources</h3>
      <div class="source-grid">
        <For each={visible()}>
          {(source) => (
            <a
              class="source-card"
              classList={{ uncited: source.cited === false }}
              href={safeUrl(source.url)}
              target="_blank"
              rel="noopener noreferrer"
              title={source.title}
            >
              <span class="source-title">{source.title || source.url}</span>
              <span class="source-meta">
                <span class="source-avatar" aria-hidden="true">
                  {displayDomain(source.url).charAt(0).toUpperCase() || "?"}
                </span>
                <span class="source-domain">{displayDomain(source.url)}</span>
                <span class="source-n">{source.n}</span>
              </span>
            </a>
          )}
        </For>
        <Show when={!expanded() && hidden() > 0}>
          <button type="button" class="source-card more" onClick={() => setExpanded(true)}>
            <span class="source-title">View {hidden()} more</span>
            <span class="source-meta">
              <For each={props.sources.slice(VISIBLE_CARDS, VISIBLE_CARDS + 4)}>
                {(source) => (
                  <span class="source-avatar" aria-hidden="true">
                    {displayDomain(source.url).charAt(0).toUpperCase()}
                  </span>
                )}
              </For>
            </span>
          </button>
        </Show>
      </div>
    </section>
  )
}
