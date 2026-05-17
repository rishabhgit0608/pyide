import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  build: {
    outDir: 'dist',      // resolves to frontend/dist/
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/documents': 'http://localhost:8000',
      '/sessions':  'http://localhost:8000',
      '/run':       'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
