import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  root: resolve(__dirname),
  base: './',
  publicDir: resolve(__dirname, '../../public'),
  build: { outDir: resolve(__dirname, '../../visual-dist'), emptyOutDir: true },
  optimizeDeps: { exclude: ['@babylonjs/havok'] },
});
