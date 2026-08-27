import { SECTIONS } from '../lib/sections.js'

/**
 * Ten ticks down the right edge: where you are, and what you have already
 * undone. The filled ones are actions performed, not sections passed — the
 * difference is the whole point of the site.
 */
export default function SectionRail({ active, committedIds }) {
  return (
    <nav
      aria-label="Sections"
      className="pointer-events-none fixed right-5 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3 sm:right-8"
    >
      {SECTIONS.map((section) => {
        const isActive = section.index === active
        const done = committedIds.has(section.id)
        return (
          <span
            key={section.id}
            className="block h-px transition-all duration-700 ease-silk"
            style={{
              width: isActive ? 22 : 11,
              background: done ? '#d9a441' : '#e8c4bd',
              opacity: isActive ? 0.95 : done ? 0.6 : 0.22,
            }}
          />
        )
      })}
    </nav>
  )
}
