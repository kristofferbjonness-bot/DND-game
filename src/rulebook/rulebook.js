// The little rulebook: a book button on the left edge of every screen that
// opens into a small book of D&D basics, with symbols and very few words.
// Two pages side by side on wide screens, one at a time on narrow ones.
// The "Your weapons" page shows the dice for the hero being looked at.
import { derive, signed } from '../character/rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// Simple drawings of the dice.
const SHAPES = {
  4: '<polygon points="20,3 37,34 3,34" />',
  6: '<rect x="5" y="5" width="30" height="30" rx="5" />',
  8: '<polygon points="20,2 37,20 20,38 3,20" />',
  10: '<polygon points="20,2 37,17 20,38 3,17" />',
  12: '<polygon points="20,2 37,14 31,36 9,36 3,14" />',
  20: '<polygon points="20,2 36,11 36,29 20,38 4,29 4,11" />',
};
export const die = (sides, label = sides) => `
  <svg class="die-icon die-icon--d${sides}" viewBox="0 0 40 40" aria-label="d${sides}">
    ${SHAPES[sides] ?? SHAPES[20]}
    <text x="20" y="${sides === 4 ? 29 : 25}" text-anchor="middle">${label}</text>
  </svg>`;
const sidesOf = (dice) => Number(/d(\d+)/.exec(dice ?? '')?.[1]) || 20;

const row = (icon, main, sub = '') => `<li><span class="rb-ic">${icon}</span><span><b>${main}</b>${sub ? `<small>${sub}</small>` : ''}</span></li>`;

const PAGES = [
  {
    title: 'Rolling', icon: '🎲',
    body: () => `
      <div class="rb-formula">${die(20)}<i>+</i><span class="rb-chip">bonus</span><i>≥</i><span class="rb-chip rb-chip--goal">target</span></div>
      <p class="rb-center">Equal or higher = <b>success</b> ✔</p>
      <ul class="rb-list">
        ${row(`${die(20, 20)}`, 'Natural 20', 'Attack always hits, double damage dice')}
        ${row(`${die(20, 1)}`, 'Natural 1', 'Attack always misses')}
        ${row('⬆️', 'Advantage', 'Roll two d20, keep the <b>higher</b>')}
        ${row('⬇️', 'Disadvantage', 'Roll two d20, keep the <b>lower</b>')}
      </ul>`,
  },
  {
    title: 'The dice', icon: '🎯',
    body: () => `
      <ul class="rb-dice">
        <li>${die(4)}<span><b>d4</b><small>Dagger · Healing potion (2d4)</small></span></li>
        <li>${die(6)}<span><b>d6</b><small>Shortsword · Hand axe · Sneak Attack</small></span></li>
        <li>${die(8)}<span><b>d8</b><small>Longsword · Rapier · Longbow</small></span></li>
        <li>${die(10)}<span><b>d10</b><small>Versatile two-handed · Fire Bolt · Eldritch Blast</small></span></li>
        <li>${die(12)}<span><b>d12</b><small>Greataxe</small></span></li>
        <li>${die(20)}<span><b>d20</b><small>Every attack, check and save</small></span></li>
      </ul>
      <p class="rb-note"><b>2d6</b> = roll two d6 and add them up.</p>`,
  },
  {
    title: 'Attacking', icon: '⚔️',
    body: () => `
      <ol class="rb-steps">
        <li><span class="rb-num">1</span><div class="rb-formula rb-formula--small">${die(20)}<i>+</i><span class="rb-chip">to hit</span><i>≥</i><span class="rb-chip rb-chip--goal">🛡️ AC</span></div></li>
        <li><span class="rb-num">2</span><div class="rb-formula rb-formula--small"><span class="rb-chip">✔ hit</span><i>→</i>${die(8, '?')}<i>+</i><span class="rb-chip">bonus</span><i>=</i><span class="rb-chip">💥 damage</span></div></li>
      </ol>
      <ul class="rb-list">
        ${row('🗡️', 'Melee', 'Uses <b>STR</b>')}
        ${row('🏹', 'Ranged · Finesse', 'Uses <b>DEX</b> (finesse: STR or DEX)')}
        ${row('✨', 'Spells', 'Uses your magic stat (INT, WIS or CHA)')}
        ${row('💥', 'Critical hit', 'Roll the damage dice twice')}
      </ul>`,
  },
  {
    title: 'Your weapons', icon: '🗡️', hero: true,
    body: (hero) => {
      if (!hero) return '<p class="rb-center rb-muted">Open a hero on Status to see their dice here.</p>';
      const d = derive(hero);
      return `
        <p class="rb-center"><b>${esc(hero.name)}</b></p>
        <ul class="rb-weapons">
          ${d.attacks.map((a) => `
            <li>
              <b class="rb-wname">${esc(a.name)}</b>
              <div class="rb-formula rb-formula--small">${die(20)}<i>${signed(a.toHit)}</i><span class="rb-arrow">✔ →</span>${a.dice ? die(sidesOf(a.dice), a.dice.split('d')[0] > 1 ? a.dice : `d${sidesOf(a.dice)}`) : ''}${a.bonus ? `<i>${signed(a.bonus)}</i>` : ''}</div>
              <small>${esc(a.type)}${a.note ? ` · ${esc(a.note)}` : ''}</small>
            </li>`).join('')}
        </ul>
        ${hero.class === 'Rogue' ? `<p class="rb-note">Sneak Attack: add ${die(6)} × ${Math.ceil(hero.level / 2)} once a turn.</p>` : ''}`;
    },
  },
  {
    title: 'The six stats', icon: '💪',
    body: () => `
      <ul class="rb-stats">
        ${row('💪', 'STR · Strength', 'Melee hits · lifting · climbing')}
        ${row('🏹', 'DEX · Dexterity', 'Aim · dodging (AC) · sneaking · going first')}
        ${row('❤️', 'CON · Constitution', 'Hit points · poison · not giving up')}
        ${row('📖', 'INT · Intelligence', 'Knowing things · clues · wizard magic')}
        ${row('👁️', 'WIS · Wisdom', 'Noticing · reading people · cleric and druid magic')}
        ${row('💬', 'CHA · Charisma', 'Talking · lying · bard, sorcerer and warlock magic')}
      </ul>
      <p class="rb-note">Use the <b>+number</b> under each stat, not the big score.</p>`,
  },
  {
    title: 'Checks & saves', icon: '🔍',
    body: () => `
      <div class="rb-formula">${die(20)}<i>+</i><span class="rb-chip">stat</span><i>+</i><span class="rb-chip">skill ★</span></div>
      <p class="rb-center">★ only if you are trained in that skill</p>
      <div class="rb-dc">
        <span><b>10</b>Easy</span><span><b>15</b>Medium</span><span><b>20</b>Hard</span><span><b>25</b>Very hard</span>
      </div>
      <ul class="rb-list">
        ${row('🔍', 'Check', 'You try something: climb, sneak, persuade, search')}
        ${row('🛡️', 'Saving throw', 'Something happens to you: a trap, poison, a spell')}
      </ul>`,
  },
  {
    title: 'Your turn', icon: '⏳',
    body: () => `
      <ul class="rb-list rb-list--big">
        ${row('👣', 'Move', 'Up to your speed (30 ft = 6 squares)')}
        ${row('⚔️', '1 Action', 'Attack · cast a spell · dash · dodge · help · hide')}
        ${row('⚡', '1 Bonus action', 'Only if something gives you one')}
        ${row('↩️', '1 Reaction', 'Once per round, even on others\' turns: hit a foe who runs past')}
      </ul>
      <p class="rb-note">${die(20)} Initiative = d20 + DEX. Highest goes first.</p>`,
  },
  {
    title: 'Health & rest', icon: '❤️',
    body: () => `
      <ul class="rb-list">
        ${row('💀', '0 HP: you fall', 'Each turn roll a death save')}
      </ul>
      <div class="rb-death">
        <span>${die(20, '10+')}<small>✔ success</small></span>
        <span>${die(20, '1–9')}<small>✖ failure</small></span>
        <span>${die(20, 20)}<small>up with 1 HP</small></span>
      </div>
      <p class="rb-center">✔✔✔ stable · ✖✖✖ dead</p>
      <ul class="rb-list">
        ${row('☕', 'Short rest · 1 hour', 'Spend hit dice to heal')}
        ${row('🌙', 'Long rest · 8 hours', 'Full HP and abilities back')}
      </ul>`,
  },
];

