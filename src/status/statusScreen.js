// The Hero screen (Status): the hero's figure in a framed window on the left,
// with their name, health and experience; the sheet on the right: key numbers,
// the six abilities as cards, and tabs for Combat, Skills, Gear and Story.
// The Dungeon Master flips between heroes with the arrows or the portraits.
import { ABILITIES, SKILLS, derive, signed } from '../character/rules.js';
import { createCharacterViewer } from './viewer.js';
import { ITEMS } from '../data/items.js';
import { SLOTS, optionsFor, equip } from '../character/equipment.js';
import { itemInfo } from '../character/progress.js';
import { icon } from '../ui/icons.js';
import { heroPortrait, portraitImg } from '../ui/portraits.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const TABS = [
  { id: 'combat', label: 'Combat', icon: 'combat' },
  { id: 'skills', label: 'Skills', icon: 'prof' },
  { id: 'gear', label: 'Gear', icon: 'bag' },
  { id: 'story', label: 'Story', icon: 'scroll' },
];

// What each ability is for, in a few words.
const USE = {
  str: 'Hit hard · lift · climb',
  dex: 'Aim · dodge · sneak',
  con: 'Health · stamina',
  int: 'Know · recall · study',
  wis: 'Notice · sense · heal',
  cha: 'Talk · charm · lead',
};

const SLOT_ICON = { mainHand: 'sword', offHand: 'ac', armour: 'armour' };
const ATTACK_ICON = { melee: 'sword', arrow: 'bow', thrown: 'dagger', magic: 'magic' };
const itemIcon = (it) => (it.kind === 'weapon' ? (it.props?.includes('ammunition') ? 'bow' : 'sword')
  : it.kind === 'armour' ? 'armour' : it.kind === 'shield' ? 'ac' : it.gem ? 'gem'
  : /potion|elixir|flask/i.test(it.name ?? '') ? 'potion' : 'bag');

const tile = (ic, label, value) => `<div class="tile">${icon(ic)}<b>${value}</b><span>${label}</span></div>`;

