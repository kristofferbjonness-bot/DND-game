import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes a self-contained copy in "Play/" that opens with a
// plain double-click (no server needed): all code is inlined into one HTML file.
export default defineConfig({
  base: './',
  server: { open: true },
  plugins: [viteSingleFile()],
  build: { outDir: 'Play', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
