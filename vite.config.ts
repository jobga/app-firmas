import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo la API PHP corre con: npm run dev:php (php -S 127.0.0.1:8000)
const php = 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': php, '/install': php, '/uploads': php },
  },
  build: {
    chunkSizeWarningLimit: 800,
  },
});