// `getHero()` gives the hero for the weapons page (or null).
export function createRulebook({ button, root, getHero }) {
  root.innerHTML = `
    <div class="rb-book" role="dialog" aria-label="Rulebook">
      <nav class="rb-tabs">${PAGES.map((p, i) => `<button type="button" data-page="${i}" title="${p.title}">${p.icon}</button>`).join('')}</nav>
      <button type="button" class="rb-close" aria-label="Close">×</button>
      <div class="rb-spread">
        <section class="rb-page rb-page--left"></section>
        <section class="rb-page rb-page--right"></section>
      </div>
      <button type="button" class="rb-turn rb-turn--prev" aria-label="Previous page">‹</button>
      <button type="button" class="rb-turn rb-turn--next" aria-label="Next page">›</button>
    </div>`;
  const left = root.querySelector('.rb-page--left'), right = root.querySelector('.rb-page--right');
  const wide = window.matchMedia('(min-width: 700px)');
  let page = 0;

  const draw = (el, i) => {
    const p = PAGES[i];
    el.innerHTML = p ? `<h3 class="rb-title"><span>${p.icon}</span>${p.title}</h3><div class="rb-body">${p.body(getHero())}</div><span class="rb-folio">${i + 1}</span>` : '';
  };
  function render() {
    const step = wide.matches ? 2 : 1;
    page = Math.max(0, Math.min(PAGES.length - 1, page - (page % step)));
    draw(left, page);
    draw(right, step === 2 ? page + 1 : -1);
    right.hidden = step === 1;
    root.querySelectorAll('.rb-tabs button').forEach((b, i) => b.classList.toggle('is-on', i === page || (step === 2 && i === page + 1)));
    root.querySelector('.rb-turn--prev').disabled = page === 0;
    root.querySelector('.rb-turn--next').disabled = page + step >= PAGES.length;
  }
  const turn = (dir) => { page += dir * (wide.matches ? 2 : 1); render(); };

  function open() { root.hidden = false; button.classList.add('is-open'); render(); }
  function close() { root.hidden = true; button.classList.remove('is-open'); }
  button.addEventListener('click', () => (root.hidden ? open() : close()));
  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest('.rb-close')) { close(); return; }
    const tab = e.target.closest('[data-page]');
    if (tab) { page = Number(tab.dataset.page); render(); }
    if (e.target.closest('.rb-turn--prev')) turn(-1);
    if (e.target.closest('.rb-turn--next')) turn(1);
  });
  document.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') turn(1);
    if (e.key === 'ArrowLeft') turn(-1);
  });
  // Swipe to turn the page on phones.
  let swipe = null;
  root.addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY }; });
  root.addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
  });
  wide.addEventListener('change', () => { if (!root.hidden) render(); });

  return { open, close, refresh() { if (!root.hidden) render(); } };
}
