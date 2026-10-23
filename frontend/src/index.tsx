import { render } from "solid-js/web"
import { App } from "./App"
import { installDemoBackend } from "./demo/backend"
import { IS_DEMO } from "./env"
import { setToken } from "./lib/api"
import { applyTheme, theme } from "./lib/theme"
import "./styles/index.css"

// "System" leaves the page alone, so a theme set by whatever hosts the app still applies.
if (theme() !== "system") applyTheme(theme())

// Compiled out of production builds: IS_DEMO is a build-time constant.
if (IS_DEMO) {
  installDemoBackend()
  setToken("demo-token")
}

const root = document.getElementById("root")
if (!root) throw new Error("index.html is missing #root")
render(() => <App />, root)
