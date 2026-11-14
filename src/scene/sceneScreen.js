// The Scene tab: a 3D place (areas.js) where the players see their heroes together with the
// people they meet. The Dungeon Master makes scenes (where, who is there, which heroes) and
// puts one live; everyone sees the live scene. Tapping someone shows who they are, with a link
// to their page in the Journal when the viewer knows them.
//
// Scenes are journal rows (`quests` table) with data.kind 'scene':
//   { title, area, heroes: [hero id] | undefined (= everyone), people: [{ fig, n }], shown }
// where `fig` is 'npc:<NPC figure id>' or 'monster:<Bestiary id>'. Which scene is live is
// shared through the world row (`scene` in main.js), so players switch with the DM.
import { createSceneView } from './sceneView.js';
import { AREAS, TOWNS, areaOptions } from './areas.js';
import { NPC_FIGURES, npcFigureId } from '../character/npcFigures.js';
import { monsterPortrait, heroPortrait, portraitImg } from '../ui/portraits.js';
import { icon } from '../ui/icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const MAX_PEOPLE = 9;

// entries: the shared journal rows; heroes(): the party; monsters(): the Bestiary { id: monster };
// canEdit(): the DM (not previewing); liveId(): the live scene's id; onSave(row) → saved row;
// onDelete(id); onLive(id | null); onOpenJournal(type, id).
// onFight({ heroes, enemies: { Bestiary id: n }, area }) starts setting up a fight in a scene.
export function createSceneScreen(root, { entries, heroes, monsters, canEdit, liveId, onSave, onDelete, onLive, onOpenJournal, onFight }) {
  root.innerHTML = `
    <div class="scn__stage"></div>
    <header class="scn__plate" hidden></header>
    <div class="scn__empty" hidden></div>
    <aside class="scn__panel" hidden></aside>
    <div class="scn__card" hidden></div>`;
  const $ = (s) => root.querySelector(s);
  const stage = $('.scn__stage'), plate = $('.scn__plate'), empty = $('.scn__empty'), panel = $('.scn__panel'), card = $('.scn__card');
  const view = createSceneView(stage, { onPick: pickPerson });

  let viewing = null; // the scene the DM is looking at
  let editing = null; // { id?, data } while the DM writes a scene
  let folded = window.matchMedia('(max-width: 600px), (max-height: 500px)').matches; // the DM's panel folded away (at first on phones)
  let running = false;
  let shownKey = '';

  const scenes = () => entries.filter((e) => e.data.kind === 'scene').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const byId = (id) => entries.find((e) => e.id === id && e.data.kind === 'scene') ?? null;
  const dm = () => canEdit();

  // Everyone who can be put in a scene.
  function figures() {
    const list = Object.entries(NPC_FIGURES).map(([id, f]) => ({ fig: `npc:${id}`, name: f.name, model: `npc-${id}` }));
    for (const [id, m] of Object.entries(monsters())) {
      if (m.model?.startsWith('npc-') && list.some((f) => f.model === m.model)) continue; // already listed as a person
      list.push({ fig: `monster:${id}`, name: m.name, short: m.short, model: m.model ?? id, generated: m.generated, id });
    }
    return list;
  }
  const figure = (fig) => figures().find((f) => f.fig === fig);

  // The people standing in a scene, one per figure (numbered when there are several).
  function cast(data) {
    const out = [];
    for (const p of data.people ?? []) {
      const f = figure(p.fig);
      if (!f) continue;
      const n = Math.max(1, Math.min(MAX_PEOPLE, p.n ?? 1));
      for (let i = 0; i < n; i++) out.push({ key: `${p.fig}#${i}`, fig: p.fig, model: f.model, name: n > 1 ? `${f.short ?? f.name} ${i + 1}` : f.name });
    }
    return out.slice(0, MAX_PEOPLE);
  }
  const heroesIn = (data) => heroes().filter((c) => !data.heroes || data.heroes.includes(c.id));

  // --- Drawing --------------------------------------------------------------------------------------
  function current() {
    if (editing) return { id: editing.id, data: editing.data };
    if (dm()) return byId(viewing) ?? byId(liveId()) ?? scenes()[0] ?? null;
    return byId(liveId());
  }

  function draw() {
    const s = current();
    root.classList.toggle('is-dm', dm());
    empty.hidden = Boolean(s);
    plate.hidden = !s;
    if (!s) {
      empty.innerHTML = dm()
        ? `<p class="scn__empty-title">No scenes yet</p><p>Make one with <b>New scene</b>: pick a place and who is there, then put it live for the players.</p>`
        : `<p class="scn__empty-title">No scene right now</p><p>When the Dungeon Master sets a scene, you will see your heroes and the people you meet here.</p>`;
      view.clear();
      shownKey = '';
    } else {
      const area = AREAS[s.data.area] ?? AREAS.port;
      const live = s.id && s.id === liveId();
      plate.innerHTML = `
        ${s.data.title && s.data.title !== area.name ? `<small>${esc(area.name)}</small>` : ''}
        <b>${esc(s.data.title || area.name)}</b>
        ${dm() ? `<span class="scn__live${live ? ' is-on' : ''}">${live ? 'Live for the players' : editing ? 'Being written' : 'Not live'}</span>
          <button type="button" class="btn btn--gold scn__fight">${icon('combat')}Fight!</button>` : ''}`;
      const people = cast(s.data), crew = heroesIn(s.data);
      const key = JSON.stringify([s.data.area, people.map((p) => p.key + p.model), crew.map((c) => `${c.id}|${JSON.stringify(c.equipped)}|${c.figure ? 1 : 0}`)]);
      if (key !== shownKey) { shownKey = key; view.show({ area: s.data.area, heroes: crew, npcs: people }); card.hidden = true; }
    }
    drawPanel();
  }

  function drawPanel() {
    panel.hidden = !dm();
    // On wide screens the panel stands at the side: centre the picture in the rest.
    const side = dm() && !folded && window.innerWidth > 700 && window.innerHeight > 500;
    view.setInset(side ? panel.offsetWidth + 50 : 0);
    if (!dm()) return;
    panel.classList.toggle('is-folded', folded);
    if (editing) { panel.innerHTML = form(); return; }
    const live = liveId(), list = scenes(), shown = current()?.id;
    panel.innerHTML = `
      <header class="scn__head">
        <button type="button" class="scn__fold" aria-expanded="${!folded}">${icon('pin', 'inline')} Scenes <i>${folded ? '▸' : '▾'}</i></button>
        <button type="button" class="btn btn--gold scn__new">${icon('plus')}New scene</button>
      </header>
      <ul class="scn__list">
        ${list.length ? TOWNS.flatMap((t) => {
          const here = list.filter((e) => (AREAS[e.data.area] ?? AREAS.port).town === t);
          return here.length ? [`<li class="scn__town">${esc(t)}</li>`, ...here] : [];
        }).map((e) => {
          if (typeof e === 'string') return e;
          const area = AREAS[e.data.area] ?? AREAS.port;
          return `
          <li class="scn__item${e.id === shown ? ' is-open' : ''}${e.id === live ? ' is-live' : ''}" data-id="${e.id}">
            <button type="button" class="scn__pick" data-do="view"><b>${esc(e.data.title || area.name)}</b><small>${esc(area.short)} · ${cast(e.data).length} here${e.id === live ? ' · <em>live</em>' : ''}</small></button>
            <span class="scn__tools">
              <button type="button" data-do="${e.id === live ? 'end' : 'live'}" class="scn__go${e.id === live ? ' is-on' : ''}">${e.id === live ? 'End' : 'Go live'}</button>
              <button type="button" data-do="fight" aria-label="Fight here" title="Start a fight here">${icon('combat')}</button>
              <button type="button" data-do="edit" aria-label="Edit">${icon('pen')}</button>
            </span>
          </li>`;
        }).join('') : '<li class="scn__none">No scenes yet.</li>'}
      </ul>`;
  }

  function form() {
    const d = editing.data, counts = Object.fromEntries((d.people ?? []).map((p) => [p.fig, p.n ?? 1]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const figs = figures();
    const row = (f) => `
      <li class="scn__who${counts[f.fig] ? ' is-on' : ''}">
        ${portraitImg(monsterPortrait(f.model, f.generated ? f.id : ''), { name: f.name, colour: '#5c4a36', cls: 'scn__face' })}
        <span>${esc(f.name)}</span>
        <span class="stepper">
          <button type="button" data-fig="${f.fig}" data-d="-1" aria-label="One fewer"${counts[f.fig] ? '' : ' disabled'}>−</button>
          <b>${counts[f.fig] ?? 0}</b>
          <button type="button" data-fig="${f.fig}" data-d="1" aria-label="One more"${total >= MAX_PEOPLE ? ' disabled' : ''}>+</button>
        </span>
      </li>`;
    return `
      <form class="scn__form">
        <h3 class="scn__title">${editing.id ? 'Edit scene' : 'New scene'}</h3>
        <label class="field"><span>Name</span><input class="field__input" name="title" maxlength="60" value="${esc(d.title)}" placeholder="e.g. An audience with the Man" /></label>
        <label class="field"><span>Where</span><select class="field__input" name="area">${areaOptions(d.area, esc)}</select></label>
        <p class="scn__h">Heroes here</p>
        <div class="scn__heroes">${heroes().map((c) => `
          <label class="scn__hero"><input type="checkbox" name="hero" value="${esc(c.id)}"${!d.heroes || d.heroes.includes(c.id) ? ' checked' : ''} />${portraitImg(heroPortrait(c), { name: c.name, colour: c.colour, cls: 'scn__face' })}<span>${esc(c.name.split(' ')[0])}</span></label>`).join('')}
        </div>
        <p class="scn__h">Who is here <small>${total} / ${MAX_PEOPLE}</small></p>
        <ul class="scn__whos">${figs.map(row).join('')}</ul>
        <div class="scn__actions">
          ${editing.id ? '<button type="button" class="btn scn__delete" data-do="delete">Delete</button>' : ''}
          <span></span>
          <button type="button" class="btn" data-do="cancel">Cancel</button>
          <button type="submit" class="btn btn--gold">Save</button>
        </div>
      </form>`;
  }

  // --- A tapped person -------------------------------------------------------------------------------
  function pickPerson(key) {
    const s = current();
    if (!s) return;
    let html = '';
    if (key.startsWith('hero:')) {
      const c = heroes().find((h) => `hero:${h.id}` === key);
      if (!c) return;
      html = `${portraitImg(heroPortrait(c), { name: c.name, colour: c.colour, cls: 'scn__card-face' })}
        <div><b>${esc(c.name)}</b><small>Level ${c.level} ${esc(c.className ?? c.class ?? '')}</small></div>`;
    } else {
      const p = cast(s.data).find((x) => x.key === key);
      if (!p) return;
      const link = journalFor(p.fig);
      html = `${portraitImg(monsterPortrait(p.model, figure(p.fig)?.generated ? figure(p.fig).id : ''), { name: p.name, colour: '#5c4a36', cls: 'scn__card-face' })}
        <div><b>${esc(p.name)}</b>${link ? `<button type="button" class="scn__card-link" data-type="${link.type}" data-id="${esc(link.id)}">${icon('journal', 'inline')} Read in the journal</button>` : '<small>Not in your journal yet</small>'}</div>`;
    }
    card.innerHTML = `${html}<button type="button" class="scn__card-close" aria-label="Close">×</button>`;
    card.hidden = false;
  }

  // The journal page this viewer can read about a figure: a person, or a creature they met.
  function journalFor(fig) {
    const [kind, id] = fig.split(':');
    const figId = kind === 'npc' ? id : id === 'hooknose' ? 'hooknose' : null;
    const person = figId && entries.find((e) => e.data.kind === 'npc' && (dm() || e.data.shown !== false) && npcFigureId(e.data) === figId);
    if (person) return { type: 'npc', id: person.id };
    if (kind === 'monster') {
      const c = entries.find((e) => e.data.kind === 'creature' && e.data.monster === id && (dm() || e.data.shown));
      if (c || dm()) return { type: 'creature', id };
    }
    return null;
  }

  // Straight into a fight in a scene: it is put live (so the players see where), and the fight
  // starts with its heroes and everyone in it who can fight.
  async function fightIn(row) {
    if (!row) return;
    const d = row.data, enemies = {};
    // Who can fight: Bestiary creatures, and people who are also in the Bestiary (Lord Wolf…).
    for (const p of d.people ?? []) {
      const [kind, fid] = p.fig.split(':');
      const type = kind === 'monster' ? fid : Object.entries(monsters()).find(([, m]) => m.model === `npc-${fid}`)?.[0];
      if (type) enemies[type] = (enemies[type] ?? 0) + (p.n ?? 1);
    }
    viewing = row.id;
    if (liveId() !== row.id) await onLive(row.id);
    onFight({ heroes: heroesIn(d).map((c) => c.id), enemies, area: d.area });
  }
  // A scene still being written is saved first.
  async function saveEditing() {
    readForm(panel.querySelector('.scn__form'));
    const row = await onSave({ id: editing.id, data: { ...editing.data, title: editing.data.title.trim() || AREAS[editing.data.area].name } });
    viewing = row.id;
    editing = null;
    return row;
  }
  plate.addEventListener('click', async (e) => {
    const b = e.target.closest('.scn__fight');
    if (!b) return;
    b.disabled = true;
    try {
      const row = editing ? await saveEditing() : current();
      draw();
      await fightIn(row);
    } catch (err) {
      alert(err.message);
    } finally {
      b.disabled = false;
    }
  });

  // --- Events ------------------------------------------------------------------------------------------
  card.addEventListener('click', (e) => {
    if (e.target.closest('.scn__card-close')) { card.hidden = true; return; }
    const l = e.target.closest('.scn__card-link');
    if (l) onOpenJournal(l.dataset.type, l.dataset.id);
  });

  panel.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('scn__fold')) { folded = !folded; drawPanel(); return; }
    if (b.classList.contains('scn__new')) {
      editing = { data: { kind: 'scene', title: '', area: 'port', people: [], shown: true } };
      folded = false;
      draw();
      return;
    }
    if (b.dataset.fig) {
      const f = panel.querySelector('.scn__form');
      readForm(f);
      const people = editing.data.people.map((p) => ({ ...p }));
      const p = people.find((x) => x.fig === b.dataset.fig);
      if (p) p.n = (p.n ?? 1) + Number(b.dataset.d); else if (Number(b.dataset.d) > 0) people.push({ fig: b.dataset.fig, n: 1 });
      editing.data.people = people.filter((x) => x.n > 0);
      const scroll = panel.querySelector('.scn__whos')?.scrollTop ?? 0, top = panel.scrollTop;
      draw();
      panel.scrollTop = top;
      const list = panel.querySelector('.scn__whos'); if (list) list.scrollTop = scroll;
      return;
    }
    const id = b.closest('[data-id]')?.dataset.id;
    switch (b.dataset.do) {
      case 'view': viewing = id; draw(); break;
      case 'live': viewing = id; await onLive(id); draw(); break;
      case 'end': await onLive(null); draw(); break;
      case 'fight': fightIn(byId(id)); break;
      case 'edit': { const s = byId(id); editing = { id, data: structuredClone(s.data) }; viewing = id; draw(); break; }
      case 'cancel': editing = null; draw(); break;
      case 'delete':
        if (!confirm('Delete this scene?')) return;
        if (liveId() === editing.id) await onLive(null);
        await onDelete(editing.id);
        editing = null; viewing = null; draw();
        break;
      default:
    }
  });
  // Changing where the scene is shows the new place at once.
  panel.addEventListener('change', (e) => {
    if (!editing) return;
    readForm(e.target.form);
    draw();
  });
  panel.addEventListener('submit', async (e) => {
    e.preventDefault();
    readForm(e.target);
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await saveEditing();
      draw();
    } catch (err) {
      btn.disabled = false;
      alert(err.message);
    }
  });
  function readForm(f) {
    if (!f) return;
    const all = heroes().map((c) => c.id);
    const on = [...f.querySelectorAll('input[name=hero]:checked')].map((i) => i.value);
    editing.data = { ...editing.data, title: f.title.value, area: f.area.value, heroes: on.length === all.length ? undefined : on };
  }

  return {
    start() { running = true; view.start(); draw(); },
    stop() { running = false; view.stop(); },
    // The journal, the party or the live scene changed somewhere.
    refresh() { if (running) draw(); else shownKey = shownKey && 'stale'; },
  };
}
