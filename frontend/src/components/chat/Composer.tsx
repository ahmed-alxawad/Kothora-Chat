import { createSignal, For, onCleanup, Show } from "solid-js"
import {
  AttachmentError,
  checkAttachable,
  withAttachments,
  type Attachment,
} from "../../lib/attachments"
import { dictationSupported, startDictation, type Dictation } from "../../lib/dictation"
import { AUTO_MODEL_LABEL, modelLabel } from "../../lib/format"
import { showToast } from "../../lib/toast"
import type { Focus, Reasoning, Skill } from "../../lib/types"
import { Icon, type IconName } from "../ui/Icon"
import { Menu } from "../ui/Menu"

const FOCUS_OPTIONS: { id: Focus; label: string; hint: string; icon: IconName }[] = [
  { id: "web", label: "Search", hint: "Search the web and cite sources", icon: "globe" },
  {
    id: "academic",
    label: "Academic",
    hint: "Search published papers (Education plan)",
    icon: "book",
  },
  { id: "writing", label: "Writing", hint: "No search: write, edit, translate", icon: "pen" },
]

const MAX_TEXTAREA_PX = 220

export type ComposerProps = {
  streaming: boolean
  focus: Focus
  academicAvailable: boolean
  onFocusChange: (focus: Focus) => void
  models: string[]
  model: string
  onModelChange: (model: string) => void
  reasoning: Reasoning
  onReasoningChange: (reasoning: Reasoning) => void
  skills: Skill[]
  skillId: string | null
  onSkillChange: (id: string | null) => void
  /** Context shown as chips above the text: the chat's project, incognito. */
  projectName?: string
  incognito?: boolean
  onSubmit: (message: string) => void
  onStop: () => void
  placeholder?: string
}

/**
 * The message box, laid out like ChatGPT's and Perplexity's: + menu (files, skills),
 * search mode, model, microphone and send.
 */
