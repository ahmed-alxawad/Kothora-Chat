import { afterEach, describe, expect, it, vi } from "vitest"
import { getToken, setToken } from "./api"

describe("session token", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setToken(null)
  })

  it("survives when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError")
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError")
      },
      removeItem: () => {
        throw new DOMException("blocked", "SecurityError")
      },
    })
    setToken("abc")
    expect(getToken()).toBe("abc")
    setToken(null)
    expect(getToken()).toBeNull()
  })

  it("persists to storage when it is available", () => {
    const store = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
    setToken("xyz")
    expect(store.get("kothora.token")).toBe("xyz")
  })
})