function sheet(c, tab, editable, dm) {
  const d = derive(c);

  const abilities = ABILITIES.map((a) => {
    const save = c.saves.includes(a.id);
    return `
      <div class="abil abil--${a.id}${save ? ' is-save' : ''}">
        <span class="abil__icon">${icon(a.id)}</span>
        <span class="abil__name"><span class="full">${a.name}</span><span class="short">${a.short}</span></span>
        <b class="abil__mod">${signed(d.mod(a.id))}</b>
        <span class="abil__score" title="Score">${c.abilities[a.id]}</span>
        <small class="abil__use">${USE[a.id]}</small>
        <span class="abil__save" title="${save ? 'Trained in this saving throw' : 'Saving throw'}">${save ? '◆' : '◇'} Save ${signed(d.save(a.id))}</span>
      </div>`;
  }).join('');

  const combat = `
    <h3 class="sheet__h">Attacks</h3>
    <ul class="atks">
      ${d.attacks.map((a) => `
        <li class="atk">
          <span class="atk__icon">${icon(ATTACK_ICON[a.throwFirst ? 'thrown' : a.style] ?? 'sword')}</span>
          <span class="atk__main"><b>${esc(a.name)}</b>${a.note ? `<small>${esc(a.note)}</small>` : ''}</span>
          <span class="atk__num"><small>To hit</small><b>${signed(a.toHit)}</b></span>
          <span class="atk__num atk__num--dmg"><small>${esc(a.type)}</small><b>${esc(a.damage)}</b></span>
        </li>`).join('')}
    </ul>
    <h3 class="sheet__h">Features</h3>
    <ul class="feats">
      ${c.features.map((f) => `
        <li class="feat">
          <span class="feat__main"><b>${esc(f.name)}</b><small>${esc(f.text)}</small></span>
          ${f.uses ? `<span class="uses" title="Uses per ${esc(f.uses.per)}">${Array.from({ length: f.uses.max }, (_, i) => `<i class="${i < f.uses.max - f.uses.used ? 'is-on' : ''}"></i>`).join('')}<small>per ${esc(f.uses.per)}</small></span>` : ''}
        </li>`).join('')}
    </ul>`;

  const skills = `
    <p class="sheet__hint"><b class="mark mark--on">◆</b> trained · <b class="mark mark--star">★</b> expert — add the number to your ${icon('dex', 'inline')} d20</p>
    <ul class="skills">
      ${SKILLS.map((s) => {
        const prof = c.skills.includes(s.id), expert = c.expertise?.includes(s.id);
        return `<li class="skill${prof ? ' is-prof' : ''}${expert ? ' is-expert' : ''}">
          <b class="mark">${expert ? '★' : prof ? '◆' : '·'}</b>
          <span>${s.name}<small>${s.ability.toUpperCase()}</small></span>
          <b class="skill__mod">${signed(d.skill(s.id))}</b></li>`;
      }).join('')}
    </ul>
    <div class="tiles tiles--small">
      ${tile('wis', 'Passive Perception', d.passivePerception)}
      ${tile('hp', 'Hit dice left', `${c.hitDice.total - c.hitDice.used}<small>${esc(c.hitDice.die)}</small>`)}
    </div>`;

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
          <span class="slot__icon">${icon(SLOT_ICON[slot.id] ?? 'bag')}</span>
          <span class="slot__label">${slot.label}</span>
          <select class="slot__select" data-slot="${slot.id}"${!editable || (!ids.length && !current) ? ' disabled' : ''}>
            <option value="">${reason && !current ? esc(reason) : 'Nothing'}</option>
            ${ids.map((id) => `<option value="${id}"${id === current ? ' selected' : ''}>${esc(ITEMS[id].name)}</option>`).join('')}
          </select>
        </label>`;
      }).join('')}
    </div>
    <h3 class="sheet__h">Pack</h3>
    <ul class="pack">
      ${c.items.map((i) => {
        const it = itemInfo(i);
        const note = [describe(it), i.note ?? it.note].filter(Boolean).join(' · ');
        return `<li class="pack__item${equippedIds.has(i.id) ? ' is-equipped' : ''}">
          <span class="pack__icon">${icon(itemIcon(it))}</span>
          <span class="pack__main"><b>${esc(it.name)}</b>${note ? `<small>${esc(note)}</small>` : ''}</span>
          ${equippedIds.has(i.id) ? '<span class="pack__tag">In hand</span>' : `<span class="pack__qty">×${i.qty ?? 1}</span>`}
        </li>`;
      }).join('')}
    </ul>
    <div class="coins">
      ${[['pp', 'Platinum'], ['gp', 'Gold'], ['sp', 'Silver'], ['cp', 'Copper']].map(([k, name]) => `<span class="coin coin--${k}" title="${name}">${icon('coin')}<b>${c.coins[k] ?? 0}</b><small>${k.toUpperCase()}</small></span>`).join('')}
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
    <div class="tiles">
      ${tile('ac', 'Armour', d.ac)}
      ${tile('init', 'Initiative', signed(d.initiative))}
      ${tile('speed', 'Speed', `${c.speed}<small>ft</small>`)}
      ${tile('prof', 'Proficiency', signed(d.prof))}
    </div>
    <h3 class="sheet__h">Abilities <small>roll ${icon('dex', 'inline')} d20 + the big number</small></h3>
    <div class="abils">${abilities}</div>
    <nav class="tabs" role="tablist">
      ${TABS.map((t) => `<button type="button" role="tab" class="tab${t.id === tab ? ' is-active' : ''}" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></button>`).join('')}
    </nav>
    ${TABS.map((t) => `<section class="tabpanel" data-panel="${t.id}"${t.id === tab ? '' : ' hidden'}>${panels[t.id]}</section>`).join('')}`;
}

