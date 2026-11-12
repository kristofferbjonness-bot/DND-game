// The Status screen: the character sheet on the left, the 3D figure on the right.
// Arrows beside the figure switch between the party's characters.
import { ABILITIES, SKILLS, derive, signed } from '../character/rules.js';
import { createCharacterViewer } from './viewer.js';

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

function sheet(c, tab) {
  const d = derive(c);
  const hpPct = Math.round((c.hp.current / c.hp.max) * 100);

  const combat = `
    <h3 class="sheet__h">Attacks</h3>
    ${list(c.attacks.map((a) => {
      const r = d.attack(a);
      return item(esc(a.name), esc(a.note), `<span class="list__side"><b>${signed(r.toHit)}</b><small>${esc(r.damage)} ${esc(a.type)}</small></span>`);
    }))}
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

  const gear = `
    <h3 class="sheet__h">Equipped</h3>
    ${list(c.equipped.map((e) => item(esc(e.name), esc(e.note), `<span class="list__tag">${esc(e.slot)}</span>`)))}
    <h3 class="sheet__h">Inventory</h3>
    ${list(c.inventory.map((i) => item(esc(i.name), esc(i.note), `<span class="list__qty">×${i.qty ?? 1}</span>`)))}
    <div class="coins">
      ${['pp', 'gp', 'sp', 'cp'].map((k) => `<span class="coin coin--${k}"><i></i>${c.coins[k] ?? 0} <small>${k.toUpperCase()}</small></span>`).join('')}
    </div>`;

  const story = `
    <dl class="story">
      <dt>Origin</dt><dd>${esc(c.story.origin)}</dd>
      <dt>Goal</dt><dd>${esc(c.story.goal)}</dd>
      ${c.story.notes ? `<dt>Notes</dt><dd>${esc(c.story.notes)}</dd>` : ''}
      <dt>Background</dt><dd>${esc(c.background)} · ${esc(c.alignment)}</dd>
      <dt>Proficient with</dt><dd>${esc(c.proficiencies)}</dd>
      <dt>Languages</dt><dd>${esc(c.languages)}</dd>
    </dl>`;

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
      <div class="stat"><b>${c.ac}</b><span>AC</span></div>
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

export function createStatusScreen(root, characters) {
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
  let index = 0, tab = 'combat';

  function showCharacter(id) {
    index = Math.max(0, characters.findIndex((c) => c.id === id));
    const c = characters[index];
    sheetEl.innerHTML = sheet(c, tab);
    sheetEl.scrollTop = 0;
    pickerName.textContent = c.name;
    pickerLine.textContent = c.tagline ?? '';
    viewer.show(c.model);
  }

  sheetEl.addEventListener('click', (e) => {
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

  showCharacter(characters[0].id);
  return { start: () => viewer.start(), stop: () => viewer.stop(), showCharacter };
}
