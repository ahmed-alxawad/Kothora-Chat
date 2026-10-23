/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

export default defineConfig({
  plugins: [solid()],
  server: {
    port: 5173,
    // In development the API runs separately on :8000; Nginx does this in production.
    proxy: { "/api": "http://localhost:8000" },
  },
  // The tested modules are DOM-free, so no browser emulation is needed.
  test: { environment: "node" },
})
