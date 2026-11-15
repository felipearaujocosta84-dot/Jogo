import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subpasta (GitHub Pages, hospedagem estática, etc.)
  base: './',
  server: { host: true, port: 5174 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 6000,
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // Agrupa os shaders carregados sob demanda: poucos arquivos = carregamento mais rápido no celular
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
