/**
 * Shown once the section's action has been performed: the film has nothing
 * more to give here, and the way on is down.
 */
export default function ScrollCue({ visible }) {
  return (
    <div
      className="materialize fixed inset-x-0 bottom-8 z-30 flex flex-col items-center gap-2"
      data-visible={visible}
      /* `.materialize[data-visible]` restores pointer events for the CTA it was
         written for; this one is a caption across the foot of the screen and
         must never take a touch. Inline beats both rules. */
      style={{ pointerEvents: 'none' }}
      aria-hidden={!visible}
    >
      <span className="font-sans text-[0.52rem] font-light uppercase tracking-widest2 text-gold-300/70">
        Scroll on
      </span>
      <svg width="13" height="9" viewBox="0 0 18 12" fill="none" aria-hidden="true">
        <g
          stroke="#d9a441"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="rotate(90 9 6)"
        >
          <path d="M4 1.5 L9 6 L4 10.5" />
          <path d="M9.5 1.5 L14.5 6 L9.5 10.5" opacity="0.5" />
        </g>
      </svg>
    </div>
  )
}
