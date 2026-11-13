// The Status screen: the character sheet on the left, the 3D figure on the right.
// Arrows beside the figure switch between the party's characters.
import { ABILITIES, SKILLS, derive, signed } from '../character/rules.js';
import { createCharacterViewer } from './viewer.js';
import { ITEMS } from '../data/items.js';
import { SLOTS, optionsFor, equip } from '../character/equipment.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const TABS = [
  { id: 'combat', label: 'Combat' },
  { id: 'skills', label: 'Skills' },
  { id: 'gear', label: 'Gear' },
  { id: 'story', label: 'Story' },
];

const list = (items) => `<ul class="list">${items.join('')}</ul>`;
const item = (main, sub, side = '') => `
  <li class="list__item">
    <div class="list__main"><span>${main}</span>${sub ? `<small>${sub}</small>` : ''}</div>
    ${side}
  </li>`;

function sheet(c, tab, editable, dm) {
  const d = derive(c);
  const hpPct = Math.round((c.hp.current / c.hp.max) * 100);

  const combat = `
    <h3 class="sheet__h">Attacks</h3>
    ${list(d.attacks.map((a) => item(esc(a.name), esc(a.note), `<span class="list__side"><b>${signed(a.toHit)}</b><small>${esc(a.damage)} ${esc(a.type)}</small></span>`)))}
    <h3 class="sheet__h">Features</h3>
    ${list(c.features.map((f) => item(esc(f.name), esc(f.text), f.uses
      ? `<span class="uses" title="Uses per ${esc(f.uses.per)}">${Array.from({ length: f.uses.max }, (_, i) => `<i class="${i < f.uses.max - f.uses.used ? 'is-on' : ''}"></i>`).join('')}</span>`
      : '')))}`;

  const skills = `
    <h3 class="sheet__h">Saving throws</h3>
    <div class="saves">
      ${ABILITIES.map((a) => `<span class="save${c.saves.includes(a.id) ? ' is-prof' : ''}">${a.short}<b>${signed(d.save(a.id))}</b></span>`).join('')}
    </div>
    <h3 class="sheet__h">Skills</h3>
    <ul class="skills">
      ${SKILLS.map((s) => {
        const prof = c.skills.includes(s.id), expert = c.expertise?.includes(s.id);
        return `<li class="skill${prof ? ' is-prof' : ''}${expert ? ' is-expert' : ''}"><span>${s.name}</span><b>${signed(d.skill(s.id))}</b></li>`;
      }).join('')}
    </ul>
    <p class="sheet__note">Passive Perception <b>${d.passivePerception}</b> · Hit dice <b>${c.hitDice.total - c.hitDice.used}${esc(c.hitDice.die)}</b></p>`;

  const equippedIds = new Set(Object.values(c.equipped));
  const describe = (it) => it.kind === 'armour'
    ? `${it.category} armour · AC ${it.ac}${it.category === 'Heavy' ? '' : it.dexCap === null ? ' + Dex' : ` + Dex (max ${it.dexCap})`}`
    : it.kind === 'weapon' ? `${it.dice} ${it.type}${it.props.length ? ` · ${it.props.join(', ')}` : ''}`
    : it.kind === 'shield' ? `+${it.ac} AC` : '';
  const gear = `
    <h3 class="sheet__h">Equipped</h3>
    <div class="slots">
      ${SLOTS.map((slot) => {
        const { ids, reason } = optionsFor(c, slot.id);
        const current = c.equipped[slot.id];
        return `
        <label class="slot">
          <span class="slot__label">${slot.label}</span>
          <select class="slot__select" data-slot="${slot.id}"${!editable || (!ids.length && !current) ? ' disabled' : ''}>
            <option value="">${reason && !current ? esc(reason) : 'Nothing'}</option>
            ${ids.map((id) => `<option value="${id}"${id === current ? ' selected' : ''}>${esc(ITEMS[id].name)}</option>`).join('')}
          </select>
        </label>`;
      }).join('')}
    </div>
    <h3 class="sheet__h">Inventory</h3>
    ${list(c.items.map((i) => {
      const it = ITEMS[i.id];
      const note = [describe(it), i.note ?? it.note].filter(Boolean).join(' · ');
      const side = equippedIds.has(i.id) ? '<span class="list__tag list__tag--on">Equipped</span>' : `<span class="list__qty">×${i.qty ?? 1}</span>`;
      return item(esc(it.name), esc(note), side);
    }))}
    <div class="coins">
      ${['pp', 'gp', 'sp', 'cp'].map((k) => `<span class="coin coin--${k}"><i></i>${c.coins[k] ?? 0} <small>${k.toUpperCase()}</small></span>`).join('')}
    </div>`;

  const story = `
    <dl class="story">
      ${c.story.origin ? `<dt>${c.figure ? 'Backstory' : 'Origin'}</dt><dd>${esc(c.story.origin)}</dd>` : ''}
      ${c.story.goal ? `<dt>Goal</dt><dd>${esc(c.story.goal)}</dd>` : ''}
      ${c.story.notes ? `<dt>Notes</dt><dd>${esc(c.story.notes)}</dd>` : ''}
      ${c.story.design ? `<dt>Look</dt><dd>${esc(c.story.design)}</dd>` : ''}
      <dt>Background</dt><dd>${esc(c.background)} · ${esc(c.alignment)}</dd>
      <dt>Proficient with</dt><dd>${esc(c.proficiencies)}</dd>
      <dt>Languages</dt><dd>${esc(c.languages)}</dd>
    </dl>
    ${dm ? '<button type="button" class="sheet__delete">Delete this hero</button>' : ''}`;

  const panels = { combat, skills, gear, story };

  return `
    <header class="sheet__head">
      <p class="sheet__kicker">Level ${c.level} ${esc(c.class)} · ${esc(c.race)}</p>
      <h2 class="sheet__name">${esc(c.name)}</h2>
      <div class="xp" title="${c.xp} XP${d.xp.next ? ` of ${d.xp.next} for level ${c.level + 1}` : ''}">
        <div class="xp__bar"><span style="width:${Math.round(d.xp.progress * 100)}%"></span></div>
        <small>${c.xp}${d.xp.next ? ` / ${d.xp.next}` : ''} XP</small>
      </div>
    </header>

    <div class="vitals">
      <div class="hp-block">
        <div class="hp-block__top"><span>Hit points</span><b>${c.hp.current}<small> / ${c.hp.max}</small></b></div>
        <div class="hp"><span style="width:${hpPct}%"></span></div>
      </div>
      <div class="stat"><b>${d.ac}</b><span>AC</span></div>
      <div class="stat"><b>${signed(d.initiative)}</b><span>Init</span></div>
      <div class="stat"><b>${c.speed}</b><span>Speed</span></div>
      <div class="stat"><b>${signed(d.prof)}</b><span>Prof</span></div>
    </div>

    <div class="abilities">
      ${ABILITIES.map((a) => `
        <div class="ability"><span>${a.short}</span><b>${signed(d.mod(a.id))}</b><small>${c.abilities[a.id]}</small></div>`).join('')}
    </div>

    <nav class="tabs" role="tablist">
      ${TABS.map((t) => `<button type="button" role="tab" class="tab${t.id === tab ? ' is-active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
    </nav>
    ${TABS.map((t) => `<section class="tabpanel" data-panel="${t.id}"${t.id === tab ? '' : ' hidden'}>${panels[t.id]}</section>`).join('')}`;
}

// `onChange(character)` is called after the gear changes, to save it.
// `onDelete(character)` lets the Dungeon Master delete a hero.
export function createStatusScreen(root, characters, { onChange, onDelete } = {}) {
  root.innerHTML = `
    <div class="status__sheet"></div>
    <div class="status__stage">
      <div class="status__canvas"></div>
      <div class="picker">
        <button type="button" class="picker__arrow" data-step="-1" aria-label="Previous character">‹</button>
        <div class="picker__name"><b></b><small></small></div>
        <button type="button" class="picker__arrow" data-step="1" aria-label="Next character">›</button>
      </div>
    </div>`;
  const sheetEl = root.querySelector('.status__sheet');
  const pickerName = root.querySelector('.picker__name b');
  const pickerLine = root.querySelector('.picker__name small');
  const viewer = createCharacterViewer(root.querySelector('.status__canvas'));
  let index = 0, tab = 'combat', player = null, dm = false;

  // Players may change their own hero's gear; the Dungeon Master may change anyone's.
  const editable = (c) => !player || player === c.id;

  function render({ keepScroll = false } = {}) {
    const c = characters[index];
    const scroll = sheetEl.scrollTop;
    sheetEl.innerHTML = sheet(c, tab, editable(c), dm && !player);
    sheetEl.scrollTop = keepScroll ? scroll : 0;
  }

  function showCharacter(id) {
    index = Math.max(0, characters.findIndex((c) => c.id === id));
    const c = characters[index];
    if (!c) return;
    render();
    pickerName.textContent = c.name;
    pickerName.dataset.id = c.id;
    pickerLine.textContent = c.tagline ?? '';
    viewer.show(c);
  }

  sheetEl.addEventListener('change', (e) => {
    const select = e.target.closest('.slot__select');
    if (!select) return;
    const c = characters[index];
    equip(c, select.dataset.slot, select.value);
    render({ keepScroll: true });
    viewer.show(c);
    onChange?.(c);
  });

  // Someone (maybe on another device) changed a character: redraw if it is showing.
  function refresh(id) {
    const shown = pickerName.dataset.id;
    if (!characters.some((x) => x.id === shown)) { // the hero on show was deleted
      const next = player ?? characters[0]?.id;
      if (next) showCharacter(next);
      return;
    }
    if (shown !== id) return;
    index = characters.findIndex((x) => x.id === id);
    render({ keepScroll: true });
    viewer.show(characters[index]);
  }

  sheetEl.addEventListener('click', (e) => {
    if (e.target.closest('.sheet__delete')) {
      const c = characters[index];
      if (confirm(`Delete ${c.name} for good? Their player will have to pick or make a new hero.`)) onDelete?.(c);
      return;
    }
    const btn = e.target.closest('.tab');
    if (!btn) return;
    tab = btn.dataset.tab;
    sheetEl.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === btn));
    sheetEl.querySelectorAll('.tabpanel').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
  });
  root.querySelector('.picker').addEventListener('click', (e) => {
    const btn = e.target.closest('.picker__arrow');
    if (!btn) return;
    const next = (index + Number(btn.dataset.step) + characters.length) % characters.length;
    showCharacter(characters[next].id);
  });

  // A player only sees their own hero here; the Dungeon Master can flip through everyone.
  function setPlayer(id) {
    player = id;
    root.classList.toggle('is-locked', Boolean(id));
    const show = id ?? characters[index]?.id ?? characters[0]?.id;
    if (show) showCharacter(show);
  }

  if (characters.length) showCharacter(characters[0].id);
  return {
    start: () => viewer.start(), stop: () => viewer.stop(), showCharacter, setPlayer, refresh,
    setDm(on) { dm = on; if (characters[index]) render({ keepScroll: true }); },
  };
}
