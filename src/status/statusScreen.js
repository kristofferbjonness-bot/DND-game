// The Status screen: the character sheet on the left, the 3D figure on the right.
import { ABILITIES, SKILLS, derive, signed } from '../character/rules.js';
import { createCharacterViewer } from './viewer.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const TABS = [
  { id: 'combat', label: 'Combat' },
  { id: 'skills', label: 'Skills' },
  { id: 'gear', label: 'Gear' },
  { id: 'features', label: 'Features' },
  { id: 'story', label: 'Story' },
];

function sheet(c) {
  const d = derive(c);
  const hpPct = Math.round((c.hp.current / c.hp.max) * 100);
  const xpText = d.xp.next ? `${c.xp} / ${d.xp.next} XP` : `${c.xp} XP`;

  const abilities = ABILITIES.map((a) => `
    <div class="ability">
      <span class="ability__name">${a.short}</span>
      <span class="ability__mod">${signed(d.mod(a.id))}</span>
      <span class="ability__score">${c.abilities[a.id]}</span>
    </div>`).join('');

  const combat = `
    <h3 class="sheet__h">Attacks</h3>
    <ul class="rows">
      ${c.attacks.map((a) => { const r = d.attack(a); return `
        <li class="row">
          <div class="row__main"><b>${esc(a.name)}</b>${a.note ? `<small>${esc(a.note)}</small>` : ''}</div>
          <span class="chip" title="Attack bonus">${signed(r.toHit)}</span>
          <span class="row__dmg">${esc(r.damage)} <small>${esc(a.type)}</small></span>
        </li>`; }).join('')}
    </ul>
    <h3 class="sheet__h">Saving throws</h3>
    <div class="saves">
      ${ABILITIES.map((a) => `<span class="save${c.saves.includes(a.id) ? ' is-prof' : ''}"><i></i>${a.short} <b>${signed(d.save(a.id))}</b></span>`).join('')}
    </div>
    <div class="facts">
      <span>Hit dice <b>${c.hitDice.total - c.hitDice.used}${esc(c.hitDice.die)}</b></span>
      <span>Passive Perception <b>${d.passivePerception}</b></span>
    </div>`;

  const skills = `
    <ul class="skills">
      ${SKILLS.map((s) => { const p = c.skills.includes(s.id); return `
        <li class="skill${p ? ' is-prof' : ''}"><i></i><span>${s.name} <small>${s.ability.toUpperCase()}</small></span><b>${signed(d.skill(s.id))}</b></li>`; }).join('')}
    </ul>`;

  const gear = `
    <h3 class="sheet__h">Equipped</h3>
    <ul class="rows">
      ${c.equipped.map((e) => `
        <li class="row"><span class="row__slot">${esc(e.slot)}</span><div class="row__main"><b>${esc(e.name)}</b>${e.note ? `<small>${esc(e.note)}</small>` : ''}</div></li>`).join('')}
    </ul>
    <h3 class="sheet__h">Inventory</h3>
    <ul class="rows">
      ${c.inventory.map((i) => `
        <li class="row"><div class="row__main"><b>${esc(i.name)}</b>${i.note ? `<small>${esc(i.note)}</small>` : ''}</div><span class="row__qty">×${i.qty ?? 1}</span></li>`).join('')}
    </ul>
    <div class="coins">
      ${['pp', 'gp', 'sp', 'cp'].map((k) => `<span class="coin coin--${k}"><i></i><b>${c.coins[k] ?? 0}</b> ${k.toUpperCase()}</span>`).join('')}
    </div>`;

  const features = `
    <ul class="rows">
      ${c.features.map((f) => `
        <li class="row row--block">
          <div class="row__main"><b>${esc(f.name)}</b><small>${esc(f.text)}</small></div>
          ${f.uses ? `<span class="uses" title="Uses per ${esc(f.uses.per)}">${Array.from({ length: f.uses.max }, (_, i) => `<i class="${i < f.uses.max - f.uses.used ? 'is-on' : ''}"></i>`).join('')}<small>per ${esc(f.uses.per)}</small></span>` : ''}
        </li>`).join('')}
    </ul>
    <h3 class="sheet__h">Proficiencies &amp; languages</h3>
    <p class="sheet__p">${esc(c.proficiencies)}<br />${esc(c.languages)}</p>`;

  const story = `
    <dl class="story">
      <dt>Background</dt><dd>${esc(c.background)}</dd>
      <dt>Alignment</dt><dd>${esc(c.alignment)}</dd>
      <dt>Origin</dt><dd>${esc(c.story.origin)}</dd>
      <dt>Goal</dt><dd>${esc(c.story.goal)}</dd>
    </dl>`;

  const panels = { combat, skills, gear, features, story };

  return `
    <header class="sheet__head">
      <p class="sheet__kicker">Level ${c.level} ${esc(c.class)} · ${esc(c.race)}</p>
      <h2 class="sheet__name">${esc(c.name)}</h2>
      <div class="xp"><div class="xp__bar"><span style="width:${Math.round(d.xp.progress * 100)}%"></span></div><small>${xpText}</small></div>
    </header>

    <div class="vitals">
      <div class="vital vital--hp">
        <span class="vital__label">Hit points</span>
        <div class="hp"><span style="width:${hpPct}%"></span></div>
        <span class="vital__value">${c.hp.current}<small> / ${c.hp.max}</small>${c.hp.temp ? `<small> +${c.hp.temp} temp</small>` : ''}</span>
      </div>
      <div class="vital vital--ac"><span class="vital__value">${c.ac}</span><span class="vital__label">Armour</span></div>
      <div class="vital"><span class="vital__value">${signed(d.initiative)}</span><span class="vital__label">Initiative</span></div>
      <div class="vital"><span class="vital__value">${c.speed}<small>ft</small></span><span class="vital__label">Speed</span></div>
      <div class="vital"><span class="vital__value">${signed(d.prof)}</span><span class="vital__label">Proficiency</span></div>
    </div>

    <div class="abilities">${abilities}</div>

    <nav class="tabs" role="tablist">
      ${TABS.map((t, i) => `<button type="button" role="tab" class="tab${i === 0 ? ' is-active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
    </nav>
    ${TABS.map((t, i) => `<section class="tabpanel" data-panel="${t.id}"${i === 0 ? '' : ' hidden'}>${panels[t.id]}</section>`).join('')}`;
}

export function createStatusScreen(root, character) {
  root.innerHTML = `
    <div class="status__sheet">${sheet(character)}</div>
    <div class="status__stage"><div class="status__canvas"></div><p class="status__hint">Drag to turn</p></div>`;

  root.querySelector('.tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === btn));
    root.querySelectorAll('.tabpanel').forEach((p) => { p.hidden = p.dataset.panel !== btn.dataset.tab; });
  });

  const viewer = createCharacterViewer(root.querySelector('.status__canvas'));
  viewer.show(character.model);
  return { start: () => viewer.start(), stop: () => viewer.stop() };
}
