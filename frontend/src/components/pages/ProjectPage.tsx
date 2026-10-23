import { createMemo, createSignal, For, Show } from "solid-js"
import { useApp } from "../../app-context"
import { api } from "../../lib/api"
import { navigate } from "../../lib/router"
import { relativeTime } from "../../lib/time"
import { showToast, toastError } from "../../lib/toast"
import { Icon } from "../ui/Icon"
import { EmptyState, LoadError } from "../ui/States"

/** One project: its instructions, its chats, and a button to start a chat inside it. */
export function ProjectPage(props: { projectId: string }) {
  const app = useApp()
  const project = createMemo(() => app.projects()?.find((p) => p.id === props.projectId))
  const chats = createMemo(() =>
    (app.conversations() ?? [])
      .filter((c) => c.project_id === props.projectId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  )
  const [instructions, setInstructions] = createSignal<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = createSignal(false)

  async function save(changes: { name?: string; instructions?: string }, done: string) {
    try {
      await api.updateProject(props.projectId, changes)
      app.refetchProjects()
      showToast(done)
    } catch (err) {
      toastError("Save project", err, { planned: true })
    }
  }

  async function remove() {
    try {
      await api.deleteProject(props.projectId)
      app.refetchProjects()
      app.refetchConversations()
      showToast("Project deleted. Its chats are kept in Recents.")
      navigate({ name: "projects" })
    } catch (err) {
      toastError("Delete project", err, { planned: true })
    }
  }

  return (
    <div class="page narrow">
      <Show
        when={!app.projects.error}
        fallback={<LoadError error={app.projects.error} feature="Projects" />}
      >
        <Show
          when={project()}
          fallback={
            <Show when={app.projects()}>
              <EmptyState icon="folder" title="Project not found" />
            </Show>
          }
        >
          {(current) => (
            <>
              <button
                type="button"
                class="ghost back-link"
                onClick={() => navigate({ name: "projects" })}
              >
                ← All projects
              </button>
              <header class="project-head">
                <span class="project-icon">
                  <Icon name="folder" size={22} />
                </span>
                <input
                  class="project-name"
                  aria-label="Project name"
                  value={current().name}
                  onBlur={(e) => {
                    const name = e.currentTarget.value.trim()
                    if (name && name !== current().name) save({ name }, "Project renamed")
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              </header>
              <button
                type="button"
                class="primary new-in-project"
                onClick={() => app.newChat({ projectId: current().id })}
              >
                <Icon name="edit" size={16} /> New chat in this project
              </button>

              <section class="project-section">
                <h2 class="list-heading">Instructions</h2>
                <p class="muted-text small">Every chat in this project follows these.</p>
                <textarea
                  id="project-instructions"
                  rows={4}
                  value={instructions() ?? current().instructions}
                  onInput={(e) => setInstructions(e.currentTarget.value)}
                  placeholder="For example: I am writing a thesis on mobile money. Prefer peer-reviewed sources."
                />
                <Show when={instructions() !== null && instructions() !== current().instructions}>
                  <div class="form-actions">
                    <button
                      type="button"
                      class="primary"
                      onClick={() => save({ instructions: instructions()! }, "Instructions saved")}
                    >
                      Save instructions
                    </button>
                  </div>
                </Show>
              </section>

              <section class="project-section">
                <h2 class="list-heading">Chats</h2>
                <ul class="row-list">
                  <For
                    each={chats()}
                    fallback={<li class="muted-text small">No chats in this project yet.</li>}
                  >
                    {(chat) => (
                      <li class="list-row">
                        <a
                          class="list-main"
                          href={`/c/${chat.id}`}
                          onClick={(event) => {
                            event.preventDefault()
                            navigate({ name: "chat", conversationId: chat.id })
                          }}
                        >
                          <Icon name="chat" size={17} />
                          <span class="list-title">{chat.title}</span>
                        </a>
                        <span class="list-meta numeric">
                          {relativeTime(chat.updated_at, new Date())}
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              </section>

              <section class="project-section danger-zone">
                <Show
                  when={confirmingDelete()}
                  fallback={
                    <button
                      type="button"
                      class="ghost danger-text"
                      onClick={() => setConfirmingDelete(true)}
                    >
                      <Icon name="trash" size={15} /> Delete project
                    </button>
                  }
                >
                  <p>Delete “{current().name}”? Its chats stay in Recents.</p>
                  <div class="form-actions">
                    <button type="button" class="danger-button" onClick={remove}>
                      Delete project
                    </button>
                    <button
                      type="button"
                      class="secondary"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </Show>
              </section>
            </>
          )}
        </Show>
      </Show>
    </div>
  )
}
