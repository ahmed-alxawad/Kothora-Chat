import { Show } from "solid-js"
import { navigate } from "../../lib/router"
import { ConnectorsPanel, SkillsPanel } from "../extensions/Panels"
import { PageHeader } from "../ui/States"

/** Plugins and Skills, as tabs, like ChatGPT's Plugins page. */
export function PluginsPage(props: { tab: "plugins" | "skills" }) {
  return (
    <div class="page narrow">
      <div class="tabs top" role="tablist" aria-label="Extensions">
        <button
          type="button"
          role="tab"
          aria-selected={props.tab === "plugins"}
          classList={{ active: props.tab === "plugins" }}
          onClick={() => navigate({ name: "plugins", tab: "plugins" })}
        >
          Plugins
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={props.tab === "skills"}
          classList={{ active: props.tab === "skills" }}
          onClick={() => navigate({ name: "plugins", tab: "skills" })}
        >
          Skills
        </button>
      </div>
      <Show
        when={props.tab === "skills"}
        fallback={
          <>
            <PageHeader
              title="Plugins"
              subtitle="Connect your tools so Kothora can search and cite them."
            />
            <ConnectorsPanel />
          </>
        }
      >
        <PageHeader
          title="Skills"
          subtitle="Reusable instructions. Use one from the + menu in the message box."
        />
        <SkillsPanel />
      </Show>
    </div>
  )
}
