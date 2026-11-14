// What players see of an encounter: the same battlefield and turn order as the
// Dungeon Master, but no buttons or dice, and enemy health only if the DM
// chose to show it. Fed by `show(state)` with the public encounter state the DM
// broadcasts (see publicState in combatScreen.js).
import { createBattleScene } from './battleScene.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function createCombatView(root, { party }) {
  root.innerHTML = `
    <div class="combat__battle">
      <div class="combat__stage"></div>
      <ol class="turns"></ol>
      <div class="combat__boxes combat__boxes--enemies"></div>
      <div class="combat__boxes combat__boxes--heroes"></div>
      <div class="turnbar turnbar--view"><span class="turnbar__who"></span></div>
    </div>
    <div class="fight-wait" hidden><p>No fight right now.</p></div>`;
  const $ = (sel) => root.querySelector(sel);
  const scene = createBattleScene($('.combat__stage'));
  let state = null, cast = '', visible = false;

  function box(f) {
    const hasHp = f.hp != null;
    const pct = hasHp ? Math.max(0, Math.round((f.hp / f.max) * 100)) : 100;
    const tone = pct > 50 ? 'ok' : pct > 20 ? 'low' : 'crit';
    return `
      <div class="hpbox hpbox--view${f.down ? ' is-down' : ''}${f.now ? ' is-turn' : ''}">
        <div class="hpbox__top"><b>${esc(f.name)}</b>${f.down ? '<small>Down</small>' : ''}</div>
        <div class="hpbox__row">
          ${hasHp
            ? `<span class="hpbox__track"><span class="is-${tone}" style="width:${pct}%"></span></span><span class="hpbox__nums">${Math.max(0, f.hp)}/${f.max}</span>`
            : '<span class="hpbox__track hpbox__track--hidden"><span></span></span><span class="hpbox__nums">?</span>'}
        </div>
      </div>`;
  }

  function render() {
    const active = Boolean(state?.active);
    $('.combat__battle').hidden = !active;
    $('.fight-wait').hidden = active;
    root.classList.toggle('is-battle', active);
    if (!active) { scene.stop(); return; }

    // Rebuild the 3D figures only when the line-up changes.
    const lineup = JSON.stringify([state.area, state.heroes, state.fighters.filter((f) => f.side === 'enemy').map((f) => f.key)]);
    if (lineup !== cast) {
      cast = lineup;
      scene.setArena(state.area);
      const heroes = state.heroes.map((id) => party.find((c) => c.id === id)).filter(Boolean);
      const enemies = state.fighters.filter((f) => f.side === 'enemy').map((f) => ({ uid: f.key.split(':')[1], model: f.model }));
      scene.setFighters(heroes, enemies);
    }

    // Heroes' health comes from the party (always up to date); enemies' from the DM.
    const fighters = state.fighters.map((f, i) => {
      const hero = f.side === 'hero' && party.find((c) => c.id === f.key.split(':')[1]);
      return { ...f, now: i === state.turn, ...(hero ? { hp: hero.hp.current, max: hero.hp.max, down: hero.hp.current <= 0 } : {}) };
    });
    $('.combat__boxes--enemies').innerHTML = fighters.filter((f) => f.side === 'enemy').map(box).join('');
    $('.combat__boxes--heroes').innerHTML = fighters.filter((f) => f.side === 'hero').map(box).join('');
    $('.turns').innerHTML = `<li class="turns__round">Round ${state.round}</li>` + fighters.map((f) => `
      <li class="turns__chip${f.now ? ' is-now' : ''}${f.down ? ' is-down' : ''}" title="${esc(f.name)}">
        <i style="background:${esc(f.colour)}">${esc(f.chip)}</i>
      </li>`).join('');
    const now = fighters[state.turn];
    $('.turnbar__who').innerHTML = now ? `<b>${esc(now.name)}</b>'s turn` : '';
    for (const f of fighters) scene.setDown(f.key, f.down);
    scene.setActive(now?.key ?? null);
    if (visible) scene.start();
  }

  return {
    show(next) {
      const { hit, anim } = next ?? {};
      state = next;
      if (anim) scene.attack(anim); // before drawing, so a knocked-out fighter falls when hit
      render();
      if (hit && !anim) scene.hit(hit);
    },
    refresh() { if (state?.active) render(); },
    get active() { return Boolean(state?.active); },
    start() { visible = true; render(); },
    stop() { visible = false; scene.stop(); },
  };
}
