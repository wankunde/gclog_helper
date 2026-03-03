import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gclog_helper/',
  root: '.',
  build: { outDir: 'dist' },
  server: { open: true }
});
