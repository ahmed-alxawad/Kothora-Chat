import { createMemo, createSignal, For, Show } from "solid-js"
import { useApp } from "../../app-context"
import { api } from "../../lib/api"
import { navigate } from "../../lib/router"
import { relativeTime } from "../../lib/time"
import { showToast, toastError } from "../../lib/toast"
import type { Project } from "../../lib/types"
import { Icon } from "../ui/Icon"
import { EmptyState, LoadError, PageHeader } from "../ui/States"

/** All projects, pinned first, like Perplexity's Projects list. */
export function ProjectsPage() {
  const app = useApp()
  const [query, setQuery] = createSignal("")
  const [naming, setNaming] = createSignal(false)

  const matching = createMemo(() => {
    const needle = query().trim().toLowerCase()
    return [...(app.projects() ?? [])]
      .filter((project) => project.name.toLowerCase().includes(needle))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  })
  const chatCount = (projectId: string) =>
    (app.conversations() ?? []).filter((c) => c.project_id === projectId).length

  async function create(name: string) {
    setNaming(false)
    if (!name.trim()) return
    try {
      const project = await api.createProject(name.trim())
      app.refetchProjects()
      navigate({ name: "project", projectId: project.id })
    } catch (err) {
      toastError("Create project", err, { planned: true })
    }
  }

  async function togglePin(project: Project) {
    try {
      await api.updateProject(project.id, { pinned: !project.pinned })
      app.refetchProjects()
      showToast(project.pinned ? "Unpinned" : "Pinned")
    } catch (err) {
      toastError("Pin project", err, { planned: true })
    }
  }

  return (
    <div class="page">
      <PageHeader
        title="Projects"
        subtitle="Group chats with shared instructions, such as a thesis or a business."
        actions={
          <>
            <label class="search-field small">
              <Icon name="search" size={16} />
              <span class="visually-hidden">Search projects</span>
              <input
                id="search-projects"
                placeholder="Search projects"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
            </label>
            <button type="button" class="primary" onClick={() => setNaming(true)}>
              <Icon name="plus" size={16} /> New project
            </button>
          </>
        }
      />
      <Show when={naming()}>
        <form
          class="inline-form row"
          onSubmit={(event) => {
            event.preventDefault()
            create(new FormData(event.currentTarget).get("name") as string)
          }}
        >
          <input
            id="new-project-name"
            name="name"
            required
            maxLength={80}
            placeholder="Project name, for example: Thesis"
            autofocus
          />
          <button type="submit" class="primary">
            Create
          </button>
          <button type="button" class="secondary" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </form>
      </Show>

      <Show
        when={!app.projects.error}
        fallback={<LoadError error={app.projects.error} feature="Projects" />}
      >
        <Show
          when={(app.projects() ?? []).length > 0}
          fallback={
            <EmptyState icon="folder" title="No projects yet">
              Create one to keep related chats together with their own instructions.
            </EmptyState>
          }
        >
          <For each={[true, false]}>
            {(pinned) => {
              const items = () => matching().filter((project) => project.pinned === pinned)
              return (
                <Show when={items().length > 0}>
                  <section class="list-group">
                    <h2 class="list-heading">{pinned ? "Pinned" : "Your projects"}</h2>
                    <ul class="row-list">
                      <For each={items()}>
                        {(project) => (
                          <li class="list-row">
                            <a
                              class="list-main"
                              href={`/p/${project.id}`}
                              onClick={(event) => {
                                event.preventDefault()
                                navigate({ name: "project", projectId: project.id })
                              }}
                            >
                              <Icon name="folder" size={18} />
                              <span class="list-title">{project.name}</span>
                            </a>
                            <span class="list-meta">
                              {chatCount(project.id)}{" "}
                              {chatCount(project.id) === 1 ? "chat" : "chats"}
                            </span>
                            <span class="list-meta">
                              <Icon name="lock" size={13} /> Private
                            </span>
                            <span class="list-meta numeric">
                              {relativeTime(project.updated_at, new Date())}
                            </span>
                            <button
                              type="button"
                              class="icon-button"
                              classList={{ pinned: project.pinned }}
                              aria-label={
                                project.pinned ? `Unpin ${project.name}` : `Pin ${project.name}`
                              }
                              onClick={() => togglePin(project)}
                            >
                              <Icon name="pin" size={16} />
                            </button>
                          </li>
                        )}
                      </For>
                    </ul>
                  </section>
                </Show>
              )
            }}
          </For>
        </Show>
      </Show>
    </div>
  )
}
