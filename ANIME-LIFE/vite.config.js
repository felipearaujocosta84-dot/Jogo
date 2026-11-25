import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: funciona no navegador, em subpastas e dentro do APK (Capacitor).
  base: './',
  server: { host: true, port: 5174 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
});
