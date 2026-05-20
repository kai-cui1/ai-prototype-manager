import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.WEB_PORT) || 13181,
    strictPort: true,           // 端口被占用时报错而非自动递增
    // P2 Fix: 使用 polling 模式替代 fsevents，避免 macOS com.apple.provenance 属性
    // 导致的高频文件监听 EPERM 错误（fsevents 内核回调与 Gatekeeper 安全检查竞争）
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': {
        target: `http://localhost:${Number(process.env.API_PORT) || 13180}`,
        changeOrigin: true,
      },
    },
  },
});
