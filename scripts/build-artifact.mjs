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
/*
 * Counted in MiB, while the 16 MB page limit that matters is very likely
 * decimal: 15.5 MiB measured here came out at 15.98 million bytes, which is
 * 22 kB under the line. A page that overruns does not publish at all, so the
 * margin stays wide. Everything above the footage's own needs goes to the
 * music loop, which is the only thing here that gets shorter rather than
 * disappearing.
 */
const CEILING_MB = 15

/**
 * A VBR MP3 does not carry its length in its frames — it carries it in a Xing
 * (or Info) header in the very first one, and every player believes that header
 * over the data behind it.
 *
 * So a file cut short by dropping frames still announces the original running
 * time, and the element loops on *that*: it plays the audio it has, stalls at
 * the cut with three minutes still to go on the clock, and eventually gives up
 * and starts over. Which is exactly "it only plays a little bit".
 *
 * Rewriting the header is the whole fix. The frame count and byte count are
 * set to what the file now holds, and the seek table and quality flags are
 * cleared — their old contents describe a file that no longer exists.
 */
function reframeXing(buf, frames, frameStart) {
  /*
   * The header sits inside the first audio frame, past a side-info gap whose
   * size depends on the channel mode — 36 bytes in for a stereo MPEG-1 file.
   * Searching from the start of that frame rather than from the start of the
   * file is what makes this reliable: an ID3 tag in front of it can be any
   * length at all, and on this track it is 168 bytes, which put the magic at
   * byte 204 and just outside a fixed window.
   */
  const from = frameStart
  const limit = Math.min(buf.length - 16, from + 64)
  for (let i = from; i < limit; i += 1) {
    const tag = buf.toString('latin1', i, i + 4)
    if (tag !== 'Xing' && tag !== 'Info') continue
    // FRAMES | BYTES, and nothing else: a stale table is worse than none.
    buf.writeUInt32BE(0x0003, i + 4)
    buf.writeUInt32BE(frames, i + 8)
    buf.writeUInt32BE(buf.length, i + 12)
    return true
  }
  return false
}

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
  const frameStart = i
  let played = 0
  let frames = 0
  while (i < buf.length - 4) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue }
    const br = BITRATES[(buf[i + 2] >> 4) & 0xf]
    const sr = RATES[(buf[i + 2] >> 2) & 0x3]
    if (!br || !sr) { i++; continue }
    const len = ((144 * br * 1000) / sr | 0) + ((buf[i + 2] >> 1) & 1)
    if (len <= 0) { i++; continue }
    played += 1152 / sr
    frames += 1
    i += len
    if (played >= seconds) break
  }
  // A copy, because the header is about to be rewritten and the original buffer
  // may still be wanted at full length.
  const cut = Buffer.from(buf.subarray(0, i))
  // The Xing frame is a header, not audio: it is not counted in `frames`.
  reframeXing(cut, Math.max(frames - 1, 1), frameStart)
  return cut
}

/*
 * Order is priority: the budget is spent from the top down and whatever will
 * not fit is left out.
 *
 * Footage goes first and the track last, which looks backwards until you see
 * what each one loses when it is short of room. A clip that will not fit is
 * simply gone — that section's picture stops moving under the hand. The track
 * is not: `trimMp3` shortens the loop until it fits, so it is the one thing
 * here that degrades instead of disappearing. It therefore goes at the end,
 * where it takes what is left.
 */
const MEDIA_SLOTS = [
  ...SECTIONS.flatMap((s) => [
    ...(s.approach ? [[`section:${s.id}:approach`, `public${s.approach}`, 'video/mp4']] : []),
    // A section is a sequence of actions; most sequences are one long.
    ...s.steps
      .filter((step) => step.src)
      .map((step) => [`section:${s.id}:step:${step.n}`, `public${step.src}`, 'video/mp4']),
  ]),
  ['video', 'public/media/scene.mp4', 'video/mp4'],
  ['music', 'public/media/track.mp3', 'audio/mpeg'],
  ['after', 'public/media/after.mp3', 'audio/mpeg'],
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
    for (const seconds of [120, 90, 60, 45, 30, 20]) {
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
