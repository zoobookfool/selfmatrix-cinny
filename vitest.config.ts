import { defineConfig } from 'vitest/config';

// SelfMatrix: minimal standalone vitest config, kept separate from
// vite.config.js so the production build config (static-copy targets, PWA
// plugin, wasm handling, etc.) is untouched. Only src/**/*.test.ts(x) files
// are covered for now (shellLayout merge + notification gate pure-function
// regression tests) — no jsdom/browser environment is configured because
// those tests exercise plain TypeScript logic, not React components.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
