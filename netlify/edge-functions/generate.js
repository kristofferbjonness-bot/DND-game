// Netlify Edge Function: Claude designs things for the game.
//
//   POST /api/generate-monster  { prompt }
//     An enemy (5e stats + a voxel figure recipe) for the Dungeon Master's bestiary.
//     Only the Dungeon Master may ask.
//   POST /api/generate-hero  { hero: { name, race, class, level, armour, weapons }, design, backstory }
//     The look of a new hero from the character creator (the stats are worked
//     out in the app). The Dungeon Master, or a player who has no hero yet.
//
// The Claude API key lives only here, in the Netlify environment variable
// ANTHROPIC_API_KEY, never in the app. Every request must carry the caller's
// Supabase login token.
//
// Claude's answer is streamed straight back (server-sent events), so the app
// can show progress and the request is not cut off while Claude works.

const SUPABASE_URL = 'https://bmuktbeyfpwovcrqnvsk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uL3hyIjaIce4lsPpQx_bNg_N88CVXvN';
const MODEL = 'claude-sonnet-5-5';
const MAX_PROMPT = 800;
const MAX_STORY = 2000;

const MONSTER_SYSTEM = `You design enemies for a Dungeons & Dragons 5e campaign app. The app shows every creature as a small voxel figure in a soft, colourful, low-detail style (like the game "Erosion" or Link's Awakening remake toys): chunky readable silhouettes, few colours, no tiny noise. The party is around level 2, so unless the request says otherwise, make the creature a fair fight for 3 level-2 heroes (roughly CR 1/4 to 2) with stats that follow 5e rules.

Answer with ONE JSON object and nothing else (no prose, no code fences), in exactly this shape:

{
  "name": "Full name",
  "short": "Short name, max 12 characters, used in small UI boxes",
  "kind": "Type · origin, e.g. 'Beast · Desert' or 'Undead'",
  "ac": 13, "hp": 22, "speed": 30,
  "initiative": 2,                       // its Dexterity modifier
  "attacks": [ { "name": "Bite", "toHit": 4, "dice": "1d8", "bonus": 2, "type": "piercing" } ],
  "note": "One or two sentences of flavour and how it fights.",
  "figure": {
    "palette": { "a": "#rrggbb", "b": "#rrggbb" },
    "parts": [
      { "name": "body", "pivot": [0, 4, 0], "motion": "breathe", "phase": 0,
        "boxes": [[x0, y0, z0, x1, y1, z1, "a"]], "glow": ["e"] }
    ]
  }
}

Rules for "attacks": 1 to 3 attacks. "dice" is exactly like "1d6" or "2d8" (no bonus inside), "bonus" is the flat damage bonus (can be 0), "toHit" the attack bonus.

Rules for "figure":
- Units are voxels (1 voxel = 1 cube). The creature stands on the ground at y = 0 and FACES +z (its face/front points towards +z). x is left/right.
- Every box is an inclusive range [x0, y0, z0, x1, y1, z1, paletteKey]; a box [0,0,0, 2,1,0, "a"] fills 3×2×1 voxels.
- Keep it within x and z from -10 to 10, y from 0 to 40. For scale: a human hero is about 24 voxels tall and 5 wide; a goblin about 14 tall; a wolf about 11 tall and 13 long. Big monsters may be up to 35 tall.
- Use 4–8 palette colours with soft, pleasant, slightly desaturated tones and one or two accent colours. Palette keys are short strings.
- Eyes, runes, fire, magic and similar may glow: list those palette keys in that part's "glow".
- Build from solid boxes; use 30–200 boxes in total. Make the figure solid (no floating pieces, no gaps between parts).
- Split it into 2–10 parts that move: e.g. body, head, each arm or claw, legs, tail, wings. Each part has a "pivot" (the joint it moves around, e.g. a shoulder or the neck) and a "motion":
  "none" | "breathe" (small rise and fall, for bodies) | "bob" (bounce) | "sway" (slow turn left-right, for heads) | "swing" (rock forwards-back around the pivot, for arms, legs, claws) | "wag" (fast left-right, for tails) | "flap" (for wings) | "nod" | "spin" | "hover" (floating up and down, for flying or ghostly things).
  Use "phase" (0 to 6.28) to offset matching limbs so they don't move in sync.
- The silhouette must read clearly from a three-quarter view: exaggerate the defining features (horns, claws, a big mouth, a hunched back) and keep surfaces simple.

Example (a giant sand scorpion, shortened): parts body (pivot [0,2,0], breathe) with a 7×3×7 shell and glowing eyes at the front (+z), legs (none) as small boxes on both sides, a left and right claw (pivot at the shoulder, swing, different phase) reaching forward in +z, and a tail (pivot [0,4,-3], sway) curling up and over the back with a glowing stinger.`;

