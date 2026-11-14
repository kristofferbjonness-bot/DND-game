// Turns what Claude designed for a person or creature (stats + a figure recipe) into something safe
// to keep: names cut short, numbers clamped, the figure checked (sanitizeRecipe).
import { sanitizeRecipe } from '../character/model.js';

const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);

// Turns Claude's answer into a safe monster ({ ...stats, figure }), or throws.
export function cleanMonster(raw, prompt) {
  const figure = sanitizeRecipe(raw?.figure);
  if (!figure) throw new Error('Claude did not build a figure. Try again.');
  const name = String(raw?.name ?? 'Nameless thing').slice(0, 40);
  const attacks = (Array.isArray(raw?.attacks) ? raw.attacks : []).slice(0, 3).map((a) => ({
    name: String(a?.name ?? 'Strike').slice(0, 30),
    toHit: num(a?.toHit, -2, 15, 3),
    dice: /^\d{1,2}d\d{1,2}$/.test(String(a?.dice ?? '')) ? String(a.dice) : '1d6',
    bonus: num(a?.bonus, -5, 15, 0),
    type: String(a?.type ?? 'bludgeoning').slice(0, 30),
  }));
  return {
    name,
    short: String(raw?.short || name).slice(0, 12),
    kind: String(raw?.kind ?? 'Monster').slice(0, 40),
    ac: num(raw?.ac, 5, 25, 12), hp: num(raw?.hp, 1, 500, 10),
    speed: num(raw?.speed, 0, 120, 30), initiative: num(raw?.initiative, -5, 10, 0),
    attacks: attacks.length ? attacks : [{ name: 'Strike', toHit: 3, dice: '1d6', bonus: 1, type: 'bludgeoning' }],
    note: String(raw?.note ?? '').slice(0, 400),
    prompt,
    figure,
  };
}
