import { For, Show } from "solid-js"
import { useApp } from "../../app-context"
import { initials } from "../../lib/format"
import { navigate } from "../../lib/router"
import { setTheme, theme, type ThemePreference } from "../../lib/theme"
import { Icon, type IconName } from "../ui/Icon"
import { Menu } from "../ui/Menu"

const THEMES: { id: ThemePreference; label: string; icon: IconName }[] = [
  { id: "system", label: "System", icon: "monitor" },
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
]

/** The account button at the foot of the sidebar, with Claude-style account actions. */
export function AccountMenu() {
  const app = useApp()

  return (
    <div class="account">
      <Menu
        label="Account and settings"
        triggerClass="account-button"
        placement="above"
        trigger={
          <>
            <span class="avatar" aria-hidden="true">
              {initials(app.user()?.name ?? "")}
            </span>
            <span class="account-text">
              <span class="account-name">{app.user()?.name ?? "…"}</span>
              <span class="account-plan">{app.usage()?.plan_name ?? ""}</span>
            </span>
            <Icon name="chevronDown" size={15} class="account-chevron" />
          </>
        }
      >
        {(close) => {
          const item = (icon: IconName, label: string, action: () => void, hint?: string) => (
            <button
              type="button"
              role="menuitem"
              class="menu-item"
              onClick={() => {
                close()
                action()
              }}
            >
              <Icon name={icon} size={16} />
              <span>{label}</span>
              <Show when={hint}>
                <kbd class="menu-hint">{hint}</kbd>
              </Show>
            </button>
          )
          return (
            <>
              <div class="menu-section">
                <span class="menu-caption">{app.user()?.email}</span>
              </div>
              {item("settings", "Settings", () => app.openSettings("general"), "Ctrl ⇧ ,")}
              {item("chart", "Usage", () => app.openSettings("usage"))}
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={app.incognito()}
                class="menu-item"
                onClick={() => app.setIncognito(!app.incognito())}
              >
                <Icon name="ghost" size={16} />
                <span>Incognito</span>
                <span class="switch" classList={{ on: app.incognito() }} aria-hidden="true" />
              </button>
              <div class="menu-section">
                <span class="menu-caption">Appearance</span>
                <div class="segmented" role="radiogroup" aria-label="Appearance">
                  <For each={THEMES}>
                    {(option) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={theme() === option.id}
                        classList={{ active: theme() === option.id }}
                        onClick={() => setTheme(option.id)}
                      >
                        <Icon name={option.icon} size={15} />
                        {option.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>
              <hr class="menu-rule" />
              {item("globe", "Language", () => app.openSettings("general"))}
              {item("help", "Get help", app.openShortcuts)}
              {item("card", "View all plans", () => navigate({ name: "plans" }))}
              {item("terminal", "Get Kothora Code", () => navigate({ name: "code" }))}
              <hr class="menu-rule" />
              {item("logout", "Log out", app.signOut)}
            </>
          )
        }}
      </Menu>
    </div>
  )
}