const HERO_SYSTEM = `You design the look of player heroes for a Dungeons & Dragons companion app. Every hero is shown as a small voxel figure in the style of the game "Erosion": tall, slender, low-detail toy-like figures with NO faces (no eyes, no mouth, the face is plain skin), soft pastel colours in warm light, simple clean surfaces and a strong readable silhouette made by hair, hats, hoods, capes, scarves, pauldrons and the like.

You get the hero's name, race, class, armour and weapons, the player's design notes and their backstory. Follow the design notes first. Then let the backstory colour the details: where they come from (climate, culture, a northern fur mantle, desert wraps, sea-worn colours), their trade, a keepsake, scars of their past, their mood (bright and bold, or dark and worn). Show the armour they wear in the outfit. Weapons and shields are added by the app from their equipment: NEVER draw weapons, shields, bows or quivers.

Answer with ONE JSON object and nothing else (no prose, no code fences):

{
  "tagline": "A short epithet, max 40 characters, e.g. 'Swordsman of Hrimnir'",
  "colour": "#rrggbb",          // the hero's signature colour, used for their badge
  "goal": "One sentence: what drives them, taken from the backstory ('' if it gives none)",
  "figure": {
    "palette": { "skin": "#rrggbb", "hair": "#rrggbb" },
    "parts": [
      { "name": "body", "pivot": [0, 11, 0], "motion": "breathe", "phase": 0, "boxes": [[x0, y0, z0, x1, y1, z1, "key"]], "glow": [] }
    ]
  }
}

The figure (units are voxels; every box is an inclusive range [x0,y0,z0, x1,y1,z1, paletteKey]; [0,0,0, 2,1,0,"a"] fills 3x2x1 voxels):
- It stands on the ground at y = 0 and FACES +z. x is left/right; the hero's RIGHT side is −x.
- Use this skeleton for a human-sized hero (about 24 voxels tall):
  - part "legs" (pivot [0,0,0], motion "none"): two legs, each 1 voxel wide at x = −1 and x = 1, z = 0, from the feet at y = 0 up to y = 10 (boots, wraps, trousers; feet may poke forward to z = 1). A robe or skirt may fill x −1..1 and z −1..1 lower down.
  - part "body" (pivot [0,11,0], motion "breathe"): the waist/belt at y = 11, the torso x −1..1, y 12..15, z −1..1, and shoulders y = 16, x −2..2, z −1..1. A cape or cloak hangs behind at z = −2 (x −1..1).
  - part "head" (pivot [0,17,0], motion "sway"): a 3x4x3 head x −1..1, y 17..20, z −1..1 in skin colour with hair covering the back (z = −1) and top; hair, hats, horns, hoods and ears go around and above it (up to y = 26).
  - part "armR" (pivot [−2,15,0], motion "none"): ONE voxel wide column at x = −2, z = 0, from y = 15 down to the hand at y = 10 (sleeve, cuff, then skin at the bottom voxel).
  - part "armL" (pivot [2,15,0], motion "none"): the same at x = 2.
  - The part names must be exactly "legs", "body", "head", "armR", "armL". You may add a few more parts (e.g. "cape" with pivot at the shoulders, motion "nod"; a tail with "wag"; small wings with "flap").
- Shorter races keep the same layout, scaled down: halflings and gnomes about 16 tall (legs to y 5, torso y 7..9, shoulders y 10, head y 11..13, arms from y 9 to the hand at y 6), dwarves about 18 tall and broad (legs to y 6, torso x −2..2, shoulders x −3..3 at y 12, arms at x = ±3 from y 11 to y 7, big beard). Dragonborn and half-orcs can be a bit bulkier; elves slimmer with long pointed ears; tieflings with horns and a tail.
- Keep it within x and z from −6 to 6, and y from 0 to 30, except a companion animal.
- Only if the backstory or design mentions a pet or animal companion, add it as one or two extra parts standing beside the hero at x 4..10 (e.g. a wolf about 11 tall and 9 long).
- 4–9 palette colours: soft, slightly desaturated, pleasing together, with one or two accents. Magic, runes or embers may glow: list those palette keys in the part's "glow".
- Build from solid boxes, 25–150 boxes in all. No floating pieces. Keep it simple and clean like Erosion: big shapes, not many tiny details.`;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  const hero = new URL(req.url).pathname.endsWith('/generate-hero');

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(500, { error: 'The Claude API key is not set up on Netlify yet (ANTHROPIC_API_KEY).' });

  // Who is asking? Monsters are for the Dungeon Master; heroes for the DM, or a
  // player who does not have a hero yet.
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json(401, { error: 'Please log in again.' });
  const headers = { apikey: SUPABASE_KEY, authorization: auth };
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!userRes.ok) return json(401, { error: 'Please log in again.' });
  const user = await userRes.json();
  const uid = encodeURIComponent(user.id);
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=role`, { headers });
  const [profile] = profileRes.ok ? await profileRes.json() : [];
  const dm = profile?.role === 'dm';
  if (!hero && !dm) return json(403, { error: 'Only the Dungeon Master can generate monsters.' });
  if (hero && !dm) {
    const mineRes = await fetch(`${SUPABASE_URL}/rest/v1/characters?owner=eq.${uid}&select=id`, { headers });
    const mine = mineRes.ok ? await mineRes.json() : [];
    if (mine.length) return json(403, { error: 'You already have a hero.' });
  }

  let body = {};
  try { body = await req.json(); } catch { /* handled below */ }
  let system, message;
  if (hero) {
    const h = body.hero ?? {};
    const text = (v, n) => String(v ?? '').trim().slice(0, n);
    const design = text(body.design, MAX_STORY), backstory = text(body.backstory, MAX_STORY);
    if (!design && !backstory) return json(400, { error: 'Describe the look or the backstory first.' });
    system = HERO_SYSTEM;
    message = [
      `Hero: ${text(h.name, 60)}, a level ${text(h.level, 2)} ${text(h.race, 30)} ${text(h.class, 30)}.`,
      `Armour: ${text(h.armour, 60) || 'none (just clothes)'}.`,
      `Weapons (the app draws these, do not): ${text(h.weapons, 200) || 'none'}.`,
      `Design notes from the player: ${design || '(none, go by the backstory)'}`,
      `Backstory: ${backstory || '(none)'}`,
    ].join('\n');
  } else {
    const prompt = String(body.prompt ?? '').trim();
    if (!prompt) return json(400, { error: 'Describe the monster first.' });
    if (prompt.length > MAX_PROMPT) return json(400, { error: `Keep the description under ${MAX_PROMPT} characters.` });
    system = MONSTER_SYSTEM;
    message = `Create this enemy: ${prompt}`;
  }

  const claude = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 12000,
      stream: true,
      system,
      messages: [{ role: 'user', content: message }],
    }),
  });
  if (!claude.ok) {
    const detail = await claude.text();
    let error = `Claude answered ${claude.status}.`;
    try { error = JSON.parse(detail).error?.message ?? error; } catch { /* keep the status */ }
    return json(502, { error });
  }

  return new Response(claude.body, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  });
};

export const config = { path: ['/api/generate-monster', '/api/generate-hero'] };
