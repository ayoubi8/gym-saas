import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'GymDZ — Gym Management',
        short_name: 'GymDZ',
        description: 'Multi-tenant gym management for Algeria',
        theme_color: '#0B1F14',
        background_color: '#F3F4F6',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
})
