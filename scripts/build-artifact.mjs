/**
 * Bundles the built site into one self-contained HTML fragment.
 *
 * Claude Artifacts serve a page from its own origin under a strict CSP: no
 * external scripts, styles or media, and no <html>/<head>/<body> of your own —
 * the host supplies those. So everything is inlined, the body-level styling
 * that normally rides on the <body> class moves into CSS, and the remote media
 * candidates simply fail (as designed) and hand over to the procedural
 * stand-in.
 *
 *   npm run build && node scripts/build-artifact.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist/assets'
const OUT = 'dist/eroticad-artifact.html'

const files = readdirSync(DIST)
const js = files.find((f) => f.endsWith('.js'))
const css = files.find((f) => f.endsWith('.css'))
if (!js || !css) throw new Error('Run `npm run build` first.')

const script = readFileSync(join(DIST, js), 'utf8')
const styles = readFileSync(join(DIST, css), 'utf8')

// A literal </script> anywhere in the bundle would close the tag early.
const safeScript = script.replace(/<\/script/gi, '<\\/script')

const html = `<title>Frame by Hand</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap"
  rel="stylesheet"
/>
<style>
${styles}

/* The host owns <body>, so the classes index.html normally puts there live
   here instead. The page commits to one dark world on purpose — it is a
   lightless room with a lit screen in it — so it paints its own ground rather
   than inheriting the viewer's theme. */
html,
body {
  min-height: 100%;
  margin: 0;
  /* Vertical scroll is the transport here — the app toggles it on the root
     itself once the gate is answered. Only the horizontal axis is clamped. */
  overflow-x: hidden;
  background: #040203;
  color: #e8c4bd;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
#root {
  min-height: 100%;
  width: 100%;
}
</style>

<div id="root"></div>

<script type="module">
${safeScript}
</script>
`

writeFileSync(OUT, html)
const kb = (html.length / 1024).toFixed(0)
console.log(`${OUT} — ${kb} KB`)
