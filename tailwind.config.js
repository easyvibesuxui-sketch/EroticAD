/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: '#040203',
        ink: '#0a0507',
        crimson: {
          50: '#fdf2f4',
          200: '#f0c2ca',
          400: '#c4536b',
          500: '#a32b45',
          600: '#82122c',
          700: '#5c0a1e',
          900: '#2a040e',
        },
        blush: '#e8c4bd',
        // The interaction language: everything the hand can act on is gold.
        gold: {
          200: '#f2dcae',
          300: '#e8c684',
          400: '#d9a441',
          500: '#bf8a2c',
          700: '#7a541a',
        },
        smoke: '#b9a7a5',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Didot', 'Georgia', 'serif'],
        sans: ['"Jost"', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.42em',
        widest3: '0.6em',
      },
      transitionTimingFunction: {
        silk: 'cubic-bezier(0.16, 0.84, 0.24, 1)',
        breathe: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        // The translate stays inside the keyframe: a bare `transform: scale()`
        // would replace Tailwind's centering translate and throw the glow into
        // the corner.
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'translate(-50%, -50%) scale(1)' },
          '50%': { opacity: '0.8', transform: 'translate(-50%, -50%) scale(1.07)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        // Dashes crawl along the guide path, toward the thing you are meant
        // to drag it to.
        dashFlow: {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-12' },
        },
        breathRing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%': { transform: 'scale(1.09)', opacity: '0.95' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 5.5s cubic-bezier(0.4,0,0.2,1) infinite',
        shimmer: 'shimmer 3.6s cubic-bezier(0.4,0,0.2,1) infinite',
        dashFlow: 'dashFlow 1.6s linear infinite',
        breathRing: 'breathRing 2.8s cubic-bezier(0.4,0,0.2,1) infinite',
      },
    },
  },
  plugins: [],
}
