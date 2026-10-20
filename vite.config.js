import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 7172,
    proxy: {
      '/v1': { target: 'http://127.0.0.1:7171', changeOrigin: true, ws: true },
    },
  },
});
