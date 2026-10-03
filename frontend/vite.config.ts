import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, /api is proxied to the local FastAPI server (uv run uvicorn app.main:app).
// In production, Vercel rewrites /api to the Render backend (see vercel.json).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': `${import.meta.dirname}/src` },
  },
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
})
