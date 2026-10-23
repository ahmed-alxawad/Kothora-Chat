import { createSignal, Show } from "solid-js"
import { api, setToken } from "../lib/api"

export function AuthForm(props: { onSignedIn: () => void }) {
  const [mode, setMode] = createSignal<"login" | "register">("login")
  const [email, setEmail] = createSignal("")
  const [name, setName] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [error, setError] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setError("")
    setBusy(true)
    try {
      const { access_token } =
        mode() === "login"
          ? await api.login(email(), password())
          : await api.register(email(), name(), password())
      setToken(access_token)
      props.onSignedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="auth">
      <form class="auth-card" onSubmit={submit}>
        <h1 class="brand">Kothora</h1>
        <p class="muted">Cited AI answers for Bangladesh, priced in BDT.</p>
        <Show when={mode() === "register"}>
          <label>
            Name
            <input required value={name()} onInput={(e) => setName(e.currentTarget.value)} />
          </label>
        </Show>
        <label>
          Email
          <input
            type="email"
            required
            autocomplete="email"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={mode() === "register" ? 8 : undefined}
            autocomplete={mode() === "login" ? "current-password" : "new-password"}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>
        <Show when={error()}>
          <p class="error" role="alert">
            {error()}
          </p>
        </Show>
        <button class="primary" type="submit" disabled={busy()}>
          {mode() === "login" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          class="link"
          onClick={() => setMode(mode() === "login" ? "register" : "login")}
        >
          {mode() === "login" ? "New to Kothora? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </main>
  )
}
