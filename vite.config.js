import { defineConfig } from 'vite';

// O Havok usa WebAssembly: precisa ficar fora da pré-otimização do Vite
// para que o arquivo .wasm seja encontrado em desenvolvimento e no build.
export default defineConfig({
  base: './',
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 6000,
  },
});
