/**
 * Fetching the next sections quietly, while nothing else needs the connection.
 *
 * A section's files only start downloading when the page reaches it, so a
 * quick scroll arrives somewhere that has nothing yet and waits — with the
 * action clip that is the whole wait, since the mark does not appear until it
 * is buffered end to end. This walks a section or two ahead in the background
 * so that by the time you get there, it is already in the browser's cache.
 *
 * Three rules make it safe rather than harmful:
 *
 * **It stops while the hand is working.** A download competing with a scrub is
 * exactly what made section six stutter, and prefetching would recreate that
 * on every section. `setBusy(true)` aborts whatever is in flight.
 *
 * **It fetches into the cache, not into video elements.** The transport
 * already holds fifteen `<video>` elements by section seven and never releases
 * them; adding more would run into the hard limit browsers put on simultaneous
 * decoders — iOS Safari's is low enough to simply stop playing. A plain
 * `fetch` warms the same HTTP cache the element will read from, and costs no
 * decoder at all.
 *
 * **It looks two sections ahead, not ten.** Someone who leaves after section
 * two should not have paid for section nine.
 *
 * To remove all of this: delete this file and the four lines in `App.jsx` that
 * mention `prefetch`. Nothing else knows it exists.
 */

/** How many sections ahead to warm. */
const LOOKAHEAD = 2

/** Someone on a metered or crawling connection gets none of this. */
function unwelcome() {
  if (typeof navigator === 'undefined') return true
  const c = navigator.connection
  if (!c) return false
  if (c.saveData) return true
  return c.effectiveType === 'slow-2g' || c.effectiveType === '2g'
}

/** Every file a section needs, in the order it will need them. */
function filesFor(section) {
  if (!section) return []
  const out = []
  if (section.approach) out.push(section.approach)
  for (const step of section.steps ?? []) if (step.src) out.push(step.src)
  // A single-file build carries its media inline; there is nothing to fetch.
  return out.filter((u) => typeof u === 'string' && !u.startsWith('data:'))
}

export function createPrefetcher({ sections, lookahead = LOOKAHEAD }) {
  const done = new Set()
  let queue = []
  let busy = true
  let running = false
  let controller = null
  let disposed = false

  const pump = async () => {
    if (running || disposed || busy) return
    const url = queue.shift()
    if (!url) return
    if (done.has(url)) {
      pump()
      return
    }
    running = true
    controller = new AbortController()
    try {
      const res = await fetch(url, { signal: controller.signal, priority: 'low' })
      // Read it through: the response is only cached once the body is consumed.
      await res.arrayBuffer()
      done.add(url)
    } catch {
      /* aborted, offline, or refused — it will be asked for again if needed */
    } finally {
      running = false
      controller = null
      if (!disposed && !busy) pump()
    }
  }

  return {
    /** Warm the sections after this one. */
    want(index) {
      if (disposed || unwelcome()) return
      const next = []
      for (let i = index + 1; i <= index + lookahead; i += 1) {
        for (const url of filesFor(sections[i])) if (!done.has(url)) next.push(url)
      }
      queue = next
      pump()
    },

    /**
     * True while the hand is on the mark, or while the section the page is on
     * has not finished loading its own clips. Either way the connection
     * belongs to something more urgent than a section nobody has reached.
     */
    setBusy(next) {
      if (busy === next) return
      busy = next
      if (busy) controller?.abort()
      else pump()
    },

    dispose() {
      disposed = true
      controller?.abort()
      queue = []
    },
  }
}