export function Composer(props: ComposerProps) {
  const [text, setText] = createSignal("")
  const [attachments, setAttachments] = createSignal<Attachment[]>([])
  const [listening, setListening] = createSignal(false)
  let textarea: HTMLTextAreaElement | undefined
  let fileInput: HTMLInputElement | undefined
  let dictation: Dictation | null = null
  onCleanup(() => dictation?.stop())

  const focusOption = () => FOCUS_OPTIONS.find((o) => o.id === props.focus) ?? FOCUS_OPTIONS[0]
  const skill = () => props.skills.find((s) => s.id === props.skillId)
  const canSend = () => Boolean(text().trim() || attachments().length)

  function resize() {
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_PX)}px`
  }

  function submit(event?: Event) {
    event?.preventDefault()
    if (!canSend() || props.streaming) return
    dictation?.stop()
    const question = text().trim() || "Please read the attached file."
    props.onSubmit(withAttachments(question, attachments()))
    setText("")
    setAttachments([])
    queueMicrotask(resize)
  }

  async function addFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      try {
        checkAttachable(file)
        const content = await file.text()
        setAttachments((all) => [...all, { name: file.name, text: content }])
      } catch (err) {
        showToast(
          err instanceof AttachmentError ? err.message : `Could not read ${file.name}`,
          "error",
        )
      }
    }
    if (fileInput) fileInput.value = ""
  }

  function toggleDictation(language: "bn-BD" | "en-US") {
    if (listening()) {
      dictation?.stop()
      return
    }
    dictation = startDictation({
      language,
      onText: (spoken) => {
        setText((current) => (current ? `${current.trimEnd()} ${spoken.trim()}` : spoken.trim()))
        queueMicrotask(resize)
      },
      onEnd: (error) => {
        setListening(false)
        dictation = null
        if (error) showToast(`Voice typing stopped: ${error}`, "error")
      },
    })
    setListening(Boolean(dictation))
  }

  return (
    <form
      class="composer"
      onSubmit={submit}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        addFiles(e.dataTransfer?.files ?? null)
      }}
    >
      <Show when={props.projectName || props.incognito || skill() || attachments().length}>
        <div class="composer-chips">
          <Show when={props.incognito}>
            <span class="chip incognito">
              <Icon name="ghost" size={14} /> Incognito: not saved
            </span>
          </Show>
          <Show when={props.projectName}>
            <span class="chip">
              <Icon name="folder" size={14} /> {props.projectName}
            </span>
          </Show>
          <Show when={skill()}>
            {(active) => (
              <span class="chip">
                <Icon name="pen" size={14} /> {active().name}
                <button
                  type="button"
                  aria-label={`Stop using ${active().name}`}
                  onClick={() => props.onSkillChange(null)}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            )}
          </Show>
          <For each={attachments()}>
            {(file, index) => (
              <span class="chip">
                <Icon name="paperclip" size={14} /> {file.name}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setAttachments((all) => all.filter((_, i) => i !== index()))}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>

      <label class="visually-hidden" for="composer-input">
        Message Kothora
      </label>
      <textarea
        id="composer-input"
        ref={textarea}
        rows={1}
        placeholder={listening() ? "Listening…" : (props.placeholder ?? "Ask anything…")}
        value={text()}
        onInput={(event) => {
          setText(event.currentTarget.value)
          resize()
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.isComposing) submit(event)
        }}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept="text/*,.md,.csv,.json,.py,.js,.ts,.tsx,.sql,.yaml,.yml"
        onChange={(e) => addFiles(e.currentTarget.files)}
      />

      <div class="composer-bar">
        <Menu
          label="Add files and more"
          triggerClass="icon-button bordered round"
          placement="above"
          trigger={<Icon name="plus" size={18} />}
        >
          {(close) => (
            <>
              <button
                type="button"
                role="menuitem"
                class="menu-item"
                onClick={() => {
                  close()
                  fileInput?.click()
                }}
              >
                <Icon name="paperclip" size={16} />
                <span class="menu-item-text">
                  <span>Add text files</span>
                  <span class="menu-item-hint">Notes, code, CSV · up to 100 KB each</span>
                </span>
              </button>
              <div class="menu-section">
                <span class="menu-caption">Use a skill</span>
              </div>
              <For
                each={props.skills}
                fallback={
                  <span class="menu-item-hint indent">
                    No skills installed. Add some under Plugins → Skills.
                  </span>
                }
              >
                {(option) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={props.skillId === option.id}
                    class="menu-item indent"
                    onClick={() => {
                      close()
                      props.onSkillChange(props.skillId === option.id ? null : option.id)
                    }}
                  >
                    <Icon name="pen" size={16} />
                    <span>{option.name}</span>
                    <Show when={props.skillId === option.id}>
                      <Icon name="check" size={16} class="menu-check" />
                    </Show>
                  </button>
                )}
              </For>
            </>
          )}
        </Menu>

        <Menu
          label={`Search mode: ${focusOption().label}`}
          triggerClass="pill-button"
          placement="above"
          trigger={
            <>
              <Icon name={focusOption().icon} size={16} />
              <span>{focusOption().label}</span>
              <Icon name="chevronDown" size={14} />
            </>
          }
        >
          {(close) => (
            <For each={FOCUS_OPTIONS}>
              {(option) => {
                const locked = () => option.id === "academic" && !props.academicAvailable
                return (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={props.focus === option.id}
                    class="menu-item"
                    disabled={locked()}
                    onClick={() => {
                      props.onFocusChange(option.id)
                      close()
                    }}
                  >
                    <Icon name={locked() ? "lock" : option.icon} size={16} />
                    <span class="menu-item-text">
                      <span>{option.label}</span>
                      <span class="menu-item-hint">{option.hint}</span>
                    </span>
                    <Show when={props.focus === option.id}>
                      <Icon name="check" size={16} class="menu-check" />
                    </Show>
                  </button>
                )
              }}
            </For>
          )}
        </Menu>

        <div class="composer-end">
          <Menu
            label="Model"
            triggerClass="model-pill"
            placement="above-end"
            trigger={
              <>
                <span>{modelLabel(props.model)}</span>
                <Show when={props.reasoning === "extended"}>
                  <span class="model-pill-extra">Thinking</span>
                </Show>
                <Icon name="chevronDown" size={14} />
              </>
            }
          >
            {(close) => (
              <>
                <ModelOption
                  label={AUTO_MODEL_LABEL}
                  hint="Picks the cheapest model that answers well"
                  selected={props.model === ""}
                  onSelect={() => {
                    props.onModelChange("")
                    close()
                  }}
                />
                <For each={props.models}>
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
                <Show when={props.models.length === 0}>
                  <span class="menu-item-hint indent">Claude, GPT and Gemini come with Pro.</span>
                </Show>
                <hr class="menu-rule" />
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={props.reasoning === "extended"}
                  class="menu-item"
                  onClick={() =>
                    props.onReasoningChange(
                      props.reasoning === "extended" ? "standard" : "extended",
                    )
                  }
                >
                  <Icon name="brain" size={16} />
                  <span class="menu-item-text">
                    <span>Think longer</span>
                    <span class="menu-item-hint">Slower, for harder questions</span>
                  </span>
                  <span
                    class="switch"
                    classList={{ on: props.reasoning === "extended" }}
                    aria-hidden="true"
                  />
                </button>
              </>
            )}
          </Menu>

          <Show when={dictationSupported()}>
            <Show
              when={listening()}
              fallback={
                <Menu
                  label="Voice typing"
                  triggerClass="icon-button"
                  placement="above-end"
                  trigger={<Icon name="mic" size={18} />}
                >
                  {(close) => (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        class="menu-item"
                        onClick={() => {
                          close()
                          toggleDictation("bn-BD")
                        }}
                      >
                        <Icon name="mic" size={16} /> Speak Bangla
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        class="menu-item"
                        onClick={() => {
                          close()
                          toggleDictation("en-US")
                        }}
                      >
                        <Icon name="mic" size={16} /> Speak English
                      </button>
                    </>
                  )}
                </Menu>
              }
            >
              <button
                type="button"
                class="icon-button listening"
                aria-label="Stop voice typing"
                onClick={() => dictation?.stop()}
              >
                <Icon name="mic" size={18} />
              </button>
            </Show>
          </Show>

          <Show
            when={props.streaming}
            fallback={
              <button
                type="submit"
                class="send-button"
                disabled={!canSend()}
                aria-label="Send message"
              >
                <Icon name="send" size={18} />
              </button>
            }
          >
            <button
              type="button"
              class="send-button stop"
              onClick={props.onStop}
              aria-label="Stop answering"
            >
              <Icon name="stop" size={14} />
            </button>
          </Show>
        </div>
      </div>
    </form>
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
