import { createSignal, For, Show, type JSX } from "solid-js"
import { safeResource, type SafeResource } from "../../lib/resource"
import { useApp } from "../../app-context"
import { api } from "../../lib/api"
import { forecastMonth, nextMonthStart } from "../../lib/forecast"
import { formatBdt, modelLabel } from "../../lib/format"
import { navigate } from "../../lib/router"
import { setTheme, theme, type ThemePreference } from "../../lib/theme"
import { showToast, toastError } from "../../lib/toast"
import type { Preferences, ResponseLanguage } from "../../lib/types"
import { Icon } from "../ui/Icon"
import { LoadError } from "../ui/States"

type PreferencesProps = {
  preferences: SafeResource<Preferences>
  onSaved: (preferences: Preferences) => void
}

export function SettingRow(props: { label: string; description?: string; children: JSX.Element }) {
  return (
    <div class="setting-row">
      <div class="setting-text">
        <h4>{props.label}</h4>
        <Show when={props.description}>
          <p>{props.description}</p>
        </Show>
      </div>
      <div class="setting-control">{props.children}</div>
    </div>
  )
}

export function Toggle(props: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      class="switch"
      classList={{ on: props.checked }}
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    />
  )
}

/** Save a change to preferences; shows "Saved" or what went wrong. */
async function savePreferences(
  current: Preferences | undefined,
  changes: Partial<Preferences>,
  onSaved: PreferencesProps["onSaved"],
) {
  if (!current) return
  try {
    onSaved(await api.savePreferences({ ...current, ...changes }))
    showToast("Saved")
  } catch (err) {
    toastError("Save settings", err, { planned: true })
  }
}

const LANGUAGES: { id: ResponseLanguage; label: string }[] = [
  { id: "auto", label: "Same as my question" },
  { id: "en", label: "English" },
  { id: "bn", label: "বাংলা (Bangla)" },
]

export function GeneralSection(props: PreferencesProps) {
  return (
    <div class="settings-section">
      <SettingRow
        label="Appearance"
        description="System follows your device's light or dark setting."
      >
        <div class="segmented" role="radiogroup" aria-label="Appearance">
          <For each={["system", "light", "dark"] as ThemePreference[]}>
            {(option) => (
              <button
                type="button"
                role="radio"
                aria-checked={theme() === option}
                classList={{ active: theme() === option }}
                onClick={() => setTheme(option)}
              >
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            )}
          </For>
        </div>
      </SettingRow>
      <SettingRow
        label="Answer language"
        description="The language Kothora answers in. The interface is in English for now."
      >
        <Show
          when={!props.preferences.error}
          fallback={<span class="muted-text">Not available on this server yet</span>}
        >
          <select
            id="answer-language"
            value={props.preferences()?.response_language ?? "auto"}
            disabled={!props.preferences()}
            onChange={(e) =>
              savePreferences(
                props.preferences(),
                { response_language: e.currentTarget.value as ResponseLanguage },
                props.onSaved,
              )
            }
          >
            <For each={LANGUAGES}>
              {(language) => <option value={language.id}>{language.label}</option>}
            </For>
          </select>
        </Show>
      </SettingRow>
    </div>
  )
}

export function AccountSection(props: { onClose: () => void }) {
  const app = useApp()
  const [name, setName] = createSignal(app.user()?.name ?? "")

  async function saveName() {
    const value = name().trim()
    if (!value || value === app.user()?.name) return
    try {
      app.updateUser(await api.updateProfile({ name: value }))
      showToast("Name saved")
    } catch (err) {
      toastError("Save name", err, { planned: true })
    }
  }

  return (
    <div class="settings-section">
      <SettingRow label="Full name">
        <input
          id="account-name"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
        />
      </SettingRow>
      <SettingRow label="Email">
        <span class="muted-text">{app.user()?.email}</span>
      </SettingRow>
      <SettingRow
        label="Plan"
        description={app.usage() ? `You are on ${app.usage()!.plan_name}.` : undefined}
      >
        <button
          type="button"
          class="secondary"
          onClick={() => {
            props.onClose()
            navigate({ name: "plans" })
          }}
        >
          Manage plan
        </button>
      </SettingRow>
      <SettingRow label="Log out of this device">
        <button type="button" class="secondary" onClick={app.signOut}>
          Log out
        </button>
      </SettingRow>
    </div>
  )
}

