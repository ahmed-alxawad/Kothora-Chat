import { For, Show } from "solid-js"
import { initials } from "../../lib/format"
import { setTheme, theme, type ThemePreference } from "../../lib/theme"
import type { Usage, User } from "../../lib/types"
import { Icon, type IconName } from "../ui/Icon"
import { Menu } from "../ui/Menu"

const THEMES: { id: ThemePreference; label: string; icon: IconName }[] = [
  { id: "system", label: "System", icon: "monitor" },
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
]

/** The account button at the foot of the sidebar: plan, usage, theme, sign out. */
export function AccountMenu(props: {
  user: User | undefined
  usage: Usage | undefined
  onShowPlans: () => void
  onSignOut: () => void
}) {
  const percentUsed = () => {
    const usage = props.usage
    return usage
      ? Math.min(100, Math.round((usage.used_this_month / usage.monthly_limit) * 100))
      : 0
  }

  return (
    <div class="account">
      <Menu
        label="Account and settings"
        triggerClass="account-button"
        placement="above"
        trigger={
          <>
            <span class="avatar" aria-hidden="true">
              {initials(props.user?.name ?? "")}
            </span>
            <span class="account-text">
              <span class="account-name">{props.user?.name ?? "…"}</span>
              <span class="account-plan">{props.usage?.plan_name ?? ""} plan</span>
            </span>
          </>
        }
      >
        {(close) => (
          <>
            <div class="menu-section">
              <span class="menu-caption">{props.user?.email}</span>
            </div>
            <Show when={props.usage}>
              {(usage) => (
                <div class="menu-section usage">
                  <div class="usage-row">
                    <span>Queries this month</span>
                    <span class="numeric">
                      {usage().used_this_month} / {usage().monthly_limit}
                    </span>
                  </div>
                  <div
                    class="meter"
                    role="meter"
                    aria-label="Monthly queries used"
                    aria-valuenow={percentUsed()}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div style={{ width: `${percentUsed()}%` }} />
                  </div>
                  <Show when={usage().daily_limit !== null}>
                    <span class="menu-caption">
                      {usage().used_today} of {usage().daily_limit} today · resets at midnight Dhaka
                      time
                    </span>
                  </Show>
                </div>
              )}
            </Show>
            <button
              type="button"
              role="menuitem"
              class="menu-item"
              onClick={() => {
                close()
                props.onShowPlans()
              }}
            >
              <Icon name="card" size={16} />
              {props.usage?.plan_id === "free" ? "Upgrade plan" : "Plans and billing"}
            </button>
            <div class="menu-section">
              <span class="menu-caption">Theme</span>
              <div class="segmented" role="radiogroup" aria-label="Theme">
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
            <button
              type="button"
              role="menuitem"
              class="menu-item"
              onClick={() => {
                close()
                props.onSignOut()
              }}
            >
              <Icon name="logout" size={16} /> Sign out
            </button>
          </>
        )}
      </Menu>
    </div>
  )
}
