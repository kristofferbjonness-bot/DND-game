# DND game

A companion app for the owner's homebrew D&D world, played with friends. It runs in the
browser and on iPhone (added to the home screen). The art style is soft voxel 3D with a playful,
colourful look, similar in vibe to Link's Awakening. The owner is not a programmer: explain
things in plain words, and work in small, testable steps.

The original assets (hand-drawn world map, location art, character art, lore document) are in
`~/Desktop/DND`, outside this repo. The source map was copied to `assets/source/world-map.png`.

## Privacy

- **The GitHub repo is PUBLIC.** Never commit DM secrets or the lore files: `DND Lore/` and `*.local.js` are
  in .gitignore. Secret lore belongs in the Journal (Supabase, hidden rows), not in the code.

## Run / build

- `npm run dev`: dev server with hot reload. "Open World Map.command" does the same with a double-click.
- `npm run build`: builds a single self-contained HTML file into `Play/`, as both `index.html`
  (for hosting) and `World Map.html` (opens with a double-click over file://).
- Hosting: Netlify builds and deploys automatically on every push to `main` (see `netlify.toml`).
  Live site: https://cool-jelly-22cdf9.netlify.app
- **Deploy only when the owner asks.** Every push to `main` uses one of a limited number of
  Netlify deploys. Commit locally while working, test on the dev server, and push only when
  the owner says "deploy".
  - To test on an iPhone, run the dev server with `--host`; the phone opens the Mac's IP on the
    same Wi-Fi.
  - The Claude generators (edge function) only run on the live site.
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
- **Attribute points** (the owner's rule: 1 point per level up, no back-dating): stored as
  `abilityPoints` on the sheet. Spent on the Hero screen's Abilities card with + / − and Save
  (`spendAbilityPoints` in progress.js), by the player for their own hero or by the DM. Max score 20;
  raising Con raises max HP by the modifier change × level. The DM's Manage panel can give or take a
  point. A dot on the Hero tab shows unspent points; players get a toast.
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
  - Attack animations (`attack()` in battleScene.js) play when the DM applies a hit or a miss,
    and players get the same animation through `anim` in the public state.
    - Styles:
      - `melee`: a dash, a lean and a white slash arc.
      - `arrow`: bows and crossbows.
      - `thrown`: a spinning blade. The "Thrown" tick box in the attack card is shown for
        thrown-capable weapons and is on by default for "Throwing …" items.
      - `magic`: a glowing orb with a trail, coloured by damage type (`MAGIC`).
    - Hero styles come from derive() (`style`, `canThrow`, `throwFirst`). Monster styles are
      guessed from the attack's name and type (`monsterStyle`).
    - A hit shakes the target and shows a burst (bigger on a crit); a miss makes it sidestep.
      Falling to 0 HP waits until the blow lands (`incoming` / `downAfter`).
    - Scene layers: holder (pad) > mover (dash/dodge) > body (facing, falling) > lean > figure.
  - The arena camera uses OrbitControls: one finger turns, two fingers pinch-zoom and pan. The
    view resets for each new encounter.
  - The health-box columns scroll when they don't fit, and the boxes are kept compact.
  - The running encounter is saved online:
    - Every publish, setup and initiative change calls `onSave` → `saveFightSoon` in main.js,
      a 0.6 s debounce writing to the Supabase table `encounters` (one row, DM only,
      `supabase/session.sql`).
    - On DM login `restoreFight()` loads it into `combatScreen.restore()` and re-broadcasts it.
    - End (or Back from initiative) deletes it.
- **Fight screens** use the same paper: setup and initiative are ledger sheets; over the battle, health boxes are
  note-small notes, the turn order a rolled-scroll strip, the bottom bar a wide sheet, the attack card a tall note.
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
- **Revealed places (fog of names)** in main.js:
  - World-map places the players haven't discovered show as "?" and are left out of their
    places list. The info card says "Unknown place". Unnamed dots and city maps aren't hidden.
  - The DM sees every name; hidden ones are dashed and italic. The place card has a
    "Reveal to players" / "Hide from players" button.
  - Stored in the Supabase table `revealed_places` (realtime). The first DM login, with the
    table empty, reveals razz, tine and bartedalen (`FIRST_KNOWN`).
  - "View as" a hero shows the player's version.
  - The lore text is still inside the app's code, so a curious player could find it.
- **Weather, time of day and the party on the map:**
  - `src/world/atmosphere.js` (one per map view) lights the scene from the shared sky state
    `{ weather, hour, running, setAt, speed }`:
    - The sun or moon moves across the sky, with key colours through the day (`KEYS`).
    - Each weather has its own mood (`MOODS`): grey sky, dimmer light, bigger and greyer clouds,
      rain or snow particles that follow the camera target, wind streaks, and lightning in storms.
    - Fog follows the camera distance, so zooming out stays clear.
    - While `running`, the hour is worked out from `setAt`, so every device agrees.
  - The weather button (`src/world/skyPanel.js`, top of the bottom-right HUD stack) shows the
    weather and time to everyone. The DM also gets weather, a time slider, "Time passes" with a
    speed, and the party controls.
  - The party (`src/world/partyMarker.js`) appears as the heroes' figures at 0.12 scale with a
    red tag. The DM moves them with "Move the party" (then taps the map, raycast onto the
    ground) or with "Move the party here" on a place card. Tapping the tag opens Party.
  - Stored in the Supabase table `world` (one row, `supabase/world.sql`) with realtime. A local
    change wins over incoming updates for 2.5 s, so sliders don't jump back.
- **Rulebook** (`src/rulebook/rulebook.js`): a little book tab on the left edge of every screen
  (bottom-left above the tab bar on upright phones).
  - It opens a book of 8 short, symbol-first pages: Rolling, The dice, Attacking, Your
    weapons, The six stats, Checks & saves, Your turn, Health & rest.
  - Wide screens show two pages side by side; phones show one. Turn pages with the tabs, the
    arrows, swiping or the arrow keys.
  - "Your weapons" shows the d20 bonus and damage dice from derive() for the player's hero, or
    for the DM the hero last shown on Status (`statusScreen.current()`).
  - The dice are small inline SVGs (`die()`).
- **Dice tray** (`src/dice/diceTray.js`): a d20 tab under the rulebook tab (taken off the bar at the owner's request), showing the latest total.
  - Tap dice to build a pool, set a bonus, and choose advantage or disadvantage (single d20
    only). "Quick rolls" offers initiative and each attack's to-hit and damage for the
    player's hero, or the previewed hero for the DM.
  - Rolls use `crypto.getRandomValues`, with no bias.
  - Every roll goes into the Supabase table `rolls` (session.sql) and shows in a shared live
    log; nat 20/1 are highlighted.
  - The DM can make hidden rolls (RLS lets only the DM read them) and clear the log.
  - Others' rolls pop up next to the tab while the tray is closed (`rollPop`).
  - Roll values come from the roller's own app, so trust among friends is assumed.
- **Journal** (`src/journal/journalScreen.js`, a tab for everyone): one sheet of ledger paper with three
  bookmarks (Quests, People, Places), a search box across all three, the list on the left and the open
  entry on the right (on phones they take turns, with ‹ Back).
  - Everything is stored in the Supabase table `quests` (session.sql), told apart by `data.kind`:
    quests (no kind) `{ title, body, status, place, steps, shown }`; `npc` `{ title, role, place,
    attitude, status (alive/dead/missing), body, shown }`; `place` (places the DM adds, e.g. a tavern)
    `{ title, place (where it is), body, shown }`; `placenote` (the DM's notes on a map place) `{ place, body, shown }`.
    No new SQL was needed.
  - Places = the world-map places this viewer knows (with their lore from locations.js) plus the DM's
    places. A place page lists the people met there, places inside it and its quests; people link to
    where they were met. Map place cards have "Read about it in the journal" (`openPlace`).
  - Items (fourth bookmark): `item` rows `{ title, type (book/note/letter/map/object), holder (hero id or
    '' = the party), place (where found), body (its text), shown }`. Hidden = not given yet; "Give to the
    party" shows it, and players get a toast ("📖 You found: …"). The text reads like a book page
    (`.jr-read`). The owner's lore texts are in the private lore import, not in the code.
  - Creatures (fifth bookmark): `creature` rows `{ monster (Bestiary id), body (what the party learned),
    shown }`. Beginning a fight adds every enemy type, shown (`onBegin` in combatScreen →
    `journalScreen.meetCreatures`); the DM can show/hide any creature and write notes. Players see the
    portrait, name, kind and description from the Bestiary, plus the notes; no stats. "Open in the
    Bestiary" jumps to the DM's Beasts tab (`bestiaryScreen.show`).
  - DM secrets: `secret` rows `{ about: entry id or 'map:<place id>', body, shown: false }`, shown in a
    dashed red "DM only" box and edited in every form. Never shown, so RLS never sends them to players.
  - People are grouped by the town they belong to (`townOf`: a map place, or the town a smaller place is
    in), with an A–Z option; Places list each town with its smaller places under it.
  - The owner's lore (`DND Lore/`: DND world.docx, the slides and the campaign summary) was turned into
    `src/data/lore-import.local.js` (people, places, town notes and secrets). It is NOT in git and is only
    loaded on the dev server (`import.meta.env.DEV` + `import.meta.glob`), so DM secrets never reach the
    public repo or the built app. The DM presses "Update from lore (N)" in the Journal (dev server):
    it adds what is missing (hidden), and updates or removes entries the lore file changed, but only
    if they still match the old text (`was` / `removed` in the lore file), so edits made in the app
    are never overwritten. When the owner updates DND world.docx: re-extract it (textutil), diff, and
    edit lore-import.local.js with `was` for changed entries and `removed` for deleted ones.
  - Players see entries with `shown` (RLS) and only discovered map places. The DM writes, edits, ticks
    steps, completes, hides and deletes. Players get a toast for new entries.
  - Places of active visible quests get a 📜 on their map label (`questFor`, quests only).
  - Caveat: when the DM hides a shown entry, players keep seeing it until they reload (RLS stops the
    realtime update from reaching them).
- The SQL files (`world.sql`, `session.sql`) are safe to run again: `drop policy if exists`,
  and the publication changes are guarded.
- **Party** (`src/status/partyScreen.js`) shows a card per hero with HP, AC, initiative and
  passive perception. Tapping a card opens that hero on Status.
  - DM tools (hidden while previewing as a player):
    - A "Manage" button per hero opens `src/status/heroManager.js`, with heal, damage, temp HP,
      short and long rest, give XP, level up, give an item (from the catalogue, or "Something
      new…" as a custom gear row `{ id: 'custom-…', name, note }`), give or take coins, and take
      items away.
    - An "Everyone" row does party-wide short or long rests and XP.
    - The rules are in `src/character/progress.js`. Level up adds the average hit die + Con to
      max HP, one hit die, one attribute point (`abilityPoints`), and class features for the new level when `CLASSES` has them (only
      levels 1–2 so far). It does no ability score improvements or subclasses yet.
    - Every change is saved at once. Players get a toast for XP, levels, HP, items and coins
      (`tellPlayer` in main.js).
- **Look (redesign 2026-11-13): a medieval storybook, Lord of the Rings feel, fitting the voxel world.**
  NOT pixel art and NOT generic flat app icons (the owner rejected both).
  - Dark carved panels with a gold hairline and diamond corners (`--frame`, `--corners` in style.css),
    parchment for reading (quests, story, lore), gold buttons for the main action.
  - Fonts: Uncial Antiqua (titles), Cinzel (labels, numbers), Alegreya Sans (text).
  - Icons are little voxel objects (`src/ui/voxelIcons.js`: 12×12 grids built from bevelled cubes and
    photographed once); `icon(name)` in `src/ui/icons.js`, with flat SVGs as a no-3D fallback.
  - Portraits of heroes and monsters are small renders of their figures (`src/ui/portraits.js`,
    one shared offscreen renderer, cached by gear/look).
- **Paper sheets** (`public/art/ui/paper/*.webp`, the owner's painted blank paper, originals in
  `hero-sheet-design-pack/…/blank-paper-assets (1)/`): used as 9-slice `border-image`s. They are recoloured
  to the bar's light rolled-scroll colour by `node tools/tone-paper.mjs` (run it again if the originals change).
- **The bar** (`#bar` in index.html) is a the painted rolled scroll (`public/art/ui/paper/rolled-scroll.webp` as a 9-slice on `.bar::before`; ink text, a red pencil slash under the open tab; "DM" for the Dungeon Master). It holds the sky dial (time + weather, opens the sky card), the
  map/places menu (and ‹ back from cities), the screen tabs,
  the other heroes with HP (wide screens only) and "you" (portrait + HP, opens the view-as/log-out
  menu; `drawBar` in main.js). Top bar on wide screens; a two-row dock at the bottom on upright phones.
  The rulebook stays its own tab on the left edge.
- Map HUD: bottom right show-whole-map and compass; bottom left "?" help.

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
- Phones work both ways round. Held upright (`(orientation: portrait) and (max-width: 600px)`,
  at the end of style.css):
  - The tabs become a bar along the bottom (`--nav`), with the name badge top right.
  - Side-by-side screens stack: Status, Creator and Bestiary put the figure on top.
  - The battle camera looks from behind the heroes, so enemies are at the top. It resets when
    the phone turns (battleScene.js).
  - The world view's opening shot steps back to fit (`fitScale`).
  - Landscape phones use the `(max-height: 500px) and (orientation: landscape)` rules.
- Performance (an optimisation pass on 2026-11-13; measure with `tools/*.tmp.mjs`-style
  headless runs before changing these):
  - Voxels use `src/fx/bevelBox.js`, a 44-triangle bevelled box (`{ open: true }` drops the
    underside, used for terrain and trees).
  - Terrain (`terrain.js`):
    - Built in 32-cell chunks, so off-screen chunks are frustum-culled.
    - Each chunk has a rounded and a plain-box InstancedMesh sharing the same instance buffers
      (`twin`). Chunks beyond `LOD_DISTANCE` (80) use the plain boxes, since a bevel is under a
      pixel there.
    - The sea floor is flat tiles.
  - Trees switch to plain boxes when zoomed out (`plants.userData.lod`). Razz does the same,
    rounded under 110 units and plain beyond (`vox.render` returns the lod function).
  - Shadows come from whatever is shown. Note: three.js only draws shadow casters that the main
    camera's layers include, so shadow-only proxy layers do NOT work.
  - The towns are merged into one vertex-coloured mesh (`fx/mergeStatic.js`); only the windmill
    sails stay separate. The clouds are one InstancedMesh.
  - Results: about 2M → 0.5–0.7M triangles per frame, and 150–320 → 30–50 draw calls; the
    shadow pass is about 3.6M → 0.9M triangles.
  - Map loop: at most 60 fps while moving and 30 fps when idle (`lastActive`). The label
    overlap check and the `--label-scale` update (scoped to the labels layer) only run when the
    camera moved, so an idle map does no layout.
  - The shadow map only updates when needed: on view switch, every `view.shadowEvery` frames on
    the world view (4, or 8 on phones) because of the clouds, and when the sun moves.
  - 3D stages (viewer.js, battleScene.js) create their WebGL renderer on first `start()`, so
    startup makes 1 context instead of 6. They run at 30 fps when idle and 60 while dragging or
    during attack effects.
  - Rebuilt figures and finished attack effects are freed with `fx/dispose.js` (`disposeTree`).
    Shared geometry and materials carry `userData.shared` so they are never freed.
  - In dev, `window.__debug` exposes the renderer and the current view.

## Roadmap (agreed order)

1. Performance and app shell. Cheap voxels, on-demand shadows, terrain chunks with distance
   detail, merged towns, frame caps and lazy 3D stages are done.
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
