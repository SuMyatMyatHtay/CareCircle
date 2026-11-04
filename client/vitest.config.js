import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Keep absolute paths like /carecircle-logo.jpg as plain URLs. Otherwise tests try to
  // import them as files, which fails on Windows because the path has no drive letter.
  plugins: [vue({ template: { transformAssetUrls: { includeAbsolute: false } } })],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    include: ['src/**/__tests__/**/*.spec.js'],
    setupFiles: ['./src/test/setup.js'],
    clearMocks: true,
    restoreMocks: true,
  },
})
