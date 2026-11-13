// Netlify Edge Function: POST /api/generate-monster  { prompt }
//
// Generates an enemy (5e stats + a voxel figure recipe) with Claude, for the
// Dungeon Master's bestiary. The Claude API key lives only here, in the Netlify
// environment variable ANTHROPIC_API_KEY, never in the app.
//
// Only the Dungeon Master may call it: the request must carry the caller's
// Supabase login token, and their profile must have role 'dm'.
//
// Claude's answer is streamed straight back (server-sent events), so the app
// can show progress and the request is not cut off while Claude works.

const SUPABASE_URL = 'https://bmuktbeyfpwovcrqnvsk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uL3hyIjaIce4lsPpQx_bNg_N88CVXvN';
const MODEL = 'claude-sonnet-5-5';
const MAX_PROMPT = 800;

const SYSTEM = `You design enemies for a Dungeons & Dragons 5e campaign app. The app shows every creature as a small voxel figure in a soft, colourful, low-detail style (like the game "Erosion" or Link's Awakening remake toys): chunky readable silhouettes, few colours, no tiny noise. The party is around level 2, so unless the request says otherwise, make the creature a fair fight for 3 level-2 heroes (roughly CR 1/4 to 2) with stats that follow 5e rules.

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

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(500, { error: 'The Claude API key is not set up on Netlify yet (ANTHROPIC_API_KEY).' });

  // Who is asking? Only the Dungeon Master may generate.
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json(401, { error: 'Please log in again.' });
  const headers = { apikey: SUPABASE_KEY, authorization: auth };
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!userRes.ok) return json(401, { error: 'Please log in again.' });
  const user = await userRes.json();
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, { headers });
  const [profile] = profileRes.ok ? await profileRes.json() : [];
  if (profile?.role !== 'dm') return json(403, { error: 'Only the Dungeon Master can generate monsters.' });

  let prompt = '';
  try { prompt = String((await req.json()).prompt ?? '').trim(); } catch { /* handled below */ }
  if (!prompt) return json(400, { error: 'Describe the monster first.' });
  if (prompt.length > MAX_PROMPT) return json(400, { error: `Keep the description under ${MAX_PROMPT} characters.` });

  const claude = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 12000,
      stream: true,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Create this enemy: ${prompt}` }],
    }),
  });
  if (!claude.ok) {
    const detail = await claude.text();
    let message = `Claude answered ${claude.status}.`;
    try { message = JSON.parse(detail).error?.message ?? message; } catch { /* keep the status */ }
    return json(502, { error: message });
  }

  return new Response(claude.body, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  });
};

export const config = { path: '/api/generate-monster' };
