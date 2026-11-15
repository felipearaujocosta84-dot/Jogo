import { defineConfig } from 'vite';

export default defineConfig({
  // caminhos relativos: o build funciona em qualquer pasta (GitHub Pages, WebView do APK, etc.)
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 6000,
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'shaders', test: /@babylonjs[\\/]core[\\/]Shaders[\\/]/ },
            { name: 'shaders-webgpu', test: /@babylonjs[\\/]core[\\/]ShadersWGSL[\\/]/ }
          ]
        }
      }
    }
  }
});
