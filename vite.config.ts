import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 字符串简写写法
      '/api': 'http://localhost:8000',
      // 代理 WebSocket
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    }
  }
})
