import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Proxy HA-addon API endpoints to the Python server during local dev
    proxy: {
      '/config':       'http://localhost:8080',
      '/floorplan.svg': 'http://localhost:8080',
    },
  },
});
