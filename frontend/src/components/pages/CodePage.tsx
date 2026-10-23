import { createSignal, For, Show } from "solid-js"
import { useApp } from "../../app-context"
import { copyText } from "../../lib/clipboard"
import { navigate } from "../../lib/router"
import { Icon } from "../ui/Icon"

// Kothora Code is the paid edition of YukiOshi Code; until it ships, this installs the
// YukiOshi Code release it is built on.
const INSTALL = {
  unix: "curl -fsSL https://raw.githubusercontent.com/ahmed-alxawad/YukiOshiCode/main/install | bash",
  windows:
    "irm https://raw.githubusercontent.com/ahmed-alxawad/YukiOshiCode/main/install.ps1 | iex",
}

const FEATURES = [
  "Reads and edits your code, runs commands and works through multi-step tasks",
  "Works with Claude, Codex, Gemini, OpenRouter and any OpenAI-compatible model server",
  "Permission modes and an optional sandbox keep it inside the limits you set",
  "Runs in your terminal on Linux, macOS and Windows",
]

/** The "Code" side of the Chat | Code switch: Kothora's coding assistant. */
export function CodePage() {
  const app = useApp()
  const [copied, setCopied] = createSignal<string | null>(null)

  async function copy(key: string, command: string) {
    if (await copyText(command)) {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    }
  }

  return (
    <div class="page narrow code-page">
      <header class="code-hero">
        <span class="code-hero-icon">
          <Icon name="terminal" size={26} />
        </span>
        <h1>Kothora Code</h1>
        <p>A coding assistant for your terminal. Included with Pro, Premium and Business plans.</p>
        <Show when={app.usage() && !app.usage()!.kothora_code}>
          <button type="button" class="primary" onClick={() => navigate({ name: "plans" })}>
            Get Pro to use Kothora Code
          </button>
        </Show>
      </header>

      <ul class="capability-list">
        <For each={FEATURES}>
          {(feature) => (
            <li>
              <Icon name="check" size={16} /> {feature}
            </li>
          )}
        </For>
      </ul>

      <h2 class="list-heading">Install</h2>
      <p class="muted-text small">
        Kothora Code is built on YukiOshi Code. Until its own release is out, install YukiOshi Code
        with one of these commands:
      </p>
      <For
        each={
          [
            ["unix", "macOS and Linux"],
            ["windows", "Windows (PowerShell)"],
          ] as [keyof typeof INSTALL, string][]
        }
      >
        {([key, label]) => (
          <figure class="code-block">
            <figcaption>
              <span>{label}</span>
              <button type="button" class="ghost small" onClick={() => copy(key, INSTALL[key])}>
                <Icon name={copied() === key ? "check" : "copy"} size={14} />
                {copied() === key ? "Copied" : "Copy"}
              </button>
            </figcaption>
            <pre>
              <code>{INSTALL[key]}</code>
            </pre>
          </figure>
        )}
      </For>
    </div>
  )
}
