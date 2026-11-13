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

- **Online backend: Supabase.**
  - Project `dnd-world`, URL https://bmuktbeyfpwovcrqnvsk.supabase.co. The publishable key is in
    `src/net/backend.js`.
  - Schema and security rules are in `supabase/schema.sql` (row level security).
  - Players see the party and revealed things and edit only their own hero. Only the DM sees DM
    notes and hidden secrets.
  - Email sign-up is open, and email confirmation is turned off.
  - The DM is promoted by hand in the SQL editor:
    `update public.profiles set role = 'dm' where id = (select id from auth.users where email = '...');`
  - The characters table holds the whole sheet as JSON in `data`.
    `src/data/characters.js` is only the STARTING data: the first DM login seeds it when the
    table is empty. After that, the database is the source of truth, and changing
    characters.js does not change existing heroes.
  - Live updates: `watchCharacters` (Supabase realtime) refreshes Status and Party on every
    device.
- **Start screen** (`src/start/startScreen.js`): split in two halves.
  - Left: the DM logs in with email and password. Non-DM accounts are refused.
  - Right: players log in or create an account. On first login they claim a free hero
    (`claim_character`).
  - The login session is remembered, so the app skips the start screen next time. The role
    chip at the top right logs out.
  - Players land on Status locked to their hero; the DM lands on the map.
  - The name badge opens a menu, and is the DM's only view switcher (no banner, by request).
    - "View the app as": Dungeon Master, or any hero.
    - Previewing a hero sets `body[data-role=player]` and locks Status to that hero.
    - While previewing, the badge turns dark and reads "Viewing as …". Every
    player-only filtering added later (fog of war, secrets) must follow the previewed hero, so
    the DM sees exactly what that player sees.
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
    with a light weapon in the main hand too. Shields go in the off hand beside any one-handed
    weapon (+2 AC). Heavy armour ignores Dex.
  - The Gear tab has a dropdown per slot. Players can change only their own hero; the DM can
    change anyone's.
  - Changes are saved to the database and reach other devices live.
  - Figures are dressed from gear (`dress` in model.js):
    - Armour recolours the torso and shoulders.
    - Held weapons appear in the hand (bows in the left hand).
    - Swords not in hand hang at the left hip, with an empty scabbard when drawn.
    - Axes hang at the right hip, and bows go on the back next to the quiver.
- **Combat** (`src/combat/`, DM only; the tab is hidden unless `body[data-role=dm]`):
  - Setup: pick the heroes and the number of each enemy (max 6). Enemy types are in
    `src/data/monsters.js` (only the Hooknose cutthroat for now; its figure is
    `buildMonsterFigure` in model.js).
  - Battle: a Pokémon-style 3D field (`battleScene.js`) with heroes on the left and enemies
    on the right, each on a pad.
  - Health boxes have −/+ buttons. Hero HP is saved to the character (players see it live),
    while enemy HP only lives in the encounter.
  - At 0 HP a fighter falls over.
  - Initiative step: type each d20 (or roll for enemies). Total = roll + Dex mod (monsters:
    `initiative`). Order: total, then bonus, then roll. Fighters at 0 HP are skipped.
  - Turn strip at the top, a gold marker over the active fighter, and a bottom bar with
    Attack / Next turn.
  - Attack calculator: pick the weapon (from derive().attacks, i.e. what is equipped) and the
    target, then type the d20. It reports Hit / Miss vs AC, with nat 20 = crit and nat 1 =
    miss.
  - Damage: type each die the weapon uses (doubled on a crit). Rogues get optional Sneak
    Attack d6s (`sneakAttackDice`), and the modifier is added automatically.
  - Players see the fight live, read-only (`src/combat/combatView.js`, screen `#fight`).
    - The DM's app broadcasts `publicState()` over the Supabase Realtime broadcast channel
      `encounter` (`encounterChannel` in backend.js). Nothing is stored.
    - Late joiners send `hello`, and the DM answers with the current state.
    - The public state has no rolls or stats. Enemy HP is included only if "Players can see
      enemy health" was ticked at setup.
    - Players get a Combat tab while a fight is on, and are switched to it when one starts.
    - The DM's "view as" preview is fed locally with the same state.
    - Caveat: broadcast isn't locked down, so any logged-in user could send fake state. That's
      fine among friends; use a table with RLS if needed.
  - The arena camera uses OrbitControls: one finger turns, two fingers pinch-zoom and pan. The
    view resets for each new encounter.
  - The health-box columns scroll when they don't fit, and the boxes are kept compact.
  - The encounter itself is not saved online yet, so a reload loses it.
- **Bestiary** (DM only, `src/bestiary/bestiaryScreen.js`) lists every enemy with its 3D figure
  and stat block. "Generate new" has Claude design one from a text prompt.
  - Server: `netlify/edge-functions/generate.js` at POST `/api/generate-monster`.
    - It checks the caller's Supabase token and that their profile is the DM, then calls the
      Claude API (`claude-sonnet-5-5`, streaming) with the system prompt that defines the JSON
      format.
    - The key is the Netlify environment variable `ANTHROPIC_API_KEY`.
    - It's an edge function so the long stream isn't cut off by the 10-second limit on normal
      functions.
  - The client (`generateMonster` in backend.js) reads the SSE stream, shows progress, and
    parses the JSON.
  - `cleanMonster` and `sanitizeRecipe` clamp everything Claude sends.
  - Figure recipe: palette plus parts, where each part has boxes, a pivot, a motion and glow
    colours. Built by `buildRecipeFigure` in model.js.
  - Saved in the Supabase table `monsters` (`supabase/monsters.sql`): everyone reads, the DM
    writes, with realtime.
  - At login, everyone loads the table into the MONSTERS registry (`addMonster`) and the recipe
    registry (`registerRecipe`), so players can see generated enemies in fights.
- **Character creator** (`src/creator/creatorScreen.js`, rules in `src/character/creator.js`):
  - Opened by players from the hero-pick step ("Create my own hero") and by the DM from Party
    ("New hero"). Four steps: Hero (name, race, class, level 1–2, alignment, background),
    Abilities (27-point buy plus race bonus, "Suggested" = standard array in the class order),
    Skills (class picks, 2 background picks plus race extras, Rogue expertise, fighting style),
    Look (Design and Backstory boxes).
  - 12 races and 12 classes with level 1–2 features, starting gear, HP, Unarmoured Defence and
    attack cantrips (`extraAttacks` in the sheet, used by derive()).
  - Claude designs the figure: POST `/api/generate-hero` in `netlify/edge-functions/generate.js`
    (same function and key as monsters). Allowed for the DM, or a player with no hero yet.
    Returns tagline, colour, goal and a recipe that follows the hero skeleton (parts named legs,
    body, head, armR, armL). `buildRecipeHero` in model.js adds held weapons, shields, hip
    swords and the quiver from the gear, so equipping still shows on the figure.
  - Saving uses the `create_character` RPC (`supabase/creator.sql`): a player's new hero is
    owned by them at once; the DM's hero is left free to claim.
  - The DM can delete a hero from the Story tab on Status.
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
3. DONE: accounts and online sync with Supabase. Next ideas for the DM: fog of war with
   revealed places, DM notes on places, secrets to reveal, handing out rewards/XP/HP,
   journal, quests, NPCs, monsters and initiative.
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
