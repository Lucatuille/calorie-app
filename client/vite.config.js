import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    process.env.ANALYZE && visualizer({ open: true, gzipSize: true, filename: 'dist/stats.html' }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      input: {
        app: './app.html',
      }
    }
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
