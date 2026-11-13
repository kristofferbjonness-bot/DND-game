// The Bestiary (Dungeon Master only): every enemy, with its figure and stats,
// and a generator where Claude designs a new one from a description.
import { MONSTERS, addMonster, removeMonster } from '../data/monsters.js';
import { registerRecipe, sanitizeRecipe } from '../character/model.js';
import { signed } from '../character/rules.js';
import { createCharacterViewer } from '../status/viewer.js';
import { generateMonster, saveMonster, deleteMonster, explain } from '../net/backend.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
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

// `onAdded()` lets the rest of the app know the list changed.
export function createBestiaryScreen(root, { onChanged } = {}) {
  root.innerHTML = `
    <div class="bestiary__side">
      <div class="bestiary__list-view">
        <div class="bestiary__head">
          <h2>Bestiary</h2>
          <button type="button" class="bestiary__new">＋ Generate new</button>
        </div>
        <ul class="bestiary__list"></ul>
      </div>
      <form class="bestiary__gen" hidden>
        <div class="bestiary__head">
          <h2>New monster</h2>
          <button type="button" class="bestiary__cancel">Cancel</button>
        </div>
        <textarea class="bestiary__prompt" rows="4" maxlength="800" placeholder="Describe it, e.g. a horse-sized sand scorpion with a glowing blue stinger that hunts near Razz of Mataz"></textarea>
        <button type="submit" class="bestiary__go">Generate with Claude</button>
        <div class="bestiary__progress" hidden><span></span><small></small></div>
        <p class="bestiary__error" role="alert" hidden></p>
        <div class="bestiary__decide" hidden>
          <button type="button" class="bestiary__keep">Add to bestiary</button>
          <button type="submit" class="bestiary__again">Try again</button>
        </div>
      </form>
    </div>
    <div class="bestiary__detail">
      <div class="bestiary__stage"></div>
      <div class="bestiary__stats"></div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const listView = $('.bestiary__list-view'), gen = $('.bestiary__gen');
  const list = $('.bestiary__list'), stats = $('.bestiary__stats');
  const prompt = $('.bestiary__prompt'), go = $('.bestiary__go');
  const progress = $('.bestiary__progress'), errorEl = $('.bestiary__error'), decide = $('.bestiary__decide');
  const viewer = createCharacterViewer($('.bestiary__stage'));
  let selected = Object.keys(MONSTERS)[0];
  let draft = null; // a generated monster not yet saved
  let busy = false;

  function renderList() {
    if (!MONSTERS[selected]) selected = Object.keys(MONSTERS)[0];
    list.innerHTML = Object.entries(MONSTERS).map(([id, m]) => `
      <li><button type="button" class="beast${id === selected && !draft ? ' is-on' : ''}" data-id="${esc(id)}">
        <span class="pick__badge pick__badge--enemy">${esc(m.name[0])}</span>
        <span class="beast__who"><b>${esc(m.name)}</b><small>${esc(m.kind)} · AC ${m.ac} · ${m.hp} HP</small></span>
        ${m.generated ? '<span class="beast__tag">Claude</span>' : ''}
      </button></li>`).join('');
  }

  function renderStats(m, id) {
    if (!m) { stats.innerHTML = ''; return; }
    stats.innerHTML = `
      <div class="statblock">
        <div class="statblock__head">
          <div><h3>${esc(m.name)}</h3><p>${esc(m.kind)}</p></div>
          ${id && MONSTERS[id]?.generated ? `<button type="button" class="statblock__delete" data-id="${esc(id)}">Delete</button>` : ''}
        </div>
        <div class="statblock__nums">
          <span><b>${m.ac}</b>AC</span><span><b>${m.hp}</b>HP</span><span><b>${m.speed}</b>Speed</span><span><b>${signed(m.initiative ?? 0)}</b>Init</span>
        </div>
        <ul class="statblock__attacks">
          ${m.attacks.map((a) => `<li><b>${esc(a.name)}</b> <span>${signed(a.toHit)} to hit · ${esc(a.dice)}${a.bonus ? ` ${a.bonus > 0 ? '+' : '−'} ${Math.abs(a.bonus)}` : ''} ${esc(a.type)}</span></li>`).join('')}
        </ul>
        ${m.note ? `<p class="statblock__note">${esc(m.note)}</p>` : ''}
      </div>`;
  }

  function select(id) {
    selected = id;
    draft = null;
    renderList();
    renderStats(MONSTERS[id], id);
    viewer.show({ monster: MONSTERS[id]?.model ?? id });
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('.beast');
    if (b) select(b.dataset.id);
  });

  stats.addEventListener('click', async (e) => {
    const b = e.target.closest('.statblock__delete');
    if (!b || !confirm(`Delete ${MONSTERS[b.dataset.id]?.name} from the bestiary?`)) return;
    try {
      await deleteMonster(b.dataset.id);
      removeMonster(b.dataset.id);
      onChanged?.();
      select(Object.keys(MONSTERS)[0]);
    } catch (err) { alert(explain(err)); }
  });

  // --- Generator ---------------------------------------------------------------------------
  function openGenerator(open) {
    gen.hidden = !open;
    listView.hidden = open;
    errorEl.hidden = true;
    progress.hidden = true;
    decide.hidden = true;
    go.hidden = false;
    if (open) prompt.focus(); else if (draft) select(selected);
  }
  $('.bestiary__new').addEventListener('click', () => openGenerator(true));
  $('.bestiary__cancel').addEventListener('click', () => { draft = null; openGenerator(false); select(selected); });

  gen.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const text = prompt.value.trim();
    if (!text) { prompt.focus(); return; }
    busy = true;
    errorEl.hidden = true;
    decide.hidden = true;
    go.hidden = true;
    progress.hidden = false;
    prompt.disabled = true;
    const bar = progress.querySelector('span'), label = progress.querySelector('small');
    const expected = 7000; // roughly how many characters a monster takes
    const tick = (n) => {
      bar.style.width = `${Math.min(96, 4 + (n / expected) * 92)}%`;
      label.textContent = n ? 'Claude is sculpting your monster…' : 'Claude is thinking…';
    };
    tick(0);
    try {
      const raw = await generateMonster(text, tick);
      draft = cleanMonster(raw, text);
      registerRecipe('draft', draft.figure);
      viewer.show({ monster: 'draft' });
      renderStats(draft);
      renderList();
      decide.hidden = false;
    } catch (err) {
      errorEl.textContent = explain(err);
      errorEl.hidden = false;
      go.hidden = false;
    } finally {
      busy = false;
      progress.hidden = true;
      prompt.disabled = false;
    }
  });

  $('.bestiary__keep').addEventListener('click', async () => {
    if (!draft) return;
    const id = `gen-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)}-${Date.now().toString(36)}`;
    try {
      await saveMonster(id, draft);
      registerRecipe(id, draft.figure);
      addMonster(id, draft);
      onChanged?.();
      draft = null;
      prompt.value = '';
      openGenerator(false);
      select(id);
    } catch (err) {
      errorEl.textContent = explain(err);
      errorEl.hidden = false;
    }
  });

  return {
    start() { viewer.start(); if (!draft) select(selected); },
    stop() { viewer.stop(); },
    refresh() { renderList(); },
  };
}
