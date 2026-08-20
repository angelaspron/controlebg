import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/ludo-api': {
        target: 'https://ludopedia.com.br/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ludo-api/, '')
      }
    }
  }
})
