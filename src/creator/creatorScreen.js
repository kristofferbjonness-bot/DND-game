// The character creator: four short steps (hero, abilities, skills, look) on
// the left, the hero's figure and key numbers on the right. In the last step
// Claude designs the figure from the player's design notes and backstory.
import { ABILITIES, SKILLS, derive, modifier, signed } from '../character/rules.js';
import { RACES, CLASSES, STYLES, ALIGNMENTS, POINTS, COST, pointsSpent, suggestedScores, finalScores, buildCharacter } from '../character/creator.js';
import { sanitizeRecipe } from '../character/model.js';
import { ITEMS } from '../data/items.js';
import { createCharacterViewer } from '../status/viewer.js';
import { generateHero, createCharacter, explain } from '../net/backend.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const HEX = /^#[0-9a-f]{6}$/i;
const skillName = (id) => SKILLS.find((s) => s.id === id).name;

const BLURBS = {
  Barbarian: 'A fierce warrior who fights in a rage',
  Bard: 'A charming performer whose music is magic',
  Cleric: "A priest who heals and smites in a god's name",
  Druid: 'A keeper of nature who can take animal shape',
  Fighter: 'A trained soldier, master of arms and armour',
  Monk: 'A martial artist who fights with fists and ki',
  Paladin: 'A holy knight bound by an oath',
  Ranger: 'A hunter and tracker of the wild',
  Rogue: 'A sneaky expert who strikes from the shadows',
  Sorcerer: 'Magic runs in their blood',
  Warlock: 'Power from a pact with a mysterious patron',
  Wizard: 'A scholar of magic with a spellbook',
};
const STEPS = ['Hero', 'Abilities', 'Skills', 'Look'];

