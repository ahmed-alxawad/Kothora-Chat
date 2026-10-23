import { createMemo, createSignal, For, Index, Match, Show, Switch } from "solid-js"
import { Dynamic } from "solid-js/web"
import { copyText } from "../../lib/clipboard"
import { displayDomain, safeUrl } from "../../lib/format"
import { parseMarkdown, type Block, type Inline } from "../../lib/markdown"
import type { Source } from "../../lib/types"
import { Icon } from "../ui/Icon"

/**
 * Renders an answer. Blocks are keyed by position (<Index>), so while an answer streams
 * only the block being written re-renders, not the whole answer.
 */
export function Markdown(props: { text: string; sources: Source[] }) {
  const blocks = createMemo(() => parseMarkdown(props.text, props.sources.length))
  return (
    <div class="markdown">
      <Index each={blocks()}>
        {(block) => <BlockView block={block()} sources={props.sources} />}
      </Index>
    </div>
  )
}

function BlockView(props: { block: Block; sources: Source[] }) {
  const inlines = (items: Inline[]) => <Inlines items={items} sources={props.sources} />
  return (
    <Switch>
      <Match when={props.block.kind === "paragraph" && props.block}>
        {(block) => <p>{inlines(block().inlines)}</p>}
      </Match>
      <Match when={props.block.kind === "heading" && props.block}>
        {(block) => (
          <Dynamic component={`h${Math.min(block().level + 1, 6)}`}>
            {inlines(block().inlines)}
          </Dynamic>
        )}
      </Match>
      <Match when={props.block.kind === "list" && props.block}>
        {(block) => (
          <Dynamic
            component={block().ordered ? "ol" : "ul"}
            start={block().ordered ? block().start : undefined}
          >
            <For each={block().items}>
              {(item) => (
                <li style={{ "margin-left": `${item.depth * 1.25}rem` }}>
                  {inlines(item.inlines)}
                </li>
              )}
            </For>
          </Dynamic>
        )}
      </Match>
      <Match when={props.block.kind === "code" && props.block}>
        {(block) => <CodeBlock block={block()} />}
      </Match>
      <Match when={props.block.kind === "quote" && props.block}>
        {(block) => <blockquote>{inlines(block().inlines)}</blockquote>}
      </Match>
      <Match when={props.block.kind === "table" && props.block}>
        {(block) => (
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <For each={block().header}>{(cell) => <th>{inlines(cell)}</th>}</For>
                </tr>
              </thead>
              <tbody>
                <For each={block().rows}>
                  {(row) => (
                    <tr>
                      <For each={row}>{(cell) => <td>{inlines(cell)}</td>}</For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        )}
      </Match>
      <Match when={props.block.kind === "rule"}>
        <hr />
      </Match>
    </Switch>
  )
}

function Inlines(props: { items: Inline[]; sources: Source[] }) {
  return (
    <For each={props.items}>
      {(item) => (
        <Switch>
          <Match when={item.kind === "text" && item}>{(node) => node().text}</Match>
          <Match when={item.kind === "strong" && item}>
            {(node) => (
              <strong>
                <Inlines items={node().children} sources={props.sources} />
              </strong>
            )}
          </Match>
          <Match when={item.kind === "em" && item}>
            {(node) => (
              <em>
                <Inlines items={node().children} sources={props.sources} />
              </em>
            )}
          </Match>
          <Match when={item.kind === "code" && item}>{(node) => <code>{node().text}</code>}</Match>
          <Match when={item.kind === "link" && item}>
            {(node) => (
              <a href={safeUrl(node().href)} target="_blank" rel="noopener noreferrer">
                <Inlines items={node().children} sources={props.sources} />
              </a>
            )}
          </Match>
          <Match when={item.kind === "citation" && item}>
            {(node) => <Citation n={node().n} source={props.sources[node().n - 1]} />}
          </Match>
        </Switch>
      )}
    </For>
  )
}

/** A numbered pill; hovering or focusing it shows which source backs the claim. */
function Citation(props: { n: number; source: Source | undefined }) {
  return (
    <span class="citation">
      <a
        class="citation-pill"
        href={safeUrl(props.source?.url ?? "")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Source ${props.n}: ${props.source?.title ?? ""}`}
      >
        {props.n}
      </a>
      <Show when={props.source}>
        {(source) => (
          <span class="citation-card" role="tooltip">
            <span class="citation-domain">{displayDomain(source().url)}</span>
            <span class="citation-title">{source().title}</span>
            <Show when={source().snippet}>
              <span class="citation-snippet">{source().snippet}</span>
            </Show>
          </span>
        )}
      </Show>
    </span>
  )
}

function CodeBlock(props: { block: Extract<Block, { kind: "code" }> }) {
  const [copied, setCopied] = createSignal(false)
  async function copy() {
    if (await copyText(props.block.code)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <figure class="code-block">
      <figcaption>
        <span>{props.block.lang || "code"}</span>
        <button type="button" class="ghost small" onClick={copy}>
          <Icon name={copied() ? "check" : "copy"} size={14} />
          {copied() ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre>
        <code>{props.block.code}</code>
      </pre>
    </figure>
  )
}
