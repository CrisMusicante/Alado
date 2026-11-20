import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// The phone app (PWA). Built into cloud/public so the Worker serves it next to the API.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  build: { outDir: path.resolve(__dirname, '../cloud/public'), emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
})