// `onCreated(character)` is called once the new hero is saved.
export function createCreatorScreen(root, { onCreated }) {
  root.innerHTML = `
    <div class="creator__card">
      <header class="creator__head">
        <h2>New hero</h2>
        <button type="button" class="creator__cancel">Cancel</button>
      </header>
      <nav class="creator__steps">${STEPS.map((s, i) => `<button type="button" data-step="${i}"><i>${i + 1}</i>${s}</button>`).join('')}</nav>
      <div class="creator__body"></div>
      <footer class="creator__foot">
        <button type="button" class="creator__back">‹ Back</button>
        <p class="creator__hint" role="alert"></p>
        <button type="button" class="creator__next">Next ›</button>
      </footer>
    </div>
    <div class="creator__preview">
      <div class="creator__stage"></div>
      <p class="creator__empty">Your hero appears here once Claude has made them.</p>
      <div class="creator__summary"></div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const body = $('.creator__body'), hint = $('.creator__hint'), next = $('.creator__next'), back = $('.creator__back');
  const viewer = createCharacterViewer($('.creator__stage'));

  let s, step, look, busy, touchedScores;
  function reset() {
    s = {
      name: '', race: 'human', cls: 'Fighter', level: 2, background: '', alignment: 'Neutral Good',
      base: suggestedScores('Fighter'), classSkills: [], anySkills: [], expertise: [], style: null, design: '', backstory: '',
    };
    step = 0; look = null; busy = false; touchedScores = false;
  }

  const cls = () => CLASSES[s.cls];
  const race = () => RACES[s.race];
  const raceSkills = () => race().skills ?? [];
  const anyCount = () => 2 + (race().anySkills ?? 0); // two from the background, plus the race's extra
  const styleNeeded = () => cls().style && s.level >= cls().style;
  const allSkills = () => [...new Set([...raceSkills(), ...s.classSkills, ...s.anySkills])];
  const draft = () => buildCharacter({ ...s, name: s.name.trim() || 'Your hero', skills: allSkills(), style: styleNeeded() ? s.style : null }, look ?? {});

  // Drop choices that no longer fit after the race or class changed.
  function tidy() {
    const from = cls().skills.from;
    s.classSkills = s.classSkills.filter((id) => (from === 'any' || from.includes(id)) && !raceSkills().includes(id)).slice(0, cls().skills.count);
    s.anySkills = s.anySkills.filter((id) => !raceSkills().includes(id) && !s.classSkills.includes(id)).slice(0, anyCount());
    s.expertise = cls().expertise ? s.expertise.filter((id) => allSkills().includes(id)) : [];
    if (!styleNeeded()) s.style = null;
  }

  // --- Steps -----------------------------------------------------------------------------------
  function heroStep() {
    return `
      <label class="field"><span>Name</span><input class="field__input" data-k="name" maxlength="40" value="${esc(s.name)}" placeholder="What are they called?" /></label>
      <div class="field-row">
        <label class="field"><span>Race</span><select class="field__input" data-k="race">
          ${Object.entries(RACES).map(([id, r]) => `<option value="${id}"${id === s.race ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}
        </select></label>
        <label class="field"><span>Class</span><select class="field__input" data-k="cls">
          ${Object.keys(CLASSES).map((id) => `<option${id === s.cls ? ' selected' : ''}>${id}</option>`).join('')}
        </select></label>
      </div>
      <p class="creator__note">${esc(BLURBS[s.cls])}. ${race().features.length ? `${esc(race().name)}: ${race().features.map((f) => esc(f.name)).join(', ')}.` : ''}</p>
      <div class="field-row">
        <div class="field"><span>Level</span>
          <div class="seg">${[1, 2].map((l) => `<button type="button" data-level="${l}"${l === s.level ? ' class="is-on"' : ''}>${l}</button>`).join('')}</div>
        </div>
        <label class="field"><span>Alignment</span><select class="field__input" data-k="alignment">
          ${ALIGNMENTS.map((a) => `<option${a === s.alignment ? ' selected' : ''}>${a}</option>`).join('')}
        </select></label>
      </div>
      <label class="field"><span>Background</span><input class="field__input" data-k="background" maxlength="40" value="${esc(s.background)}" placeholder="e.g. Sailor, Outlander, Noble, Acolyte" /></label>`;
  }

  function abilitiesStep() {
    const left = POINTS - pointsSpent(s.base);
    const final = finalScores(s.base, s.race);
    return `
      <div class="points">
        <p>Points left <b class="${left < 0 ? 'is-over' : ''}">${left}</b> <small>of ${POINTS}</small></p>
        <button type="button" class="chip-btn" data-action="suggest">Suggested for a ${s.cls}</button>
      </div>
      <ul class="scores">
        ${ABILITIES.map((a) => {
          const v = s.base[a.id], bonus = race().bonus[a.id] ?? 0;
          return `
          <li class="score">
            <span class="score__name"><b>${a.short}</b><small>${a.name}</small></span>
            <span class="stepper">
              <button type="button" data-score="${a.id}" data-d="-1"${v <= 8 ? ' disabled' : ''} aria-label="Lower ${a.name}">−</button>
              <b>${v}</b>
              <button type="button" data-score="${a.id}" data-d="1"${v >= 15 || COST[v + 1] - COST[v] > left ? ' disabled' : ''} aria-label="Raise ${a.name}">+</button>
            </span>
            <span class="score__bonus">${bonus ? `+${bonus}` : ''}</span>
            <span class="score__final"><b>${final[a.id]}</b><small>${signed(modifier(final[a.id]))}</small></span>
          </li>`;
        }).join('')}
      </ul>
      <p class="creator__note">Every score starts at 8; raising it costs points (14 and 15 cost 2 each). The ${esc(race().name)} bonus is added on the right.</p>`;
  }

  const chip = (id, on, attrs, locked = false) => `<button type="button" class="skill-chip${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}" ${attrs}${locked ? ' disabled' : ''}>${esc(skillName(id))}</button>`;
  function skillsStep() {
    const c = cls();
    const from = c.skills.from === 'any' ? SKILLS.map((k) => k.id) : c.skills.from;
    const taken = new Set([...raceSkills(), ...s.classSkills]);
    return `
      <h3 class="creator__h">${s.cls} skills <small>pick ${c.skills.count} · ${s.classSkills.length} chosen</small></h3>
      <div class="chips">${from.filter((id) => !raceSkills().includes(id)).map((id) => chip(id, s.classSkills.includes(id), `data-group="classSkills" data-id="${id}"`)).join('')}</div>
      <h3 class="creator__h">Background skills <small>pick ${anyCount()} · ${s.anySkills.length} chosen</small></h3>
      <div class="chips">${SKILLS.filter((k) => !taken.has(k.id)).map((k) => chip(k.id, s.anySkills.includes(k.id), `data-group="anySkills" data-id="${k.id}"`)).join('')}</div>
      ${raceSkills().length ? `<p class="creator__note">As a ${esc(race().name)} you also know ${raceSkills().map(skillName).join(', ')}.</p>` : ''}
      ${c.expertise ? `
        <h3 class="creator__h">Expertise <small>pick 2 of your skills to be extra good at</small></h3>
        <div class="chips">${allSkills().map((id) => chip(id, s.expertise.includes(id), `data-group="expertise" data-id="${id}"`)).join('')}</div>` : ''}
      ${styleNeeded() ? `
        <h3 class="creator__h">Fighting style</h3>
        <div class="styles">${Object.entries(STYLES).map(([id, st]) => `
          <button type="button" class="style-pick${s.style === id ? ' is-on' : ''}" data-style="${id}"><b>${st.name}</b><small>${esc(st.text)}</small></button>`).join('')}
        </div>` : ''}`;
  }

  function lookStep() {
    return `
      <label class="field"><span>Design</span><textarea class="field__input" data-k="design" rows="3" maxlength="2000" placeholder="How do they look? e.g. tall and lean, white braided hair, a blue hooded coat with silver buttons, a scarf in the wind">${esc(s.design)}</textarea></label>
      <label class="field"><span>Backstory</span><textarea class="field__input" data-k="backstory" rows="4" maxlength="2000" placeholder="Where do they come from, what happened to them, what do they want? This also shapes the look a little.">${esc(s.backstory)}</textarea></label>
      <div class="creator__progress" hidden><span></span><small></small></div>
      <div class="creator__actions">
        <button type="button" class="creator__go">${look ? 'Try again' : 'Make my hero with Claude'}</button>
      </div>`;
  }

  // --- Drawing ----------------------------------------------------------------------------------
  function problem() {
    if (step >= 0 && !s.name.trim()) return [0, 'Give your hero a name.'];
    if (step >= 1 && pointsSpent(s.base) > POINTS) return [1, 'Too many points spent.'];
    if (step >= 2) {
      if (s.classSkills.length !== cls().skills.count) return [2, `Pick ${cls().skills.count} ${s.cls} skills.`];
      if (s.anySkills.length !== anyCount()) return [2, `Pick ${anyCount()} background skills.`];
      if (cls().expertise && s.expertise.length !== 2) return [2, 'Pick 2 skills for Expertise.'];
      if (styleNeeded() && !s.style) return [2, 'Choose a fighting style.'];
    }
    if (step >= 3 && !look) return [3, 'Let Claude make your hero first.'];
    return null;
  }

  function render() {
    body.innerHTML = [heroStep, abilitiesStep, skillsStep, lookStep][step]();
    root.querySelectorAll('.creator__steps button').forEach((b, i) => {
      b.classList.toggle('is-on', i === step);
      b.classList.toggle('is-done', i < step);
    });
    back.hidden = step === 0;
    next.textContent = step === 3 ? 'Save hero' : 'Next ›';
    hint.textContent = '';
    summary();
  }

  function summary() {
    const c = draft(), d = derive(c);
    const gear = Object.values(c.equipped).filter(Boolean).map((id) => ITEMS[id].name);
    $('.creator__summary').innerHTML = `
      <b class="creator__name">${esc(c.name)}</b>
      <small>Level ${c.level} ${esc(c.race)} ${esc(c.class)}${look?.tagline ? ` · ${esc(look.tagline)}` : ''}</small>
      <div class="creator__nums">
        <span><b>${c.hp.max}</b>HP</span><span><b>${d.ac}</b>AC</span><span><b>${signed(d.initiative)}</b>Init</span><span><b>${c.speed}</b>Speed</span>
      </div>
      <small class="creator__gear">${esc(gear.join(' · '))}</small>`;
    $('.creator__empty').hidden = Boolean(look);
  }

  function showFigure() {
    viewer.show(look ? draft() : { monster: null });
  }

  // --- Input -------------------------------------------------------------------------------------
  body.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    s[k] = e.target.value;
    if (k === 'race' || k === 'cls') {
      if (k === 'cls' && !touchedScores) s.base = suggestedScores(s.cls);
      tidy();
      render();
      if (look) showFigure();
    } else if (k === 'name') summary();
  });

  body.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.level) { s.level = Number(t.dataset.level); tidy(); render(); if (look) showFigure(); }
    else if (t.dataset.action === 'suggest') { s.base = suggestedScores(s.cls); touchedScores = false; render(); }
    else if (t.dataset.score) {
      s.base[t.dataset.score] += Number(t.dataset.d);
      touchedScores = true;
      render();
    } else if (t.dataset.group) {
      const list = s[t.dataset.group], id = t.dataset.id;
      const max = t.dataset.group === 'classSkills' ? cls().skills.count : t.dataset.group === 'anySkills' ? anyCount() : 2;
      if (list.includes(id)) list.splice(list.indexOf(id), 1);
      else if (list.length < max) list.push(id);
      else { list.shift(); list.push(id); }
      tidy();
      render();
    } else if (t.dataset.style) { s.style = t.dataset.style; render(); }
    else if (t.classList.contains('creator__go')) makeLook();
  });

  async function makeLook() {
    if (busy) return;
    if (!s.design.trim() && !s.backstory.trim()) { hint.textContent = 'Write a little about the look or the backstory first.'; return; }
    busy = true;
    hint.textContent = '';
    const go = $('.creator__go'), progress = $('.creator__progress');
    const bar = progress.querySelector('span'), label = progress.querySelector('small');
    go.hidden = true;
    progress.hidden = false;
    body.querySelectorAll('textarea').forEach((el) => { el.disabled = true; });
    const tick = (n) => {
      bar.style.width = `${Math.min(96, 4 + (n / 6000) * 92)}%`;
      label.textContent = n ? 'Claude is shaping your hero…' : 'Claude is reading your story…';
    };
    tick(0);
    const c = draft();
    try {
      const raw = await generateHero({
        hero: {
          name: c.name, race: c.race, class: c.class, level: c.level,
          armour: ITEMS[c.equipped.armour]?.name ?? '',
          weapons: c.items.map((i) => ITEMS[i.id]).filter((it) => it.kind === 'weapon' || it.kind === 'shield').map((it) => it.name).join(', '),
        },
        design: s.design, backstory: s.backstory,
      }, tick);
      const figure = sanitizeRecipe(raw?.figure);
      if (!figure) throw new Error('Claude did not build a figure. Try again.');
      look = {
        figure,
        tagline: String(raw.tagline ?? '').slice(0, 40),
        colour: HEX.test(String(raw.colour)) ? String(raw.colour) : '',
        goal: String(raw.goal ?? '').slice(0, 240),
      };
      showFigure();
    } catch (err) {
      hint.textContent = explain(err);
    } finally {
      busy = false;
      if (step === 3) {
        const keep = hint.textContent;
        render();
        hint.textContent = keep;
      }
    }
  }

  async function save() {
    busy = true;
    next.disabled = true;
    hint.textContent = 'Saving…';
    try {
      const c = draft();
      await createCharacter(c);
      close();
      await onCreated?.(c);
    } catch (err) {
      hint.textContent = explain(err);
    } finally {
      busy = false;
      next.disabled = false;
    }
  }

  next.addEventListener('click', () => {
    if (busy) return;
    const p = problem();
    if (p && p[0] <= step) { hint.textContent = p[1]; return; }
    if (step === 3) { save(); return; }
    step += 1;
    render();
  });
  back.addEventListener('click', () => { if (!busy && step > 0) { step -= 1; render(); } });
  root.querySelector('.creator__steps').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || busy) return;
    const to = Number(b.dataset.step);
    // Moving forward only past finished steps.
    for (let i = step; i < to; i++) {
      step = i;
      const p = problem();
      if (p && p[0] <= i) { render(); hint.textContent = p[1]; return; }
    }
    step = to;
    render();
  });

  let onClose = null;
  function close() {
    root.hidden = true;
    viewer.stop();
    onClose?.();
  }
  $('.creator__cancel').addEventListener('click', () => {
    if (busy) return;
    if ((look || s.backstory || s.design) && !confirm('Throw away this hero?')) return;
    close();
  });

  return {
    // `closed()` is called when the creator closes, saved or not.
    open({ closed } = {}) {
      onClose = closed ?? null;
      reset();
      root.hidden = false;
      render();
      showFigure();
      viewer.start();
    },
  };
}