export function PrivacySection(props: PreferencesProps) {
  const app = useApp()
  return (
    <div class="settings-section">
      <SettingRow
        label="Incognito"
        description="New chats are not saved to your history. Lasts until you turn it off or reload."
      >
        <Toggle checked={app.incognito()} label="Incognito" onChange={app.setIncognito} />
      </SettingRow>
      <SettingRow
        label="Memory"
        description="Let Kothora remember useful details across chats. Manage them under Memory."
      >
        <Show
          when={!props.preferences.error}
          fallback={<span class="muted-text">Not available yet</span>}
        >
          <Toggle
            checked={props.preferences()?.memory_enabled ?? false}
            label="Memory"
            disabled={!props.preferences()}
            onChange={(on) =>
              savePreferences(props.preferences(), { memory_enabled: on }, props.onSaved)
            }
          />
        </Show>
      </SettingRow>
      <SettingRow
        label="Delete a chat"
        description="Open the chat's menu in the sidebar and choose Delete. It is removed from your history."
      >
        <span />
      </SettingRow>
    </div>
  )
}

export function BillingSection(props: { onClose: () => void }) {
  const app = useApp()
  const [payments] = safeResource(api.payments)
  return (
    <div class="settings-section">
      <SettingRow
        label={app.usage()?.plan_name ?? "Plan"}
        description={
          app.usage()?.period_ends_at
            ? `Paid until ${new Date(app.usage()!.period_ends_at!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Wallet payments do not renew on their own.`
            : "Free plan."
        }
      >
        <button
          type="button"
          class="primary"
          onClick={() => {
            props.onClose()
            navigate({ name: "plans" })
          }}
        >
          View all plans
        </button>
      </SettingRow>
      <h3 class="settings-subtitle">Payments</h3>
      <Show
        when={!payments.error}
        fallback={<LoadError error={payments.error} feature="Payment history" />}
      >
        <For each={payments()} fallback={<p class="muted-text">No payments yet.</p>}>
          {(payment) => (
            <div class="setting-row compact">
              <div class="setting-text">
                <h4>
                  {payment.plan_id.replace("_", " ")} · {payment.cycle}
                </h4>
                <p>
                  {new Date(payment.created_at).toLocaleDateString("en-GB")} ·{" "}
                  {payment.gateway_card_type ?? "SSLCommerz"}
                </p>
              </div>
              <div class="setting-control">
                <span class="numeric">{formatBdt(payment.amount_bdt)}</span>
                <span class={`badge ${payment.status === "paid" ? "current" : ""}`}>
                  {payment.status}
                </span>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}

function dateText(date: Date, withTime: boolean): string {
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  })
}

export function UsageSection() {
  const app = useApp()
  const now = new Date()
  const forecast = () => {
    const usage = app.usage()
    return usage ? forecastMonth(usage.used_this_month, usage.monthly_limit, now) : null
  }
  const headline = () => {
    const result = forecast()
    if (!result) return ""
    switch (result.kind) {
      case "on-track":
        return `On track. At this pace you will use about ${result.projected} of ${result.limit} queries this month.`
      case "will-run-out":
        return `At this pace you will run out around ${dateText(new Date(now.getFullYear(), now.getMonth(), result.runOutDay), false)}.`
      case "used-up":
        return "You have used this month's queries. Upgrade or wait for the reset."
    }
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  return (
    <div class="settings-section">
      <Show when={app.usage()}>
        {(usage) => (
          <>
            <p class="usage-headline">
              {headline()} <span class="badge current">{usage().plan_name}</span>
            </p>
            <Show when={usage().daily_limit !== null}>
              <UsageBar
                label="Today"
                resets={`Resets ${dateText(tomorrow, true)}`}
                used={usage().used_today}
                limit={usage().daily_limit!}
              />
            </Show>
            <UsageBar
              label="This month"
              resets={`Resets ${dateText(nextMonthStart(now), true)}`}
              used={usage().used_this_month}
              limit={usage().monthly_limit}
            />
            <p class="muted-text small">
              Daily limits reset at midnight Bangladesh time. A query counts when an answer starts;
              an answer that fails is not counted.
            </p>
          </>
        )}
      </Show>
    </div>
  )
}

function UsageBar(props: { label: string; resets: string; used: number; limit: number }) {
  const percent = () => Math.min(100, Math.round((props.used / props.limit) * 100))
  return (
    <div class="usage-bar">
      <div class="setting-text">
        <h4>{props.label}</h4>
        <p>{props.resets}</p>
      </div>
      <div
        class="meter wide"
        classList={{ high: percent() >= 80 }}
        role="meter"
        aria-label={`${props.label} used`}
        aria-valuenow={percent()}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${percent()}%` }} />
      </div>
      <span class="usage-figure numeric">
        {props.used} / {props.limit}
      </span>
    </div>
  )
}

export function CapabilitiesSection() {
  const app = useApp()
  const features = () => {
    const usage = app.usage()
    if (!usage) return []
    return [
      { label: "Web search with citations", on: true },
      { label: "Academic search (published papers)", on: usage.scholarly_search },
      { label: "Bibliography export (BibTeX)", on: usage.bibliography_export },
      { label: "Kothora Code, the coding assistant", on: usage.kothora_code },
      {
        label: usage.allowed_models.length
          ? `Choose models: ${usage.allowed_models.map(modelLabel).join(", ")}`
          : "Choose models (Pro and above)",
        on: usage.allowed_models.length > 0,
      },
    ]
  }
  return (
    <div class="settings-section">
      <p class="muted-text">What your {app.usage()?.plan_name ?? ""} plan includes.</p>
      <ul class="capability-list">
        <For each={features()}>
          {(feature) => (
            <li classList={{ off: !feature.on }}>
              <Icon name={feature.on ? "check" : "lock"} size={16} />
              {feature.label}
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}

export function MemorySection(props: PreferencesProps) {
  const [memories, { mutate }] = safeResource(api.memories)
  async function forget(id: string) {
    try {
      await api.deleteMemory(id)
      mutate((all) => all?.filter((memory) => memory.id !== id))
      showToast("Forgotten")
    } catch (err) {
      toastError("Forget", err, { planned: true })
    }
  }
  return (
    <div class="settings-section">
      <Show
        when={!props.preferences.error}
        fallback={<LoadError error={props.preferences.error} feature="Memory" />}
      >
        <SettingRow
          label="Use memory"
          description="Kothora saves useful details from your chats and uses them in later answers."
        >
          <Toggle
            checked={props.preferences()?.memory_enabled ?? false}
            label="Use memory"
            disabled={!props.preferences()}
            onChange={(on) =>
              savePreferences(props.preferences(), { memory_enabled: on }, props.onSaved)
            }
          />
        </SettingRow>
        <h3 class="settings-subtitle">What Kothora remembers</h3>
        <Show
          when={!memories.error}
          fallback={<LoadError error={memories.error} feature="Memory" />}
        >
          <ul class="memory-list">
            <For each={memories()} fallback={<li class="muted-text">Nothing yet.</li>}>
              {(memory) => (
                <li>
                  <span>{memory.text}</span>
                  <button type="button" class="ghost small" onClick={() => forget(memory.id)}>
                    Forget
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </div>
  )
}

export function PersonalizationSection(props: PreferencesProps) {
  const [aboutMe, setAboutMe] = createSignal<string | null>(null)
  const [instructions, setInstructions] = createSignal<string | null>(null)
  return (
    <Show
      when={!props.preferences.error}
      fallback={<LoadError error={props.preferences.error} feature="Personalization" />}
    >
      <form
        class="settings-section"
        onSubmit={(event) => {
          event.preventDefault()
          savePreferences(
            props.preferences(),
            {
              about_me: aboutMe() ?? props.preferences()?.about_me ?? "",
              instructions: instructions() ?? props.preferences()?.instructions ?? "",
            },
            props.onSaved,
          )
        }}
      >
        <label class="field" for="about-me">
          <span>What should Kothora know about you?</span>
          <textarea
            id="about-me"
            rows={3}
            placeholder="For example: I am a university student in Sylhet studying economics."
            value={aboutMe() ?? props.preferences()?.about_me ?? ""}
            onInput={(e) => setAboutMe(e.currentTarget.value)}
          />
        </label>
        <label class="field" for="instructions">
          <span>How should Kothora answer?</span>
          <textarea
            id="instructions"
            rows={4}
            placeholder="For example: keep answers short and use taka for prices."
            value={instructions() ?? props.preferences()?.instructions ?? ""}
            onInput={(e) => setInstructions(e.currentTarget.value)}
          />
        </label>
        <div>
          <button type="submit" class="primary" disabled={!props.preferences()}>
            Save
          </button>
        </div>
      </form>
    </Show>
  )
}

export function ApiKeysSection() {
  return (
    <div class="settings-section">
      <p>
        The Kothora API lets your own tools ask Kothora questions and get cited answers. It is part
        of the Business Premium plan.
      </p>
      <p class="muted-text">
        API keys are not issued yet. When they are, you will create and revoke them here.
      </p>
    </div>
  )
}
