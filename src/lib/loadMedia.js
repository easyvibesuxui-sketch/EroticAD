import { LOAD_TIMEOUT_MS } from './media.js'

/**
 * Tries each candidate in order and resolves with the first one that actually
 * decodes. A missing local file is served back as HTML by the dev server, so
 * "it responded" is not good enough — we wait for real media data.
 */
function attempt(el, src, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false

    const finish = (ok) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      el.removeEventListener('loadeddata', onReady)
      el.removeEventListener('canplay', onReady)
      el.removeEventListener('error', onFail)
      resolve(ok)
    }

    const onReady = () => finish(true)
    const onFail = () => finish(false)
    const timer = setTimeout(() => finish(false), timeoutMs)

    el.addEventListener('loadeddata', onReady)
    el.addEventListener('canplay', onReady)
    el.addEventListener('error', onFail)

    el.src = src
    el.load()
  })
}

async function loadFirst(el, sources, timeoutMs) {
  for (const src of sources) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await attempt(el, src, timeoutMs)
    if (ok) return src
  }
  return null
}

/**
 * A muted, looping, inline video element wired for WebGL upload.
 * `crossOrigin` is mandatory: without it a cross-origin frame taints the
 * texture and the draw call throws.
 */
export async function loadVideo(sources, timeoutMs = LOAD_TIMEOUT_MS) {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.defaultMuted = true
  video.loop = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.preload = 'auto'
  video.disablePictureInPicture = true

  const src = await loadFirst(video, sources, timeoutMs)
  if (!src) {
    video.removeAttribute('src')
    return null
  }
  return video
}

/** An audio element that can be legally routed through a Web Audio graph. */
export async function loadAudio(sources, timeoutMs = LOAD_TIMEOUT_MS) {
  const audio = document.createElement('audio')
  audio.crossOrigin = 'anonymous'
  audio.loop = true
  audio.preload = 'auto'

  const src = await loadFirst(audio, sources, timeoutMs)
  if (!src) {
    audio.removeAttribute('src')
    return null
  }
  return audio
}
