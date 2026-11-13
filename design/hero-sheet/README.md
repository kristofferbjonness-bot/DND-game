# Hero sheet redesign: parchment look

The owner wants the Status screen (the hero sheet) restyled to match `target-look-gemini.jpg`:
hand-painted, slightly cartoony aged parchment, warm and easy to read. No purple anywhere.

## Files here

- `target-look-gemini.jpg`: the look to aim for (painted mock from Gemini). Use it for mood and
  detail, not as an image in the app. Ignore its odd bits: the stray "Dungeon Master" panel in
  the bottom right and the loose wax seal under the hero card are generation mistakes.
- `layout-reference.png` and `layout-reference.dc.html`: the clean layout the painted mock was
  made from. Use these for structure, spacing and text sizes. The `.dc.html` is a design-tool
  file; read it as plain HTML with inline styles (ignore `<x-dc>`, `<helmet>` and the
  `{{accent}}` holes, which mean `#8A2E1F`).

## Painted assets (`public/art/ui/`, transparent WebP)

| File | Use |
| --- | --- |
| `parchment-panel.webp` | Background of every card. Use `border-image` (9-slice, about 40px slice, `fill`) so torn edges stay at the edges and the middle stretches. |
| `corner-ornament.webp` | Bronze corner on the big cards (hero card, Abilities, details tabs). Drawn as the top-right corner; flip with `transform: scale(-1,1)` / `scale(1,-1)` for the others. About 56–72px, `pointer-events: none`. |
| `wax-seal.webp` | Behind the level number next to the hero name. Put the number on top as real text. |
| `scroll-rod.webp` | The wooden rod ends of the top tab bar, which becomes a rolled scroll. Flip for the left side. |

All text, numbers and icons stay real HTML text (never baked into images) so they stay sharp
and readable on phones.

## Look and rules

- Colours: reuse the tokens in `src/style.css` (`--parchment`, `--parchment-edge`, `--ink`,
  `--ink-soft`, `--accent`). Bronze details about `#9A6B1F`. Text contrast at least 4.5:1.
- Fonts: keep the app's Cinzel (labels, headings) and Alegreya Sans (body, numbers).
- Background behind the cards is transparent, so the app's own backdrop shows through.
- Ability cards: name and score on top, big modifier in the middle, short hint under it, save at
  the bottom. Proficient saves get a ◆ and a light tinted footer.
- Inner boxes (ability cards, attack row, stat tiles) get a thin hand-inked brown border on a
  slightly lighter parchment, as in the painted mock.
- The owner asked for this look, so for the Status screen it replaces the old CLAUDE.md rule
  "one card, no boxes inside boxes".
- Keep the phone layouts in `style.css` working (portrait stacks the figure on top).
- The 3D figure, the arrows and the hero thumbnails stay as they are, only re-framed.

## Where to work

`src/status/statusScreen.js` builds the sheet; its styles are the `.sheet…` rules in
`src/style.css`. Party, Journal and other screens can follow later with the same assets, but
start with Status only. Test on the dev server; do not push to `main` unless the owner says
"deploy".
