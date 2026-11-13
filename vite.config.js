import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes a self-contained copy in "Play/" that opens with a
// plain double-click (no server needed): all code is inlined into one HTML file.
export default defineConfig({
  base: './',
  server: { open: true },
  plugins: [viteSingleFile()],
  // Shown in the name-badge menu, to check a phone runs the newest version.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  build: { outDir: 'Play', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
