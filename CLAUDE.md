# DND game

A companion app for the owner's homebrew D&D world, played with friends. It runs in the
browser and on iPhone (added to the home screen). The art style is soft voxel 3D with a playful,
colourful look, similar in vibe to Link's Awakening. The owner is not a programmer: explain
things in plain words, and work in small, testable steps.

The original assets (hand-drawn world map, location art, character art, lore document) are in
`~/Desktop/DND`, outside this repo. The source map was copied to `assets/source/world-map.png`.

## Run / build

- `npm run dev`: dev server with hot reload. "Open World Map.command" does the same with a double-click.
- `npm run build`: builds a single self-contained HTML file into `Play/`, as both `index.html`
  (for hosting) and `World Map.html` (opens with a double-click over file://).
- Hosting: upload the `Play/` folder to Netlify (free).
- `npm run bake`: regenerates `src/data/world-grid.json` from the map PNG. This is only needed
  if the source map changes.
- `npm run postcards`: re-renders the location pictures in `public/art/places/` (needs the dev
  server running).

## Structure

- `src/main.js`: app entry. It holds two kinds of view, the world map and the city maps, which
  share one renderer, the post-processing, the CSS2D labels and the info panel. It also handles
  camera flights, the places list, and zoom-based label visibility with overlap decluttering.
  The `TOUCH` flag lowers quality on phones.
- `src/world/`
  - `grid.js`: grid decode and helpers.
  - `terrain.js`: instanced voxel columns.
  - `scatter.js`: trees and clouds.
  - `landmarks.js`: small town models.
  - `locations.js`: all named places, with their lore text. Only player-safe text goes here.
- `src/city/`
  - `vox.js`: a sparse voxel builder and its prefabs.
  - `razz.js`: the Razz of Mataz city map, with its places.
  - `cities.js`: the registry of city maps.
- `src/fx/tiltShift.js`: the optional miniature blur.
- `tools/`
  - `bake-map.mjs`: map bake.
  - `postcards/`: headless-Chrome diorama renders for the location images.

## Decisions so far

- Tech stack: a web app built with Vite and three.js. No App Store; it's installed by adding it
  to the iPhone home screen. Capacitor can wrap it as a native app later if needed.
- Phone support: safe-area insets, `black-translucent` status bar, and a landscape layout. City
  views pull the camera back on tall screens.
- Map labels appear by zoom level and tier. Overlapping labels are hidden, with priority going to
  the higher tier.

## Roadmap (agreed order)

1. Performance and app shell.
   - Merge the voxels into chunked meshes with face culling, instead of one instance per cube.
   - Render on demand instead of every frame, and use lighter shadows on phones.
   - Add a home screen with tabs (World Map · Characters · later Party, Journal, DM tools),
     where the non-3D screens never load three.js.
2. Character creator and character sheet: stats, equipment and inventory. Save to the device
   first (localStorage).
3. Accounts and online sync with Supabase, so friends log in and the DM can see and edit
   characters.
4. Extras: voxel character models built from the creator choices, an item database for the
   world, dice, a quest journal.

## Open questions for the owner

- Rules: standard D&D 5e, or their own system?
- Can players edit their own stats and inventory, or does only the DM hand out items, gold and
  levels?
- Character look: the owner's own drawings, or a voxel figure built in the creator?
- Lore gaps:
  - No text yet for Kolaveri Di, Ikeheim, Siri's Gap, The Roof (Razz) and Ulrik's Hideout.
  - Who is Ulrik? His hideout is currently modelled on the Man Who Makes Himself Known.
  - Names for the four "?" dots.
  - Where Hrimnir should go (it conflicts with a placement on the map).
  - Check the spelling of "Torgrim the Glaced".
