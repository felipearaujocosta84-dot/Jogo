import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5174,
    // em desenvolvimento, o multiplayer e a API vão para o servidor Node (npm start na porta 8080)
    proxy: {
      '/ws': { target: 'ws://localhost:8080', ws: true },
      '/api': 'http://localhost:8080'
    }
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 6000,
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'shaders', test: /@babylonjs[\\/]core[\\/]Shaders[\\/]/ },
            { name: 'shaders-webgpu', test: /@babylonjs[\\/]core[\\/]ShadersWGSL[\\/]/ },
            { name: 'babylon-extras', test: /@babylonjs[\\/]core[\\/]/ }
          ]
        }
      }
    }
  }
});
