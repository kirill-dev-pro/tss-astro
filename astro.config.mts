import node from '@astrojs/node'
import solidJs from '@astrojs/solid-js'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  integrations: [solidJs()],
  adapter: node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss() as any],
    resolve: {
      alias: {
        // solid-js `./jsx-runtime` export points at `solid.js` (no `jsx` named export); real helper is under `h/`
        'solid-js/jsx-runtime': 'solid-js/h/jsx-runtime',
        'solid-js/jsx-dev-runtime': 'solid-js/h/jsx-dev-runtime',
      },
    },
  },
})
