import { For, Show } from "solid-js"
import { AUTO_MODEL_LABEL, modelLabel } from "../../lib/format"
import type { Usage } from "../../lib/types"
import { Icon } from "../ui/Icon"
import { Menu } from "../ui/Menu"

export function TopBar(props: {
  sidebarOpen: boolean
  usage: Usage | undefined
  model: string
  onModelChange: (model: string) => void
  onOpenSidebar: () => void
  onNewChat: () => void
  onShowPlans: () => void
}) {
  const models = () => props.usage?.allowed_models ?? []

  return (
    <header class="topbar">
      <Show when={!props.sidebarOpen}>
        <button
          type="button"
          class="icon-button"
          onClick={props.onOpenSidebar}
          aria-label="Open sidebar"
        >
          <Icon name="sidebar" />
        </button>
        <button type="button" class="icon-button" onClick={props.onNewChat} aria-label="New chat">
          <Icon name="plus" />
        </button>
      </Show>

      <Menu
        label="Choose a model"
        triggerClass="model-button"
        trigger={
          <>
            <span>{modelLabel(props.model)}</span>
            <Icon name="chevronDown" size={15} />
          </>
        }
      >
        {(close) => (
          <>
            <ModelOption
              label={AUTO_MODEL_LABEL}
              hint="Picks the cheapest model that can answer well"
              selected={props.model === ""}
              onSelect={() => {
                props.onModelChange("")
                close()
              }}
            />
            <For each={models()}>
              {(id) => (
                <ModelOption
                  label={modelLabel(id)}
                  hint={id}
                  selected={props.model === id}
                  onSelect={() => {
                    props.onModelChange(id)
                    close()
                  }}
                />
              )}
            </For>
            <Show when={models().length === 0}>
              <button
                type="button"
                role="menuitem"
                class="menu-item"
                onClick={() => {
                  close()
                  props.onShowPlans()
                }}
              >
                <Icon name="lock" size={16} />
                <span class="menu-item-text">
                  <span>More models</span>
                  <span class="menu-item-hint">Claude, GPT and Gemini come with Pro</span>
                </span>
              </button>
            </Show>
          </>
        )}
      </Menu>

      <div class="topbar-end">
        <Show when={props.usage?.plan_id === "free"}>
          <button type="button" class="upgrade-button" onClick={props.onShowPlans}>
            <Icon name="sparkle" size={15} /> Upgrade
          </button>
        </Show>
      </div>
    </header>
  )
}

function ModelOption(props: {
  label: string
  hint: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={props.selected}
      class="menu-item"
      onClick={props.onSelect}
    >
      <span class="menu-item-text">
        <span>{props.label}</span>
        <span class="menu-item-hint">{props.hint}</span>
      </span>
      <Show when={props.selected}>
        <Icon name="check" size={16} class="menu-check" />
      </Show>
    </button>
  )
}
