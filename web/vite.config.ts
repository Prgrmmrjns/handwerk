import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Relative asset paths so the bundle loads inside Capacitor's WebView
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@scene': path.resolve(root, '../shared/scene'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
})
