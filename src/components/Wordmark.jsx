import { BRAND } from '../lib/brand.js'

/**
 * The mark is the ring.
 *
 * Not a decorative monogram: it is the same hairline circle, the same gap, the
 * same terminus dot that every section asks you to drag. The house's logo and
 * its one gesture are the same object, which is about as close as a mark can
 * get to meaning something.
 */
export default function Wordmark({ className = '', size = 15 }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* the ring, open on the right — a clasp that has been undone */}
        <path
          d="M16.9 5.4a8 8 0 1 0 3.05 4.9"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        {/* the terminus, where the hand finishes */}
        <circle cx="20.6" cy="12.4" r="1.7" fill="currentColor" />
      </svg>
      <span className="font-sans text-[0.6rem] font-light uppercase tracking-widest3">
        {BRAND.wordmark}
      </span>
    </span>
  )
}