// `onChange(character)` is called after the gear changes, to save it.
// `onDelete(character)` lets the Dungeon Master delete a hero.
export function createStatusScreen(root, characters, { onChange, onDelete } = {}) {
  root.innerHTML = `
    <section class="status__hero">
      <header class="status__plate"></header>
      <div class="status__stage">
        <div class="status__canvas"></div>
        <button type="button" class="picker__arrow picker__arrow--prev" data-step="-1" aria-label="Previous hero">‹</button>
        <button type="button" class="picker__arrow picker__arrow--next" data-step="1" aria-label="Next hero">›</button>
      </div>
      <div class="picker"></div>
      <div class="status__vitals"></div>
    </section>
    <section class="status__sheet"></section>`;
  const $ = (sel) => root.querySelector(sel);
  const sheetEl = $('.status__sheet'), plate = $('.status__plate'), vitals = $('.status__vitals'), picker = $('.picker');
  const viewer = createCharacterViewer($('.status__canvas'));
  let index = 0, tab = 'combat', player = null, dm = false, shownId = null;

  // Players may change their own hero's gear; the Dungeon Master may change anyone's.
  const editable = (c) => !player || player === c.id;

  function renderHero(c) {
    const d = derive(c);
    const hp = Math.max(0, c.hp.current / c.hp.max);
    plate.innerHTML = `
      <span class="lvl" title="Level ${c.level}"><b>${c.level}</b></span>
      <div class="status__who">
        <h2 class="sheet__name">${esc(c.name)}</h2>
        <p class="sheet__kicker">Level ${c.level} ${esc(c.class)} · ${esc(c.race)}</p>
      </div>`;
    vitals.innerHTML = `
      <div class="hpbar${c.hp.current <= 0 ? ' is-down' : hp <= 0.3 ? ' is-low' : ''}" title="Hit points">
        <span class="hpbar__icon">${icon('hp')}</span>
        <span class="hpbar__track"><i style="width:${Math.round(hp * 100)}%"></i></span>
        <b class="hpbar__num">${c.hp.current}<small>/${c.hp.max}</small></b>
      </div>
      <div class="xpbar" title="${c.xp} XP${d.xp.next ? ` of ${d.xp.next} for level ${c.level + 1}` : ''}">
        <span class="xpbar__icon">${icon('xp')}</span>
        <span class="xpbar__track"><i style="width:${Math.round(d.xp.progress * 100)}%"></i></span>
        <small>${c.xp}${d.xp.next ? `/${d.xp.next}` : ''} XP</small>
      </div>
      ${c.tagline ? `<p class="status__tagline">${esc(c.tagline)}</p>` : ''}`;
    picker.innerHTML = player ? '' : characters.map((h) => `
      <button type="button" class="picker__chip${h.id === c.id ? ' is-on' : ''}" data-id="${esc(h.id)}" title="${esc(h.name)}" style="--hero:${esc(h.colour)}">
        ${portraitImg(heroPortrait(h), { name: h.name, colour: h.colour })}
      </button>`).join('');
  }

  function render({ keepScroll = false } = {}) {
    const c = characters[index];
    const scroll = sheetEl.scrollTop;
    renderHero(c);
    sheetEl.innerHTML = sheet(c, tab, editable(c), dm && !player);
    sheetEl.scrollTop = keepScroll ? scroll : 0;
  }

  function showCharacter(id) {
    index = Math.max(0, characters.findIndex((c) => c.id === id));
    const c = characters[index];
    if (!c) return;
    shownId = c.id;
    render();
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
    if (!characters.some((x) => x.id === shownId)) { // the hero on show was deleted
      const next = player ?? characters[0]?.id;
      if (next) showCharacter(next);
      return;
    }
    if (shownId !== id) { if (characters[index]) renderHero(characters[index]); return; } // portraits in the picker
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
  root.querySelector('.status__hero').addEventListener('click', (e) => {
    const chip = e.target.closest('.picker__chip');
    if (chip) { showCharacter(chip.dataset.id); return; }
    const btn = e.target.closest('.picker__arrow');
    if (!btn || player) return;
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
    current: () => shownId,
    setDm(on) { dm = on; if (characters[index]) render({ keepScroll: true }); },
  };
}
