/**
 * Builds the demo: the real app with its in-browser sample backend (src/demo), packed
 * into one self-contained HTML fragment for hosts that accept a single page, such as a
 * claude.ai Artifact. Output: dist-demo/kothora-demo.html
 *
 *   npm run build:demo
 */
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { build } from "vite"

const OUT_DIR = "dist-demo"
const FONTS =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Hind+Siliguri:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"

await build({
  mode: "demo",
  base: "./",
  logLevel: "warn",
  build: { outDir: OUT_DIR, emptyOutDir: true },
})

const assets = join(OUT_DIR, "assets")
const files = await readdir(assets)
const read = (suffix) => {
  const name = files.find((file) => file.endsWith(suffix))
  if (!name) throw new Error(`Build produced no ${suffix} file in ${assets}`)
  return readFile(join(assets, name), "utf8")
}
if (files.filter((file) => file.endsWith(".js")).length !== 1) {
  throw new Error("Expected exactly one JS chunk; inline any dynamic imports first")
}

const css = await read(".css")
// "</script" inside the bundle would end the inline script early.
const js = (await read(".js")).replaceAll("</script", "<\\/script")

const page = `<title>Kothora Chat</title>
<meta name="description" content="Kothora demo: cited AI answers for Bangladesh, priced in BDT." />
<link rel="stylesheet" href="${FONTS}" />
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`
const output = join(OUT_DIR, "kothora-demo.html")
await writeFile(output, page)
console.log(`Wrote ${output} (${(page.length / 1024).toFixed(1)} KB)`)
