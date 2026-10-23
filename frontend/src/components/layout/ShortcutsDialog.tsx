import { For } from "solid-js"
import { Dialog } from "../ui/Dialog"

const SHORTCUTS: [keys: string, action: string][] = [
  ["Ctrl / ⌘ + Shift + O", "New chat"],
  ["Ctrl / ⌘ + K", "Search chats"],
  ["Ctrl / ⌘ + Shift + S", "Show or hide the sidebar"],
  ["Ctrl / ⌘ + Shift + ,", "Settings"],
  ["Enter", "Send"],
  ["Shift + Enter", "New line"],
  ["Esc", "Stop the answer, or close a window"],
]

/** Help: keyboard shortcuts and where to get support. */
export function ShortcutsDialog(props: { onClose: () => void }) {
  return (
    <Dialog label="Help" onClose={props.onClose}>
      <div class="dialog-body">
        <h2>Keyboard shortcuts</h2>
        <dl class="shortcuts">
          <For each={SHORTCUTS}>
            {([keys, action]) => (
              <>
                <dt>{action}</dt>
                <dd>
                  <kbd>{keys}</kbd>
                </dd>
              </>
            )}
          </For>
        </dl>
        <h2>Support</h2>
        <p class="muted-text">
          Email support@kothora.ai. Pro and Premium plans get priority replies, usually within one
          working day.
        </p>
      </div>
    </Dialog>
  )
}
