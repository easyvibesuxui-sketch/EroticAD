import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  /*
   * Served from a domain root by default. GitHub Pages puts the site under
   * `/<repo>/`, so the deploy workflow passes VITE_BASE — everything written as
   * `/media/...` is re-rooted through `src/lib/asset.js`, which reads this.
   * The single-file artifact build leaves it alone: it carries its media inline.
   */
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { host: true, port: 5173 },
  assetsInclude: ['**/*.glsl'],
})
