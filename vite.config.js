import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subpasta (GitHub Pages, artifact, etc.)
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 6000,
    assetsInlineLimit: 0
  }
});
