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
- Hosting: Netlify builds and deploys automatically on every push to `main` (see `netlify.toml`).
  Live site: https://cool-jelly-22cdf9.netlify.app
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

## Screens

- **Start screen** (shown every time the app opens): split in two.
  - Left: "Log in as Dungeon Master". Right: "Player", with a list of heroes to pick.
  - Players land on Status locked to their own hero (the ‹ › arrows are hidden). The DM lands on
    the map and can flip through every hero.
  - The role chip at the top right shows who you are; tapping it returns to the start screen.
  - The DM side asks for a code (`DM_CODE` in main.js). It only keeps players out casually,
    because the code is visible in the app's source. Real accounts come with Supabase
    (roadmap step 3).

- The top nav has three screens: **Map · Status · Party**. The map only renders while it is showing.
- **Status** (`src/status/statusScreen.js`) has the character sheet on the left and a 3D figure
  on the right, with ‹ › arrows to switch hero.
  - The sheet is a trimmed-down 5e sheet: level, XP, HP, AC, initiative, speed, proficiency and
    the six abilities, plus tabs for Combat (attacks and features), Skills (saves and skills),
    Gear and Story.
  - Design rule: keep it calm. Use one card, plain rows with thin dividers, and no boxes inside
    boxes.
- Character data is in `src/data/characters.js` and stores only the basics. The 5e maths
  (modifiers, saves, skills with expertise, attacks, XP levels) is in `src/character/rules.js`.
  - Heroes: Rikart Hagenstorm (Fighter), Flame Slinger (Rogue) and Edbart Frostvarg (Ranger).
  - Every stat, and the classes of Flame Slinger and Edbart, is a PLACEHOLDER until the owner
    gives the real sheets.
- Character figures are in `src/character/model.js`, styled after the game Erosion: tall and
  slender low-detail voxels with no faces, in soft pastel light.
  - Every hero shares one build and one idle animation (`assemble`).
  - Varg the wolf stands beside Edbart.
  - The stage (`src/status/viewer.js`) has its own small renderer, a round plinth sized per
    figure, and drag to turn.
- Gear (`src/data/items.js`, `src/character/equipment.js`):
  - Every item lives in one catalogue with its 5e stats. A character lists the item ids they own
    and their `equipped` slots: mainHand, offHand and armour.
  - AC and the attack list are derived from what is equipped, including Dueling and Archery and
    the off-hand rules (rules.js).
  - Equip rules: two-handed weapons empty the off hand, and an off-hand weapon must be light,
    with a light weapon in the main hand too.
  - The Gear tab has a dropdown per slot. Players can change only their own hero; the DM can
    change anyone's.
  - Choices are saved in localStorage per device until online saving exists.
  - Figures are dressed from gear (`dress` in model.js):
    - Armour recolours the torso and shoulders.
    - Held weapons appear in the hand (bows in the left hand).
    - Swords not in hand hang at the left hip, with an empty scabbard when drawn.
    - Axes hang at the right hip, and bows go on the back next to the quiver.
- **Party** (`src/status/partyScreen.js`) shows a card per hero with HP, AC, initiative and
  passive perception. Tapping a card opens that hero on Status.
- Map HUD is kept minimal:
  - Top left: a "‹ World" back button (in cities) and the Places menu, titled with the current
    map.
  - Bottom right: show-whole-map and compass.
  - Bottom left: "?" opens the controls help and the miniature-blur setting.

## Decisions so far

- Tech stack: a web app built with Vite and three.js. No App Store; it's installed by adding it
  to the iPhone home screen. Capacitor can wrap it as a native app later if needed.
- Phone support: safe-area insets, `black-translucent` status bar, and a landscape layout. City
  views pull the camera back on tall screens.
- Map labels appear by zoom level and tier. Overlapping labels are hidden, with priority going to
  the higher tier.
- Touch controls are in `src/fx/touchGestures.js`, using TouchEvents.
  - One finger pans, through MapControls; its `touches.TWO` is turned off.
  - Two fingers: twist rotates the map with the fingers (after a dead zone of about 10°),
    pinch zooms, and sliding up or down tilts.
  - The compass button (bottom right) shows north and returns the view to north-up when tapped.
- Phones are landscape-only: held upright, they show a "turn your phone sideways" screen and stop
  rendering. iOS can't lock the orientation of a home-screen app.
- Performance:
  - Voxels use `src/fx/bevelBox.js`, a 44-triangle bevelled box. The earlier RoundedBoxGeometry
    took 300 triangles per voxel, and there are about 65k instances.
  - The shadow map only updates when needed: on view switch, and every `view.shadowEvery`
    frames on the world view because of the clouds.
  - In dev, `window.__debug` exposes the renderer and the current view.

## Roadmap (agreed order)

1. Performance and app shell. The cheap voxels and on-demand shadows are done.
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
