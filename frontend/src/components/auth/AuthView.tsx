import { createSignal, Show } from "solid-js"
import { api, setToken } from "../../lib/api"
import { KothoraMark } from "../ui/Icon"

export function AuthView(props: { onSignedIn: () => void }) {
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
      <div class="auth-panel">
        <KothoraMark size={48} />
        <h1>{mode() === "login" ? "Welcome back" : "Create your account"}</h1>
        <p class="auth-sub">Answers you can check, in Bangla or English. Priced in taka.</p>
        <form class="auth-form" onSubmit={submit}>
          <Show when={mode() === "register"}>
            <label for="auth-name">
              Name
              <input
                id="auth-name"
                required
                autocomplete="name"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
              />
            </label>
          </Show>
          <label for="auth-email">
            Email
            <input
              id="auth-email"
              type="email"
              required
              autocomplete="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </label>
          <label for="auth-password">
            Password
            <input
              id="auth-password"
              type="password"
              required
              minLength={mode() === "register" ? 8 : undefined}
              autocomplete={mode() === "login" ? "current-password" : "new-password"}
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </label>
          <Show when={error()}>
            <p class="error-text" role="alert">
              {error()}
            </p>
          </Show>
          <button class="primary block" type="submit" disabled={busy()}>
            {busy() ? "Please wait…" : mode() === "login" ? "Continue" : "Create account"}
          </button>
        </form>
        <p class="auth-switch">
          {mode() === "login" ? "New to Kothora?" : "Already have an account?"}{" "}
          <button
            type="button"
            class="link"
            onClick={() => setMode(mode() === "login" ? "register" : "login")}
          >
            {mode() === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  )
}
