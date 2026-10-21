import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    include: ['src/**/__tests__/**/*.spec.js'],
    setupFiles: ['./src/test/setup.js'],
    clearMocks: true,
    restoreMocks: true,
  },
})
