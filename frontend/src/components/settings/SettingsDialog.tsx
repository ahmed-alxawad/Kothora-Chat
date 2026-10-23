import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import { safeResource } from "../../lib/resource"
import type { SettingsSection } from "../../app-context"
import { api } from "../../lib/api"
import { Dialog } from "../ui/Dialog"
import { Icon, type IconName } from "../ui/Icon"
import { ConnectorsPanel, SkillsPanel } from "../extensions/Panels"
import {
  AccountSection,
  ApiKeysSection,
  BillingSection,
  CapabilitiesSection,
  GeneralSection,
  MemorySection,
  PersonalizationSection,
  PrivacySection,
  UsageSection,
} from "./Sections"

type NavItem = { id: SettingsSection; label: string; icon: IconName; keywords: string }

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Settings",
    items: [
      {
        id: "general",
        label: "General",
        icon: "settings",
        keywords: "appearance theme dark light language bangla",
      },
      { id: "account", label: "Account", icon: "user", keywords: "name email profile sign out" },
      { id: "privacy", label: "Privacy", icon: "shield", keywords: "incognito data history" },
      {
        id: "billing",
        label: "Billing",
        icon: "card",
        keywords: "plan payment bkash nagad invoice",
      },
      { id: "usage", label: "Usage", icon: "chart", keywords: "queries limit quota forecast" },
      {
        id: "capabilities",
        label: "Capabilities",
        icon: "sparkle",
        keywords: "models search academic code",
      },
      { id: "memory", label: "Memory", icon: "brain", keywords: "remember forget" },
    ],
  },
  {
    label: "Customize",
    items: [
      {
        id: "personalization",
        label: "Personalization",
        icon: "sliders",
        keywords: "instructions about me style",
      },
      {
        id: "skills",
        label: "Skills",
        icon: "pen",
        keywords: "skill instructions editor translator",
      },
      {
        id: "connectors",
        label: "Connectors",
        icon: "plug",
        keywords: "google drive gmail github notion",
      },
    ],
  },
  {
    label: "Platform",
    items: [{ id: "api", label: "API keys", icon: "key", keywords: "developer api business" }],
  },
]

export function SettingsDialog(props: { section: SettingsSection; onClose: () => void }) {
  const [section, setSection] = createSignal<SettingsSection>(props.section)
  const [query, setQuery] = createSignal("")
  // One request shared by every section that edits preferences.
  const [preferences, { mutate: setPreferences }] = safeResource(api.preferences)

  const groups = createMemo(() => {
    const needle = query().trim().toLowerCase()
    if (!needle) return GROUPS
    return GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${item.keywords}`.toLowerCase().includes(needle),
      ),
    })).filter((group) => group.items.length > 0)
  })
  const title = () =>
    GROUPS.flatMap((group) => group.items).find((item) => item.id === section())?.label

  return (
    <Dialog label="Settings" onClose={props.onClose} size="large">
      <div class="settings">
        <nav class="settings-nav" aria-label="Settings sections">
          <label class="search-field small">
            <Icon name="search" size={16} />
            <span class="visually-hidden">Search settings</span>
            <input
              id="settings-search"
              placeholder="Search settings"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
          </label>
          <For each={groups()}>
            {(group) => (
              <section>
                <h3 class="settings-group">{group.label}</h3>
                <For each={group.items}>
                  {(item) => (
                    <button
                      type="button"
                      class="nav-item"
                      classList={{ active: section() === item.id }}
                      aria-current={section() === item.id ? "page" : undefined}
                      onClick={() => setSection(item.id)}
                    >
                      <Icon name={item.icon} size={17} />
                      <span>{item.label}</span>
                    </button>
                  )}
                </For>
              </section>
            )}
          </For>
        </nav>
        <div class="settings-body">
          <h2 class="settings-title">{title()}</h2>
          <Switch>
            <Match when={section() === "general"}>
              <GeneralSection preferences={preferences} onSaved={setPreferences} />
            </Match>
            <Match when={section() === "account"}>
              <AccountSection onClose={props.onClose} />
            </Match>
            <Match when={section() === "privacy"}>
              <PrivacySection preferences={preferences} onSaved={setPreferences} />
            </Match>
            <Match when={section() === "billing"}>
              <BillingSection onClose={props.onClose} />
            </Match>
            <Match when={section() === "usage"}>
              <UsageSection />
            </Match>
            <Match when={section() === "capabilities"}>
              <CapabilitiesSection />
            </Match>
            <Match when={section() === "memory"}>
              <MemorySection preferences={preferences} onSaved={setPreferences} />
            </Match>
            <Match when={section() === "personalization"}>
              <PersonalizationSection preferences={preferences} onSaved={setPreferences} />
            </Match>
            <Match when={section() === "skills"}>
              <SkillsPanel compact />
            </Match>
            <Match when={section() === "connectors"}>
              <ConnectorsPanel compact />
            </Match>
            <Match when={section() === "api"}>
              <ApiKeysSection />
            </Match>
          </Switch>
          <Show when={groups().length === 0}>
            <p class="muted-text">No settings match “{query()}”.</p>
          </Show>
        </div>
      </div>
    </Dialog>
  )
}
