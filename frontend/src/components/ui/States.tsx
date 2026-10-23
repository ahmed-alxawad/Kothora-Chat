import { Show, type JSX } from "solid-js"
import { isNotSupported } from "../../lib/api"
import { Icon, type IconName } from "./Icon"

/** What a page shows when its data failed to load: "not built yet" is not an error. */
export function LoadError(props: { error: unknown; feature: string }) {
  return (
    <Show
      when={isNotSupported(props.error)}
      fallback={
        <EmptyState icon="alert" title={`Could not load ${props.feature}`}>
          {props.error instanceof Error ? props.error.message : String(props.error)}
        </EmptyState>
      }
    >
      <EmptyState icon="lock" title={`${props.feature} is not available on this server yet`}>
        The web app is ready for it; the backend endpoint is planned. See
        docs/frontend-api-contract.md in the repository.
      </EmptyState>
    </Show>
  )
}

export function EmptyState(props: {
  icon: IconName
  title: string
  children?: JSX.Element
  action?: JSX.Element
}) {
  return (
    <div class="empty-state">
      <span class="empty-icon">
        <Icon name={props.icon} size={22} />
      </span>
      <h2>{props.title}</h2>
      <Show when={props.children}>
        <p>{props.children}</p>
      </Show>
      {props.action}
    </div>
  )
}

/** Title row shared by the full-page screens (Library, Projects, Plugins…). */
export function PageHeader(props: { title: string; subtitle?: string; actions?: JSX.Element }) {
  return (
    <header class="page-header">
      <div>
        <h1>{props.title}</h1>
        <Show when={props.subtitle}>
          <p>{props.subtitle}</p>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="page-actions">{props.actions}</div>
      </Show>
    </header>
  )
}
