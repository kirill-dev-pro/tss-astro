import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      // Vitest+jsdom otherwise resolves `ws` to browser stub without WebSocketServer
      ws: path.join(root, 'node_modules/ws/index.js'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'forks',
    setupFiles: ['./test/setup.ts'],
    server: { deps: { inline: ['@solidjs/testing-library'] } },
  },
});
