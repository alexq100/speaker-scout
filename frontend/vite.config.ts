import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The FastAPI backend (backend/main.py) runs the agents and stores searches.
// Proxying /api keeps the browser on one origin, so no CORS setup is needed.
// start.sh sets API_PORT / WEB_PORT; the defaults match a plain `npm run dev`.
const apiTarget = `http://127.0.0.1:${process.env.API_PORT ?? '8000'}`

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? '5173'),
    proxy: { '/api': apiTarget },
  },
})
