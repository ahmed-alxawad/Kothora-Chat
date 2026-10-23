/**
 * True in the demo build (`npm run build:demo`), which swaps the network for an
 * in-browser sample backend. Vite replaces this at build time, so production builds
 * drop the demo code entirely.
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === "1"
