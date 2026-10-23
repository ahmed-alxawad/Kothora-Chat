import { createSignal } from "solid-js"

export type ThemePreference = "system" | "light" | "dark"

const STORAGE_KEY = "kothora.theme"

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" ? stored : "system"
  } catch {
    return "system"
  }
}

const [theme, setThemeSignal] = createSignal<ThemePreference>(readPreference())
export { theme }

/** "system" removes the attribute so the stylesheet follows prefers-color-scheme. */
export function applyTheme(preference: ThemePreference): void {
  if (preference === "system") document.documentElement.removeAttribute("data-theme")
  else document.documentElement.setAttribute("data-theme", preference)
}

export function setTheme(preference: ThemePreference): void {
  setThemeSignal(preference)
  applyTheme(preference)
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}
