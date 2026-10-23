import { createSignal, For, Show } from "solid-js"
import { safeResource } from "../../lib/resource"
import { api } from "../../lib/api"
import { showToast, toastError } from "../../lib/toast"
import type { Automation, Frequency } from "../../lib/types"
import { Icon } from "../ui/Icon"
import { Toggle } from "../settings/Sections"
import { EmptyState, LoadError, PageHeader } from "../ui/States"

const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: "daily", label: "Every day" },
  { id: "weekdays", label: "Weekdays (Sun–Thu)" },
  { id: "weekly", label: "Every week" },
]

const frequencyLabel = (id: Frequency) => FREQUENCIES.find((f) => f.id === id)?.label ?? id

/** Prompts Kothora runs on a schedule, with the answer waiting in a new chat. */
export function AutomationsPage() {
  const [automations, { mutate, refetch }] = safeResource(api.automations)
  const [creating, setCreating] = createSignal(false)

  async function setEnabled(automation: Automation, enabled: boolean) {
    try {
      const updated = await api.updateAutomation(automation.id, { enabled })
      mutate((all) => all?.map((a) => (a.id === updated.id ? updated : a)))
    } catch (err) {
      toastError("Update automation", err, { planned: true })
    }
  }

  async function remove(automation: Automation) {
    try {
      await api.deleteAutomation(automation.id)
      mutate((all) => all?.filter((a) => a.id !== automation.id))
      showToast("Automation deleted")
    } catch (err) {
      toastError("Delete automation", err, { planned: true })
    }
  }

  return (
    <div class="page narrow">
      <PageHeader
        title="Automations"
        subtitle="Kothora runs these prompts on a schedule. Each run's answer arrives as a new chat."
        actions={
          <button
            type="button"
            class="primary"
            onClick={() => setCreating(true)}
            disabled={Boolean(automations.error)}
          >
            <Icon name="plus" size={16} /> New automation
          </button>
        }
      />
      <Show when={creating()}>
        <AutomationForm
          onDone={(created) => {
            setCreating(false)
            if (created) refetch()
          }}
        />
      </Show>
      <Show
        when={!automations.error}
        fallback={<LoadError error={automations.error} feature="Automations" />}
      >
        <ul class="row-list">
          <For
            each={automations()}
            fallback={
              <Show when={automations()}>
                <EmptyState icon="clock" title="No automations yet">
                  For example: a morning summary of the news, or this week's exchange rates.
                </EmptyState>
              </Show>
            }
          >
            {(automation) => (
              <li class="automation-row" classList={{ paused: !automation.enabled }}>
                <div class="automation-text">
                  <h3>{automation.title}</h3>
                  <p>{automation.prompt}</p>
                  <span class="list-meta">
                    <Icon name="clock" size={13} /> {frequencyLabel(automation.frequency)} at{" "}
                    {automation.time}
                    {automation.enabled && automation.next_run_at
                      ? ` · next ${new Date(automation.next_run_at).toLocaleString("en-GB", { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                      : " · paused"}
                  </span>
                </div>
                <Toggle
                  checked={automation.enabled}
                  label={`Run ${automation.title}`}
                  onChange={(on) => setEnabled(automation, on)}
                />
                <button
                  type="button"
                  class="icon-button"
                  aria-label={`Delete ${automation.title}`}
                  onClick={() => remove(automation)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}

function AutomationForm(props: { onDone: (created: boolean) => void }) {
  const [busy, setBusy] = createSignal(false)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const form = new FormData(event.currentTarget as HTMLFormElement)
    setBusy(true)
    try {
      await api.createAutomation({
        title: String(form.get("title")).trim(),
        prompt: String(form.get("prompt")).trim(),
        frequency: form.get("frequency") as Frequency,
        time: String(form.get("time")),
      })
      showToast("Automation created")
      props.onDone(true)
    } catch (err) {
      toastError("Create automation", err, { planned: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form class="inline-form" onSubmit={submit}>
      <label class="field" for="automation-title">
        <span>Name</span>
        <input
          id="automation-title"
          name="title"
          required
          maxLength={80}
          placeholder="Morning news"
        />
      </label>
      <label class="field" for="automation-prompt">
        <span>What should Kothora do?</span>
        <textarea
          id="automation-prompt"
          name="prompt"
          required
          rows={3}
          placeholder="Summarise the top five business stories in Bangladesh today, with sources."
        />
      </label>
      <div class="field-row">
        <label class="field" for="automation-frequency">
          <span>How often</span>
          <select id="automation-frequency" name="frequency">
            <For each={FREQUENCIES}>{(f) => <option value={f.id}>{f.label}</option>}</For>
          </select>
        </label>
        <label class="field" for="automation-time">
          <span>Time (Dhaka)</span>
          <input id="automation-time" name="time" type="time" required value="08:00" />
        </label>
      </div>
      <div class="form-actions">
        <button type="submit" class="primary" disabled={busy()}>
          Create automation
        </button>
        <button type="button" class="secondary" onClick={() => props.onDone(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}
