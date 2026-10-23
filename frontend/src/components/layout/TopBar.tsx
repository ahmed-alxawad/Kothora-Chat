import { Show } from "solid-js"
import { useApp } from "../../app-context"
import { navigate, route } from "../../lib/router"
import { Icon } from "../ui/Icon"

/**
 * The bar above the page: sidebar controls when it is hidden, the Chat | Code switch
 * (ChatGPT's Chat | Work), and on the right Incognito and, on the free plan, Upgrade.
 */
export function TopBar(props: { sidebarOpen: boolean; onOpenSidebar: () => void }) {
  const app = useApp()
  const onCode = () => route().name === "code"

  return (
    <header class="topbar">
      <div class="topbar-start">
        <Show when={!props.sidebarOpen}>
          <button
            type="button"
            class="icon-button"
            onClick={props.onOpenSidebar}
            aria-label="Open sidebar"
          >
            <Icon name="sidebar" />
          </button>
          <button
            type="button"
            class="icon-button"
            onClick={() => app.newChat()}
            aria-label="New chat"
          >
            <Icon name="edit" />
          </button>
        </Show>
      </div>

      <div class="segmented product-switch" role="tablist" aria-label="Product">
        <button
          type="button"
          role="tab"
          aria-selected={!onCode()}
          classList={{ active: !onCode() }}
          onClick={() => app.newChat()}
        >
          Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onCode()}
          classList={{ active: onCode() }}
          onClick={() => navigate({ name: "code" })}
        >
          Code
        </button>
      </div>

      <div class="topbar-end">
        <Show when={app.usage()?.plan_id === "free"}>
          <button type="button" class="upgrade-button" onClick={() => navigate({ name: "plans" })}>
            <Icon name="sparkle" size={15} /> Upgrade
          </button>
        </Show>
        <button
          type="button"
          class="icon-button"
          classList={{ pressed: app.incognito() }}
          aria-pressed={app.incognito()}
          aria-label={app.incognito() ? "Turn off incognito" : "Start an incognito chat"}
          title={app.incognito() ? "Incognito is on: new chats are not saved" : "Incognito chat"}
          onClick={() => {
            const turningOn = !app.incognito()
            app.setIncognito(turningOn)
            if (turningOn) app.newChat()
          }}
        >
          <Icon name="ghost" />
        </button>
      </div>
    </header>
  )
}
