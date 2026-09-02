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
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { SECTIONS } from '../src/lib/sections.js'

const DIST = 'dist/assets'
const OUT = 'dist/eroticad-artifact.html'

const files = readdirSync(DIST)
const js = files.find((f) => f.endsWith('.js'))
const css = files.find((f) => f.endsWith('.css'))
if (!js || !css) throw new Error('Run `npm run build` first.')

const script = readFileSync(join(DIST, js), 'utf8')
const styles = readFileSync(join(DIST, css), 'utf8')

/**
 * The page is served from its own origin with no `/media/` behind it, so any
 * real asset has to travel inside the file. Base64 costs a third in size,
 * which is the price of the thing being self-contained at all.
 */
/**
 * In priority order. Base64 costs a third on top, and the page has a hard
 * ceiling, so what does not fit is left out rather than silently overflowing —
 * and the build says which, instead of failing at publish time.
 *
 * Section clips come first: they are the film, and the film is the subject.
 */
// Below the hard 16 MB page limit on purpose. This file is opened over whatever
// connection the person sharing it has; the last two megabytes of a music loop
// are not worth the wait.
const CEILING_MB = 13

/**
 * MP3 frames are self-delimiting, so a track can be shortened by walking the
 * frame headers and stopping — no decoder needed. The single-file build uses a
 * trimmed loop when the whole track will not fit beside the film; the served
 * site always gets the full one.
 */
function trimMp3(buf, seconds) {
  const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
  const RATES = [44100, 48000, 32000]
  let i = 0
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f))
  }
  let played = 0
  while (i < buf.length - 4) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue }
    const br = BITRATES[(buf[i + 2] >> 4) & 0xf]
    const sr = RATES[(buf[i + 2] >> 2) & 0x3]
    if (!br || !sr) { i++; continue }
    const len = ((144 * br * 1000) / sr | 0) + ((buf[i + 2] >> 1) & 1)
    if (len <= 0) { i++; continue }
    played += 1152 / sr
    i += len
    if (played >= seconds) break
  }
  return buf.subarray(0, i)
}

const MEDIA_SLOTS = [
  ...SECTIONS.flatMap((s) =>
    ['approach', 'action']
      .filter((role) => s[role])
      .map((role) => [`section:${s.id}:${role}`, `public${s[role]}`, 'video/mp4']),
  ),
  ['video', 'public/media/scene.mp4', 'video/mp4'],
  ['music', 'public/media/track.mp3', 'audio/mpeg'],
  ['breath', 'public/media/breath.mp3', 'audio/mpeg'],
]

const injected = {}
const sectionSrc = {}
const skipped = []
let budget = CEILING_MB * 1024 * 1024 - script.length - styles.length
let embeddedBytes = 0

for (const [slot, path, mime] of MEDIA_SLOTS) {
  if (!existsSync(path)) continue
  let raw = readFileSync(path)
  let note = ''
  if (Math.ceil(raw.length / 3) * 4 > budget && slot === 'music') {
    // Rather than drop the sound entirely, shorten the loop until it fits.
    for (const seconds of [90, 60, 45, 30]) {
      const trimmed = trimMp3(raw, seconds)
      if (Math.ceil(trimmed.length / 3) * 4 <= budget) {
        raw = trimmed
        note = ` (trimmed to ~${seconds}s to fit)`
        break
      }
    }
  }
  const encoded = Math.ceil(raw.length / 3) * 4
  if (encoded > budget) {
    skipped.push(`${slot} (${(statSync(path).size / 1024 / 1024).toFixed(1)} MB)`)
    continue
  }
  budget -= encoded
  const bytes = raw.length
  embeddedBytes += bytes
  const uri = `data:${mime};base64,${raw.toString('base64')}`
  if (slot.startsWith('section:')) sectionSrc[slot.slice('section:'.length)] = uri
  else injected[slot] = [uri]
  console.log(`  embedding ${slot}: ${(bytes / 1024 / 1024).toFixed(1)} MB${note}`)
}
if (Object.keys(sectionSrc).length) injected.sections = sectionSrc
if (skipped.length) console.log(`  left out (no room): ${skipped.join(', ')}`)

const mediaTag = Object.keys(injected).length
  ? `<script>window.__EROTICAD_MEDIA=${JSON.stringify(injected)}</script>\n`
  : ''

// A literal </script> anywhere in the bundle would close the tag early.
const safeScript = script.replace(/<\/script/gi, '<\\/script')

const html = `<title>Maison Ondine</title>
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

${mediaTag}<script type="module">
${safeScript}
</script>
`

writeFileSync(OUT, html)
const mb = (html.length / 1024 / 1024).toFixed(2)
console.log(`${OUT} — ${mb} MB (${(embeddedBytes / 1024 / 1024).toFixed(1)} MB of it media)`)
if (html.length > 16 * 1024 * 1024) {
  console.warn('  ! over the 16 MB artifact ceiling — the media needs trimming')
}
