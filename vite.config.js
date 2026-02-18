import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Charts (heavy, admin-only)
          'vendor-charts': ['recharts'],
          // PDF/Canvas (heavy, admin-only)
          'vendor-pdf': ['jspdf', 'html2canvas'],
          // Icons
          'vendor-icons': ['lucide-react'],
          // Misc utilities
          'vendor-misc': ['lodash', 'react-confetti', 'react-qr-code'],
        },
      },
    },
  },
})
