import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Main renderer config
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        live: path.resolve(__dirname, 'src/live/live.html')
      }
    }
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  }
})
