/**
 * The sound is half the piece, so it starts on — but a page that plays audio
 * at you and gives you nowhere to turn it off is rude, and the control has to
 * be visible before you go looking for it.
 */
export default function SoundToggle({ muted, onToggle }) {
  return (
    <button
      type="button"
      data-interactive
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? 'Turn the sound on' : 'Turn the sound off'}
      title={muted ? 'Sound off' : 'Sound on'}
      className="group pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-blush/15 transition-colors duration-500 ease-silk hover:border-gold-400/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-gold-400"
    >
      <svg width="15" height="14" viewBox="0 0 16 15" fill="none" aria-hidden="true">
        <path
          d="M2 5.6h2.6L8 2.4v10.2L4.6 9.4H2z"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
          className="text-blush/70 transition-colors duration-500 group-hover:text-gold-200"
          fill="none"
        />
        {muted ? (
          <path
            d="M11 5.5 L14.5 9.5 M14.5 5.5 L11 9.5"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            className="text-crimson-400/80 transition-colors duration-500 group-hover:text-crimson-200"
          />
        ) : (
          <g
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
            className="text-gold-300/70 transition-colors duration-500 group-hover:text-gold-200"
          >
            <path d="M10.8 5.4a3.2 3.2 0 0 1 0 4.2" />
            <path d="M12.9 3.6a6 6 0 0 1 0 7.8" opacity="0.55" />
          </g>
        )}
      </svg>
    </button>
  )
}
