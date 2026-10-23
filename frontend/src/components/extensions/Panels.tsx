import { createMemo, createSignal, For, Show } from "solid-js"
import { safeResource } from "../../lib/resource"
import { useApp } from "../../app-context"
import { api } from "../../lib/api"
import { showToast, toastError } from "../../lib/toast"
import type { Connector, Skill } from "../../lib/types"
import { Icon } from "../ui/Icon"
import { LoadError } from "../ui/States"

/** A colored letter tile in place of third-party logos, which Kothora does not ship. */
function LetterTile(props: { name: string }) {
  const hue = () => [...props.name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360
  return (
    <span class="letter-tile" style={{ "--tile-hue": hue() }} aria-hidden="true">
      {props.name.charAt(0).toUpperCase()}
    </span>
  )
}

function SearchBox(props: {
  id: string
  placeholder: string
  value: string
  onInput: (value: string) => void
}) {
  return (
    <label class="search-field">
      <Icon name="search" size={17} />
      <span class="visually-hidden">{props.placeholder}</span>
      <input
        id={props.id}
        placeholder={props.placeholder}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </label>
  )
}

/** Connectors (plugins): outside services Kothora can read from, like ChatGPT's Plugins. */
export function ConnectorsPanel(props: { compact?: boolean }) {
  const [connectors, { mutate }] = safeResource(api.connectors)
  const [query, setQuery] = createSignal("")
  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase()
    return (connectors() ?? []).filter((c) =>
      `${c.name} ${c.description} ${c.category}`.toLowerCase().includes(needle),
    )
  })

  async function toggle(connector: Connector) {
    try {
      const updated = await api.setConnected(connector.id, !connector.connected)
      mutate((all) => all?.map((c) => (c.id === updated.id ? updated : c)))
      showToast(updated.connected ? `${updated.name} connected` : `${updated.name} disconnected`)
    } catch (err) {
      toastError(`Connect ${connector.name}`, err, { planned: true })
    }
  }

  return (
    <Show
      when={!connectors.error}
      fallback={<LoadError error={connectors.error} feature="Plugins" />}
    >
      <div class="panel" classList={{ compact: props.compact }}>
        <SearchBox
          id="search-plugins"
          placeholder="Search plugins"
          value={query()}
          onInput={setQuery}
        />
        <For each={[true, false]}>
          {(connected) => {
            const items = () => filtered().filter((c) => c.connected === connected)
            return (
              <Show when={items().length > 0}>
                <h3 class="panel-heading">{connected ? "Connected" : "Available"}</h3>
                <div class="tile-grid">
                  <For each={items()}>
                    {(connector) => (
                      <div class="tile">
                        <LetterTile name={connector.name} />
                        <div class="tile-text">
                          <h4>{connector.name}</h4>
                          <p>{connector.description}</p>
                        </div>
                        <button
                          type="button"
                          class={
                            connector.connected ? "secondary small-button" : "icon-button bordered"
                          }
                          aria-label={
                            connector.connected
                              ? `Disconnect ${connector.name}`
                              : `Connect ${connector.name}`
                          }
                          onClick={() => toggle(connector)}
                        >
                          {connector.connected ? "Disconnect" : <Icon name="plus" size={18} />}
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            )
          }}
        </For>
        <Show when={connectors() && filtered().length === 0}>
          <p class="muted-text">No plugins match “{query()}”.</p>
        </Show>
      </div>
    </Show>
  )
}

/** Skills: reusable instructions you can apply to a chat from the composer's + menu. */
export function SkillsPanel(props: { compact?: boolean }) {
  const app = useApp()
  const [query, setQuery] = createSignal("")
  const [creating, setCreating] = createSignal(false)
  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase()
    return (app.skills() ?? []).filter((s) =>
      `${s.name} ${s.description}`.toLowerCase().includes(needle),
    )
  })

  async function setInstalled(skill: Skill, installed: boolean) {
    try {
      await api.setSkillInstalled(skill.id, installed)
      app.refetchSkills()
      showToast(installed ? `${skill.name} added` : `${skill.name} removed`)
    } catch (err) {
      toastError(`Update ${skill.name}`, err, { planned: true })
    }
  }

  async function remove(skill: Skill) {
    try {
      await api.deleteSkill(skill.id)
      app.refetchSkills()
      showToast(`${skill.name} deleted`)
    } catch (err) {
      toastError(`Delete ${skill.name}`, err, { planned: true })
    }
  }

  const sections = () => [
    { title: "Installed", items: filtered().filter((s) => s.installed) },
    { title: "Created by me", items: filtered().filter((s) => s.author === "me") },
    {
      title: "From Kothora",
      items: filtered().filter((s) => s.author === "kothora" && !s.installed),
    },
  ]

  return (
    <Show
      when={!app.skills.error}
      fallback={<LoadError error={app.skills.error} feature="Skills" />}
    >
      <div class="panel" classList={{ compact: props.compact }}>
        <div class="panel-toolbar">
          <SearchBox
            id="search-skills"
            placeholder="Search skills"
            value={query()}
            onInput={setQuery}
          />
          <button type="button" class="primary" onClick={() => setCreating(!creating())}>
            <Icon name="plus" size={16} /> New skill
          </button>
        </div>
        <Show when={creating()}>
          <NewSkillForm
            onDone={() => {
              setCreating(false)
              app.refetchSkills()
            }}
          />
        </Show>
        <For each={sections()}>
          {(section) => (
            <Show when={section.items.length > 0}>
              <h3 class="panel-heading">{section.title}</h3>
              <div class="tile-grid">
                <For each={section.items}>
                  {(skill) => (
                    <div class="tile">
                      <LetterTile name={skill.name} />
                      <div class="tile-text">
                        <h4>{skill.name}</h4>
                        <p>{skill.description}</p>
                      </div>
                      <Show
                        when={skill.installed}
                        fallback={
                          <button
                            type="button"
                            class="icon-button bordered"
                            aria-label={`Add ${skill.name}`}
                            onClick={() => setInstalled(skill, true)}
                          >
                            <Icon name="plus" size={18} />
                          </button>
                        }
                      >
                        <SkillMenu
                          skill={skill}
                          onRemove={() => setInstalled(skill, false)}
                          onDelete={() => remove(skill)}
                        />
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          )}
        </For>
      </div>
    </Show>
  )
}

function SkillMenu(props: { skill: Skill; onRemove: () => void; onDelete: () => void }) {
  return (
    <div class="tile-actions">
      <button type="button" class="ghost small" onClick={props.onRemove}>
        Remove
      </button>
      <Show when={props.skill.author === "me"}>
        <button type="button" class="ghost small danger-text" onClick={props.onDelete}>
          Delete
        </button>
      </Show>
    </div>
  )
}

function NewSkillForm(props: { onDone: () => void }) {
  const [name, setName] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [instructions, setInstructions] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await api.createSkill({
        name: name().trim(),
        description: description().trim(),
        instructions: instructions().trim(),
      })
      showToast("Skill created")
      props.onDone()
    } catch (err) {
      toastError("Create skill", err, { planned: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form class="inline-form" onSubmit={submit}>
      <label class="field" for="skill-name">
        <span>Name</span>
        <input
          id="skill-name"
          required
          maxLength={60}
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="Cover letter writer"
        />
      </label>
      <label class="field" for="skill-description">
        <span>What it does</span>
        <input
          id="skill-description"
          maxLength={140}
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          placeholder="Writes cover letters for jobs in Bangladesh"
        />
      </label>
      <label class="field" for="skill-instructions">
        <span>Instructions for Kothora</span>
        <textarea
          id="skill-instructions"
          required
          rows={4}
          value={instructions()}
          onInput={(e) => setInstructions(e.currentTarget.value)}
          placeholder="Ask for the job advert first. Keep it under 250 words."
        />
      </label>
      <div class="form-actions">
        <button type="submit" class="primary" disabled={busy()}>
          Create skill
        </button>
        <button type="button" class="secondary" onClick={props.onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}
