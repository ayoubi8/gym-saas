import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Full Vite config (PWA plugin, etc.) lands in Phase 1B
export default defineConfig({
  plugins: [react()],
})
