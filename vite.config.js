import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { writeFileSync, mkdirSync } from 'node:fs';

// Dev server only: the Dungeon Master's app posts the journal here, and it is saved to
// tools/out/journal.local.json (git-ignored), so Claude can read the characters and places.
const journalDump = {
  name: 'journal-dump',
  configureServer(server) {
    server.middlewares.use('/__journal-dump', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        mkdirSync('tools/out', { recursive: true });
        writeFileSync('tools/out/journal.local.json', body);
        res.end('ok');
      });
    });
  },
};

// `npm run build` makes a self-contained copy in "Play/" that opens with a
// plain double-click (no server needed): all code is inlined into one HTML file.
export default defineConfig({
  base: './',
  server: { open: true },
  plugins: [viteSingleFile(), journalDump],
  // Shown in the name-badge menu, to check a phone runs the newest version.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  build: { outDir: 'Play', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
