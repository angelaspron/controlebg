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
      },
      '/bgg-api': {
        target: 'https://boardgamegeek.com/xmlapi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bgg-api/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      }
    }
  }
})
