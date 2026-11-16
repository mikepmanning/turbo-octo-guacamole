import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  // Vitest: `npm test` (one run + coverage + HTML reports), `npm run test:watch` (dev)
  test: {
    // jsdom (not happy-dom): it validates <input type="number" step="0.01">
    // like a real browser, which RecipeForm's required-field checks rely on.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    restoreMocks: true,
    // Form tests type through user-event, re-rendering and re-validating the form on every
    // keystroke; under `npm test` (coverage, files in parallel) the longest take 3-5s, right
    // at Vitest's 5s default. 15s still catches a test that hangs.
    testTimeout: 15000,
    // Terminal output as usual, plus an HTML test report on every run.
    // singleFile: one self-contained index.html that opens straight from disk.
    reporters: [
      'default',
      ['html', { outputDir: 'test_reports', singleFile: true }],
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**', 'src/**/*.test.{js,jsx}'],
      // lcovonly: just lcov.info for tools; 'lcov' would add a second HTML copy
      reporter: ['text', 'html', 'lcovonly'],
      // Next to the HTML test report (test_reports/index.html), where its Coverage
      // tab looks, so Vitest uses this folder directly instead of duplicating it.
      reportsDirectory: 'test_reports/coverage',
      thresholds: {
        lines: 80,
      },
    },
  },
})
