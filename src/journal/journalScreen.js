// The Journal: one sheet of paper with three bookmarks, Quests, People and
// Places, and a search box. The list of entries is on the left of the page and
// the chosen entry on the right (on a phone they take turns).
//
// Everything is stored in the `quests` table (supabase/session.sql) as
// { id, data, shown }, with `data.kind` telling what an entry is:
//   quest      { title, body, status, place, steps: [{ text, done }], shown }   (no kind = quest)
//   npc        { title (name), role, place, attitude, status, body, shown }
//   place      { title, place (the map place it is in, or ''), body, shown }    places the DM adds
//   placenote  { place (a map place id), body, shown }                           notes on a map place
//   item       { title, type, holder (hero id, or '' for the party), place (where found), body (its text), shown }
//              lore books, notes, letters, maps and objects; shown = the party has been given it
//   creature   { monster (a Bestiary id), body (what the party learned), shown }   creatures the party met;
//              fighting one adds it (shown). The name, picture and description come from the Bestiary.
//   secret     { about (an entry id, or 'map:<place id>'), body, shown: false }   DM-only notes
// Players see entries marked shown (RLS) and only map places they have discovered. Secrets are
// never shown, so the database never sends them to players.
import { icon } from '../ui/icons.js';
import { monsterPortrait, portraitImg } from '../ui/portraits.js';

// On the dev server only: the owner's lore, ready for a one-time import (src/data/lore-import.local.js,
// kept out of git and out of the built app because it holds DM secrets).
const LORE_FILES = import.meta.env.DEV ? import.meta.glob('../data/lore-import.local.js') : {};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const lines = (s) => esc(s).replace(/\n/g, '<br />');
const kindOf = (e) => e.data.kind ?? 'quest';

const QUEST_STATUS = { active: 'Active', done: 'Completed', failed: 'Failed' };
const ATTITUDE = { friendly: 'Friendly', neutral: 'Neutral', hostile: 'Hostile', unknown: 'Unknown' };
const ALIVE = { alive: 'Alive', dead: 'Dead', missing: 'Missing' };
const SECTIONS = [
  { id: 'quests', label: 'Quests', icon: 'scroll', kind: 'quest', newLabel: 'New quest' },
  { id: 'people', label: 'People', icon: 'hero', kind: 'npc', newLabel: 'New person' },
  { id: 'places', label: 'Places', icon: 'pin', kind: 'place', newLabel: 'New place' },
  { id: 'items', label: 'Items', icon: 'journal', kind: 'item', newLabel: 'New item' },
  { id: 'creatures', label: 'Creatures', icon: 'bestiary', kind: 'creature', newLabel: '' },
];
const ITEM_TYPE = {
  book: { label: 'Book', icon: 'journal' }, note: { label: 'Note', icon: 'scroll' }, letter: { label: 'Letter', icon: 'scroll' },
  map: { label: 'Map', icon: 'map' }, object: { label: 'Object', icon: 'bag' },
};
const TIER_NAME = { continent: 'Continent', city: 'Town', local: 'Place', region: 'Land', water: 'Water' };

// entries: the shared list of { id, data, created_at }.
// canEdit(): true for the Dungeon Master (not previewing).
// mapPlaces(): the world-map places this viewer may see: [{ id, name, subtitle, text, tier, secret }].
// heroes(): the party [{ id, name }] for who holds an item.
// monsters(): the Bestiary [{ id, name, kind, note, model, generated }].
// onSave(entry) → saved row; onDelete(id); onShowPlace(mapPlaceId).
export function createJournalScreen(root, { entries, canEdit, mapPlaces, heroes = () => [], monsters = () => [], onSave, onDelete, onShowPlace, onOpenBestiary }) {
  root.innerHTML = `
    <div class="jr">
      <header class="jr__head">
        <h2 class="jr__title">Journal</h2>
        <label class="jr__search">${icon('wis', 'inline')}<input type="search" placeholder="Search the journal" aria-label="Search the journal" /></label>
        <button type="button" class="btn jr__import" hidden></button>
        <button type="button" class="btn btn--gold jr__new" hidden>${icon('plus')}<span></span></button>
      </header>
      <nav class="jr__tabs" role="tablist"></nav>
      <div class="jr__body">
        <div class="jr__list"></div>
        <article class="jr__page"></article>
      </div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const sheet = $('.jr'), tabsEl = $('.jr__tabs'), listEl = $('.jr__list'), pageEl = $('.jr__page');
  const searchEl = $('.jr__search input'), newBtn = $('.jr__new'), importBtn = $('.jr__import');

  let section = 'quests';
  let open = null;      // what the page shows: { type: 'quest' | 'npc' | 'place' | 'map', id }
  let editing = null;   // a draft { id?, data } being written (DM)
  let query = '';
  let peopleSort = 'town'; // People: grouped by town, or 'name' for A–Z

  // --- Looking things up -------------------------------------------------------------------------
  const visible = (e) => canEdit() || e.data.shown !== false;
  const all = (kind) => entries.filter((e) => kindOf(e) === kind && visible(e));
  const byId = (id) => entries.find((e) => e.id === id);
  const mapPlace = (id) => mapPlaces().find((p) => p.id === id) ?? null;
  const noteFor = (id) => entries.find((e) => kindOf(e) === 'placenote' && e.data.place === id && visible(e));
  // The DM's secret note about an entry (or 'map:<id>' for a map place); never for players.
  const secretFor = (about) => (canEdit() ? entries.find((e) => kindOf(e) === 'secret' && e.data.about === about) : null);
  // The town on the map something belongs to: a map place, or the town a smaller place is in.
  function townOf(id, depth = 0) {
    if (!id || depth > 6) return null;
    if (mapPlace(id)) return id;
    const e = byId(id);
    return e && kindOf(e) === 'place' ? townOf(e.data.place, depth + 1) : null;
  }

  // A place reference (a map place id or a place entry id) → { type, id, name }.
  function placeRef(id) {
    if (!id) return null;
    const m = mapPlace(id);
    if (m) return { type: 'map', id, name: m.name };
    const e = byId(id);
    if (e && kindOf(e) === 'place' && visible(e)) return { type: 'place', id, name: e.data.title };
    return { type: null, id, name: 'An unknown place' };
  }
  const placeLink = (id, prefix = '') => {
    const r = placeRef(id);
    if (!r) return '';
    return r.type
      ? `<button type="button" class="jr-link" data-open="${r.type}:${esc(r.id)}">${prefix}${icon('pin', 'inline')}${esc(r.name)}</button>`
      : `<span class="jr-link is-unknown">${prefix}${esc(r.name)}</span>`;
  };
  // Everything that happens at a place: people met there, places inside it, quests leading there.
  const atPlace = (id) => ({
    people: all('npc').filter((n) => n.data.place === id),
    places: all('place').filter((p) => p.data.place === id),
    quests: all('quest').filter((q) => q.data.place === id),
  });

  const matches = (...texts) => !query || texts.some((t) => String(t ?? '').toLowerCase().includes(query));

  // --- The list ------------------------------------------------------------------------------------
  const item = (type, id, { title, sub, mark = '', cls = '' }) => `
    <li><button type="button" class="jr-item${cls}${open?.type === type && open.id === id && !editing ? ' is-on' : ''}" data-open="${type}:${esc(id)}">
      ${mark}<span class="jr-item__text"><b>${esc(title)}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    </button></li>`;

  function questItems() {
    const qs = all('quest').filter((q) => matches(q.data.title, q.data.body, ...(q.data.steps ?? []).map((s) => s.text)));
    const one = (q) => {
      const steps = q.data.steps ?? [];
      const done = steps.filter((s) => s.done).length;
      const where = placeRef(q.data.place)?.name;
      return item('quest', q.id, {
        title: q.data.title,
        sub: [steps.length ? `${done}/${steps.length} steps` : '', where ? esc(where) : '', q.data.shown === false ? '🔒 hidden' : ''].filter(Boolean).join(' · '),
        mark: `<span class="jr-mark jr-mark--${q.data.status ?? 'active'}">${icon((q.data.status ?? 'active') === 'active' ? 'scroll' : 'prof')}</span>`,
        cls: q.data.shown === false ? ' is-hidden' : '',
      });
    };
    const active = qs.filter((q) => (q.data.status ?? 'active') === 'active');
    const past = qs.filter((q) => (q.data.status ?? 'active') !== 'active');
    return [
      active.length ? `<p class="jr-group">Active</p><ul>${active.map(one).join('')}</ul>` : '',
      past.length ? `<p class="jr-group">Finished</p><ul>${past.map(one).join('')}</ul>` : '',
    ].join('');
  }

  function peopleItems() {
    const ps = all('npc')
      .filter((n) => matches(n.data.title, n.data.role, n.data.body, placeRef(n.data.place)?.name))
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
    if (!ps.length) return '';
    const one = (n, showTown) => item('npc', n.id, {
      title: n.data.title,
      sub: [esc(n.data.role), showTown ? esc(placeRef(n.data.place)?.name ?? '') : esc(placeRef(n.data.place)?.type === 'place' ? placeRef(n.data.place).name : ''), n.data.shown === false ? '🔒 hidden' : ''].filter(Boolean).join(' · '),
      mark: `<span class="jr-face jr-face--${n.data.attitude ?? 'unknown'}" title="${ATTITUDE[n.data.attitude] ?? 'Unknown'}">${esc(n.data.title[0] ?? '?')}</span>`,
      cls: `${n.data.status === 'dead' ? ' is-dead' : ''}${n.data.shown === false ? ' is-hidden' : ''}`,
    });
    const sortBar = `<div class="jr-sort">Sort by <button type="button" data-sort="town"${peopleSort === 'town' ? ' class="is-on"' : ''}>Town</button><button type="button" data-sort="name"${peopleSort === 'name' ? ' class="is-on"' : ''}>A–Z</button></div>`;
    if (peopleSort === 'name' || query) return `${query ? '' : sortBar}<ul>${ps.map((n) => one(n, true)).join('')}</ul>`;
    // Grouped under the town they belong to, in map order; people with no town last.
    const towns = [...mapPlaces().map((m) => m.id), ''];
    const groups = towns
      .map((t) => [t, ps.filter((n) => (townOf(n.data.place) ?? '') === t)])
      .filter(([, list]) => list.length);
    return sortBar + groups.map(([t, list]) => `
      <p class="jr-group">${t ? `${icon('map', 'inline')} ${esc(mapPlace(t).name)}` : 'No town'} <small>${list.length}</small></p>
      <ul>${list.map((n) => one(n, false)).join('')}</ul>`).join('');
  }

  // Places: each town on the map, with the smaller places inside it right under it.
  function placeItems() {
    const own = all('place').sort((a, b) => a.data.title.localeCompare(b.data.title));
    const ownMatch = (p) => matches(p.data.title, p.data.body);
    const ownItem = (p) => item('place', p.id, {
      title: p.data.title,
      sub: [p.data.shown === false ? '🔒 hidden' : ''].filter(Boolean).join(' · '),
      mark: `<span class="jr-mark">${icon('pin')}</span>`,
      cls: ` is-child${p.data.shown === false ? ' is-hidden' : ''}`,
    });
    const towns = mapPlaces().map((m) => {
      const inside = own.filter((p) => townOf(p.data.place) === m.id && ownMatch(p));
      if (!matches(m.name, m.subtitle, m.text, noteFor(m.id)?.data.body) && !inside.length) return '';
      const people = all('npc').filter((n) => townOf(n.data.place) === m.id).length;
      return item('map', m.id, {
        title: m.name,
        sub: [TIER_NAME[m.tier] ?? 'Place', people ? `${people} ${people === 1 ? 'person' : 'people'}` : '', m.secret ? '🔒 not discovered' : ''].filter(Boolean).join(' · '),
        mark: `<span class="jr-mark">${icon('map')}</span>`,
        cls: m.secret ? ' is-hidden' : '',
      }) + inside.map(ownItem).join('');
    }).join('');
    const elsewhere = own.filter((p) => !townOf(p.data.place) && ownMatch(p));
    return [
      towns ? `<ul>${towns}</ul>` : '',
      elsewhere.length ? `<p class="jr-group">Elsewhere</p><ul>${elsewhere.map(ownItem).join('')}</ul>` : '',
    ].join('');
  }

  // Items: what the party has, and (for the DM) what they haven't been given yet.
  const holderName = (id) => (id ? heroes().find((h) => h.id === id)?.name ?? 'Someone' : 'The party');
  function itemItems() {
    const its = all('item')
      .filter((x) => matches(x.data.title, x.data.body, ITEM_TYPE[x.data.type]?.label))
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
    const one = (x) => item('item', x.id, {
      title: x.data.title,
      sub: [ITEM_TYPE[x.data.type]?.label ?? 'Item', x.data.shown === false ? '' : esc(holderName(x.data.holder))].filter(Boolean).join(' · '),
      mark: `<span class="jr-mark">${icon(ITEM_TYPE[x.data.type]?.icon ?? 'bag')}</span>`,
      cls: x.data.shown === false ? ' is-hidden' : '',
    });
    const given = its.filter((x) => x.data.shown !== false), kept = its.filter((x) => x.data.shown === false);
    return [
      given.length ? `<p class="jr-group">${canEdit() ? 'Given to the party' : 'What we carry'}</p><ul>${given.map(one).join('')}</ul>` : '',
      kept.length ? `<p class="jr-group">Not given yet</p><ul>${kept.map(one).join('')}</ul>` : '',
    ].join('');
  }

  // Creatures: a journal entry per Bestiary creature the party knows about.
  const creatureEntry = (monsterId) => entries.find((e) => kindOf(e) === 'creature' && e.data.monster === monsterId);
  const known = (m) => creatureEntry(m.id)?.data.shown === true;
  const face = (m, cls = '') => portraitImg(monsterPortrait(m.model ?? m.id, m.generated ? m.id : ''), { name: m.name, colour: '#5c4a36', cls });
  function creatureItems() {
    const ms = monsters()
      .filter((m) => canEdit() || known(m))
      .filter((m) => matches(m.name, m.kind, m.note, creatureEntry(m.id)?.data.body))
      .sort((a, b) => a.name.localeCompare(b.name));
    const one = (m) => item('creature', m.id, { title: m.name, sub: esc(m.kind), mark: `<span class="jr-beast">${face(m)}</span>`, cls: known(m) ? '' : ' is-hidden' });
    const met = ms.filter(known), not = ms.filter((m) => !known(m));
    return [
      met.length ? `<p class="jr-group">${canEdit() ? 'The party knows' : 'Creatures we have met'}</p><ul>${met.map(one).join('')}</ul>` : '',
      not.length ? `<p class="jr-group">Not met yet</p><ul>${not.map(one).join('')}</ul>` : '',
    ].join('');
  }

  const ITEMS = { quests: questItems, people: peopleItems, places: placeItems, items: itemItems, creatures: creatureItems };
  const EMPTY = {
    items: 'No books, notes or special things yet.',
    creatures: 'No creatures met yet. Every creature the party fights is written down here.',
    quests: 'No quests yet.',
    people: 'Nobody written down yet. People the party meets will appear here.',
    places: 'No places yet.',
  };

  function renderList() {
    const counts = {
      quests: all('quest').length,
      people: all('npc').length,
      places: mapPlaces().length + all('place').length,
      items: all('item').length,
      creatures: canEdit() ? monsters().length : monsters().filter(known).length,
    };
    tabsEl.innerHTML = SECTIONS.map((s) => `
      <button type="button" role="tab" class="jr-tab${s.id === section && !query ? ' is-on' : ''}" data-section="${s.id}">
        ${icon(s.icon)}<span>${s.label}</span><small>${counts[s.id]}</small>
      </button>`).join('');
    if (query) {
      // A search looks through all three sections at once.
      const parts = SECTIONS.map((s) => [s, ITEMS[s.id]()]).filter(([, html]) => html);
      listEl.innerHTML = parts.length
        ? parts.map(([s, html]) => `<p class="jr-group jr-group--section">${icon(s.icon, 'inline')} ${s.label}</p>${html}`).join('')
        : `<p class="jr-empty">Nothing matches “${esc(query)}”.</p>`;
    } else {
      listEl.innerHTML = ITEMS[section]() || `<p class="jr-empty">${EMPTY[section]}</p>`;
    }
    const s = SECTIONS.find((x) => x.id === section);
    newBtn.hidden = !canEdit() || !s.newLabel;
    newBtn.querySelector('span').textContent = s.newLabel;
    drawImport();
    if (canEdit() && !lore) loadLore();
  }

  // --- The page ------------------------------------------------------------------------------------
  const back = '<button type="button" class="jr-back" data-do="back">‹ Back</button>';
  const tools = (e, extra = '') => (canEdit() ? `
    <div class="jr-tools">
      ${extra}
      <button type="button" data-do="shown">${icon(e.data.shown === false ? 'wis' : 'lock')}${kindOf(e) === 'item'
        ? (e.data.shown === false ? 'Give to the party' : 'Take it back')
        : (e.data.shown === false ? 'Show to players' : 'Hide from players')}</button>
      <button type="button" data-do="edit">${icon('pen')}Edit</button>
      <button type="button" data-do="delete" class="jr-tools__delete">Delete</button>
    </div>` : '');
  const secretBox = (about) => {
    const sec = secretFor(about);
    return sec?.data.body ? `<div class="jr-secret"><h4>${icon('lock', 'inline')} DM only</h4><p>${lines(sec.data.body)}</p></div>` : '';
  };
  const related = (label, list, type, line) => (list.length ? `
    <h4 class="jr-h">${label}</h4>
    <ul class="jr-links">${list.map((e) => `<li><button type="button" class="jr-link" data-open="${type}:${esc(e.id)}">${line(e)}</button></li>`).join('')}</ul>` : '');

  function questPage(q) {
    const d = q.data, edit = canEdit();
    return `
      <p class="jr-kicker">${QUEST_STATUS[d.status ?? 'active']} quest${d.shown === false ? ' · 🔒 hidden from players' : ''}</p>
      <h3 class="jr-name">${esc(d.title)}</h3>
      ${d.place ? `<p class="jr-meta">${placeLink(d.place, 'Leads to ')}</p>` : ''}
      ${d.body ? `<p class="jr-text">${lines(d.body)}</p>` : ''}
      ${d.steps?.length ? `
        <ul class="jr-steps">
          ${d.steps.map((s, i) => `<li class="${s.done ? 'is-done' : ''}">
            ${edit ? `<button type="button" class="jr-tick" data-step="${i}" aria-label="Mark as ${s.done ? 'not done' : 'done'}">${s.done ? icon('check') : ''}</button>` : `<span class="jr-tick">${s.done ? icon('check') : ''}</span>`}
            <span>${esc(s.text)}</span></li>`).join('')}
        </ul>` : ''}
      ${secretBox(q.id)}
      ${tools(q, (d.status ?? 'active') === 'active'
        ? `<button type="button" data-do="done">${icon('check')}Completed</button>`
        : `<button type="button" data-do="active">${icon('scroll')}Make active again</button>`)}`;
  }

  function npcPage(n) {
    const d = n.data;
    const others = d.place ? atPlace(d.place).people.filter((x) => x.id !== n.id) : [];
    return `
      <p class="jr-kicker">${esc(d.role || 'Person')}${d.shown === false ? ' · 🔒 hidden from players' : ''}</p>
      <h3 class="jr-name${d.status === 'dead' ? ' is-dead' : ''}">${esc(d.title)}</h3>
      <p class="jr-badges">
        <span class="jr-badge jr-badge--${d.attitude ?? 'unknown'}">${ATTITUDE[d.attitude] ?? 'Unknown'}</span>
        <span class="jr-badge jr-badge--${d.status ?? 'alive'}">${ALIVE[d.status] ?? 'Alive'}</span>
      </p>
      ${d.place ? `<p class="jr-meta">${placeLink(d.place, 'Met at ')}</p>` : ''}
      ${d.body ? `<p class="jr-text">${lines(d.body)}</p>` : '<p class="jr-text is-empty">Nothing written about them yet.</p>'}
      ${secretBox(n.id)}
      ${related(`Also met at ${esc(placeRef(d.place)?.name ?? '')}`, others, 'npc', (x) => `${esc(x.data.title)}${x.data.role ? ` <small>${esc(x.data.role)}</small>` : ''}`)}
      ${tools(n)}`;
  }

  // Lists what is at a place: people, smaller places and quests.
  function hereLists(id) {
    const here = atPlace(id);
    return [
      related('People met here', here.people, 'npc', (x) => `${esc(x.data.title)}${x.data.role ? ` <small>${esc(x.data.role)}</small>` : ''}`),
      related('Places here', here.places, 'place', (x) => esc(x.data.title)),
      related('Quests', here.quests, 'quest', (x) => esc(x.data.title)),
    ].join('');
  }

  // An item: who has it, where it was found, and its text to read like a page of a book.
  function itemPage(x) {
    const d = x.data, t = ITEM_TYPE[d.type] ?? ITEM_TYPE.object;
    return `
      <p class="jr-kicker">${t.label}${d.shown === false ? ' · 🔒 not given to the party yet' : ` · carried by ${esc(holderName(d.holder))}`}</p>
      <h3 class="jr-name">${esc(d.title)}</h3>
      ${d.place ? `<p class="jr-meta">${placeLink(d.place, 'Found at ')}</p>` : ''}
      ${d.body ? `<div class="jr-read jr-read--${esc(d.type ?? 'object')}">${d.body.split(/\n{2,}/).map((para) => `<p>${lines(para)}</p>`).join('')}</div>` : '<p class="jr-text is-empty">Nothing written in it.</p>'}
      ${secretBox(x.id)}
      ${tools(x)}`;
  }

  // A creature: its picture and description from the Bestiary, and what the party learned.
  function creaturePage(m) {
    const e = creatureEntry(m.id), edit = canEdit();
    return `
      <div class="jr-creature">
        <span class="jr-creature__face">${face(m)}</span>
        <div>
          <p class="jr-kicker">${esc(m.kind)}${edit && !known(m) ? ' · 🔒 not met yet' : ''}</p>
          <h3 class="jr-name">${esc(m.name)}</h3>
        </div>
      </div>
      ${m.note ? `<p class="jr-text">${esc(m.note)}</p>` : ''}
      ${e?.data.body ? `<h4 class="jr-h">What we learned</h4><p class="jr-text">${lines(e.data.body)}</p>` : ''}
      ${e ? secretBox(e.id) : ''}
      ${edit ? `
        <div class="jr-tools">
          <button type="button" data-do="creatureshown">${icon(known(m) ? 'lock' : 'wis')}${known(m) ? 'Hide from players' : 'Show to players'}</button>
          <button type="button" data-do="creaturenote">${icon('pen')}${e?.data.body ? 'Edit notes' : 'Write notes'}</button>
          <button type="button" data-do="bestiary">${icon('bestiary')}Open in the Bestiary</button>
        </div>` : ''}`;
  }

  function placePage(p) {
    const d = p.data;
    return `
      <p class="jr-kicker">Place${d.shown === false ? ' · 🔒 hidden from players' : ''}</p>
      <h3 class="jr-name">${esc(d.title)}</h3>
      ${d.place ? `<p class="jr-meta">${placeLink(d.place, 'In ')}</p>` : ''}
      ${d.body ? `<p class="jr-text">${lines(d.body)}</p>` : '<p class="jr-text is-empty">Nothing written about it yet.</p>'}
      ${secretBox(p.id)}
      ${hereLists(p.id)}
      ${tools(p)}`;
  }

  function mapPage(m) {
    const note = noteFor(m.id);
    const edit = canEdit();
    return `
      <p class="jr-kicker">${esc(m.subtitle || TIER_NAME[m.tier] || 'Place')}${m.secret ? ' · 🔒 players have not found it yet' : ''}</p>
      <h3 class="jr-name">${esc(m.name)}</h3>
      <p class="jr-meta"><button type="button" class="jr-link" data-map="${esc(m.id)}">${icon('map', 'inline')}Show on the map</button></p>
      ${m.text ? `<p class="jr-text">${esc(m.text)}</p>` : ''}
      ${note ? `<h4 class="jr-h">What we learned${note.data.shown === false ? ' <small>🔒 hidden</small>' : ''}</h4><p class="jr-text">${lines(note.data.body)}</p>` : ''}
      ${secretBox(`map:${m.id}`)}
      ${hereLists(m.id)}
      ${edit ? `<div class="jr-tools">
        <button type="button" data-do="note">${icon('pen')}${note ? 'Edit notes' : 'Write notes'}</button>
        ${note ? `<button type="button" data-do="noteshown">${icon(note.data.shown === false ? 'wis' : 'lock')}${note.data.shown === false ? 'Show notes to players' : 'Hide notes from players'}</button>` : ''}
      </div>` : ''}`;
  }

  // --- Writing (DM) --------------------------------------------------------------------------------
  // The place picker: map places and the DM's own places.
  const placeOptions = (current, none) => `
    <option value="">${none}</option>
    <optgroup label="On the map">${mapPlaces().map((p) => `<option value="${esc(p.id)}"${p.id === current ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>
    ${all('place').length ? `<optgroup label="Places we found">${all('place').filter((p) => p.id !== editing?.id).map((p) => `<option value="${esc(p.id)}"${p.id === current ? ' selected' : ''}>${esc(p.data.title)}</option>`).join('')}</optgroup>` : ''}`;
  const shownBox = (d, label = 'Players can see this') => `<label class="toggle"><input type="checkbox" name="shown"${d.shown !== false ? ' checked' : ''} /> ${label}</label>`;
  const secretField = (about) => `
    <label class="field jr-secret-field"><span>${icon('lock', 'inline')} DM only: secrets, stats, plans (never shown to players)</span><textarea class="field__input" name="secret" rows="3" maxlength="3000">${esc(secretFor(about)?.data.body ?? '')}</textarea></label>`;
  const formEnd = `
    <p class="jr-error" role="alert"></p>
    <div class="jr-form__actions">
      <button type="button" class="btn" data-do="cancel">Cancel</button>
      <button type="submit" class="btn btn--gold">Save</button>
    </div>`;

  function editorPage() {
    const d = editing.data, kind = kindOf(editing), isNew = !editing.id;
    if (kind === 'quest') return `
      <form class="jr-form" data-kind="quest">
        <h3 class="jr-name">${isNew ? 'New quest' : 'Edit quest'}</h3>
        <label class="field"><span>Title</span><input class="field__input" name="title" maxlength="60" required value="${esc(d.title)}" placeholder="e.g. Reach Bartedalen" /></label>
        <label class="field"><span>What the party knows</span><textarea class="field__input" name="body" rows="3" maxlength="1500">${esc(d.body)}</textarea></label>
        <label class="field"><span>Steps (one per line)</span><textarea class="field__input" name="steps" rows="3" maxlength="1500" placeholder="Find a guide&#10;Cross the mountains">${esc((d.steps ?? []).map((s) => s.text).join('\n'))}</textarea></label>
        <div class="field-row">
          <label class="field"><span>Leads to</span><select class="field__input" name="place">${placeOptions(d.place, 'Nowhere in particular')}</select></label>
          <label class="field"><span>Status</span><select class="field__input" name="status">${Object.entries(QUEST_STATUS).map(([k, v]) => `<option value="${k}"${k === (d.status ?? 'active') ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        ${secretField(editing.id)}${shownBox(d)}${formEnd}
      </form>`;
    if (kind === 'npc') return `
      <form class="jr-form" data-kind="npc">
        <h3 class="jr-name">${isNew ? 'New person' : 'Edit person'}</h3>
        <div class="field-row">
          <label class="field"><span>Name</span><input class="field__input" name="title" maxlength="60" required value="${esc(d.title)}" placeholder="e.g. Old Mirna" /></label>
          <label class="field"><span>Who they are</span><input class="field__input" name="role" maxlength="60" value="${esc(d.role)}" placeholder="e.g. Innkeeper" /></label>
        </div>
        <label class="field"><span>Met at</span><select class="field__input" name="place">${placeOptions(d.place, 'Somewhere else')}</select></label>
        <div class="field-row">
          <label class="field"><span>Towards the party</span><select class="field__input" name="attitude">${Object.entries(ATTITUDE).map(([k, v]) => `<option value="${k}"${k === (d.attitude ?? 'neutral') ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field"><span>Alive?</span><select class="field__input" name="status">${Object.entries(ALIVE).map(([k, v]) => `<option value="${k}"${k === (d.status ?? 'alive') ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>What the party knows about them</span><textarea class="field__input" name="body" rows="5" maxlength="2000">${esc(d.body)}</textarea></label>
        ${secretField(editing.id)}${shownBox(d)}${formEnd}
      </form>`;
    if (kind === 'place') return `
      <form class="jr-form" data-kind="place">
        <h3 class="jr-name">${isNew ? 'New place' : 'Edit place'}</h3>
        <label class="field"><span>Name</span><input class="field__input" name="title" maxlength="60" required value="${esc(d.title)}" placeholder="e.g. The Rusty Anchor" /></label>
        <label class="field"><span>Where it is</span><select class="field__input" name="place">${placeOptions(d.place, 'Not on the map')}</select></label>
        <label class="field"><span>What the party knows about it</span><textarea class="field__input" name="body" rows="5" maxlength="2000">${esc(d.body)}</textarea></label>
        ${secretField(editing.id)}${shownBox(d)}${formEnd}
      </form>`;
    if (kind === 'creature') return `
      <form class="jr-form" data-kind="creature">
        <h3 class="jr-name">Notes on ${esc(monsters().find((m) => m.id === d.monster)?.name ?? 'this creature')}</h3>
        <label class="field"><span>What the party learned about it</span><textarea class="field__input" name="body" rows="7" maxlength="3000" placeholder="e.g. Hates fire. Fled when its leader fell.">${esc(d.body)}</textarea></label>
        ${secretField(editing.id)}${shownBox(d)}${formEnd}
      </form>`;
    if (kind === 'item') return `
      <form class="jr-form" data-kind="item">
        <h3 class="jr-name">${isNew ? 'New item' : 'Edit item'}</h3>
        <div class="field-row">
          <label class="field"><span>Name</span><input class="field__input" name="title" maxlength="80" required value="${esc(d.title)}" placeholder="e.g. An old diary" /></label>
          <label class="field"><span>Kind</span><select class="field__input" name="type">${Object.entries(ITEM_TYPE).map(([k, v]) => `<option value="${k}"${k === (d.type ?? 'book') ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Who has it</span><select class="field__input" name="holder"><option value="">The whole party</option>${heroes().map((h) => `<option value="${esc(h.id)}"${h.id === d.holder ? ' selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Found at</span><select class="field__input" name="place">${placeOptions(d.place, 'Not saying')}</select></label>
        </div>
        <label class="field"><span>What is written in it (or what it is)</span><textarea class="field__input" name="body" rows="9" maxlength="6000">${esc(d.body)}</textarea></label>
        ${secretField(editing.id)}${shownBox(d, 'The party has been given it')}${formEnd}
      </form>`;
    return `
      <form class="jr-form" data-kind="placenote">
        <h3 class="jr-name">Notes on ${esc(mapPlace(d.place)?.name ?? 'this place')}</h3>
        <label class="field"><span>What the party learned here</span><textarea class="field__input" name="body" rows="7" maxlength="3000">${esc(d.body)}</textarea></label>
        ${secretField(`map:${d.place}`)}${shownBox(d)}${formEnd}
      </form>`;
  }

  function renderPage() {
    sheet.classList.toggle('is-reading', Boolean(open || editing));
    if (editing) { pageEl.innerHTML = back + editorPage(); pageEl.querySelector('input:not([type=checkbox]), textarea')?.focus(); return; }
    let html = '';
    if (open?.type === 'map') { const m = mapPlace(open.id); if (m) html = mapPage(m); } else if (open?.type === 'creature') {
      const m = monsters().find((x) => x.id === open.id);
      if (m && (canEdit() || known(m))) html = creaturePage(m);
    } else if (open) {
      const e = byId(open.id);
      if (e && visible(e)) html = { quest: questPage, npc: npcPage, place: placePage, item: itemPage }[kindOf(e)]?.(e) ?? '';
    }
    if (!html) {
      open = null;
      sheet.classList.remove('is-reading');
      html = '<p class="jr-hint">Pick something from the list to read about it.</p>';
    }
    pageEl.innerHTML = (open ? back : '') + html;
    pageEl.scrollTop = 0;
  }

  function render() {
    renderList();
    renderPage();
  }

  // Opens an entry (switching to its section).
  function show(type, id) {
    open = { type, id };
    editing = null;
    if (!query) section = { quest: 'quests', npc: 'people', item: 'items', creature: 'creatures' }[type] ?? 'places';
    render();
  }

  // --- Saving --------------------------------------------------------------------------------------
  // Saves one row and keeps the local list in step.
  async function put(entry) {
    const row = await onSave(entry);
    const i = entries.findIndex((e) => e.id === row.id);
    if (i >= 0) entries[i] = row; else entries.push(row);
    return row;
  }
  // The DM's secret about something: saved as its own hidden row, removed when emptied.
  async function putSecret(about, text) {
    const old = entries.find((e) => kindOf(e) === 'secret' && e.data.about === about);
    if (text) await put({ id: old?.id, data: { kind: 'secret', about, body: text, shown: false } });
    else if (old) { await onDelete(old.id); entries.splice(entries.indexOf(old), 1); }
  }

  async function save(entry, secret) {
    try {
      const row = await put(entry);
      if (secret !== undefined) await putSecret(kindOf(row) === 'placenote' ? `map:${row.data.place}` : row.id, secret);
      editing = null;
      const kind = kindOf(row);
      if (kind === 'placenote') open = { type: 'map', id: row.data.place };
      else if (kind === 'creature') open = { type: 'creature', id: row.data.monster };
      else open = { type: kind, id: row.id };
      render();
    } catch (err) {
      const el = pageEl.querySelector('.jr-error');
      if (el) el.textContent = err.message; else alert(err.message);
    }
  }

  // --- Taps ----------------------------------------------------------------------------------------
  tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-section]');
    if (!b) return;
    section = b.dataset.section;
    query = '';
    searchEl.value = '';
    open = null;
    editing = null;
    render();
  });
  searchEl.addEventListener('input', () => { query = searchEl.value.trim().toLowerCase(); renderList(); });
  listEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sort]');
    if (b) { peopleSort = b.dataset.sort; renderList(); }
  });

  // --- Importing the owner's lore file (dev server only) --------------------------------------------
  let lore = null, importing = false;
  async function loadLore() {
    const loader = Object.values(LORE_FILES)[0];
    if (!loader || lore) return;
    lore = (await loader()).LORE;
    renderList();
  }
  // What the lore file would change in the journal: a list of steps (add, update, remove).
  // An entry is only updated or removed if it still looks the way the lore file left it
  // (`was`), so edits made in the app are never overwritten.
  const find = (kind, title) => entries.find((e) => kindOf(e) === kind && e.data.title === title);
  const secretText = (about) => entries.find((e) => kindOf(e) === 'secret' && e.data.about === about)?.data.body ?? '';
  function lorePlan() {
    if (!lore) return [];
    const steps = [];
    const ids = {}; // lore place keys → journal ids (filled in as places are found or added)
    const resolve = (ref) => ids[ref] ?? ref;
    // One entry of `kind` from the lore file: `data` is what it should hold, `about` gives its secret's key.
    const sync = (kind, l, data, about = (row) => row.id) => {
      const current = find(kind, l.title) ?? (l.was?.title ? find(kind, l.was.title) : null);
      if (!current) {
        steps.push({ what: 'add', run: async () => {
          const row = await put({ data: { ...data(), shown: false } });
          if (l.secret) await putSecret(about(row), l.secret);
          return row;
        } });
        return current;
      }
      const want = data();
      const differs = Object.keys(want).some((k) => (current.data[k] ?? '') !== (want[k] ?? ''));
      const untouched = current.data.body === (l.was?.body ?? l.body) && (!l.was?.title || current.data.title === l.was.title || current.data.title === l.title);
      if (differs && l.was && untouched) {
        steps.push({ what: 'update', run: async () => put({ id: current.id, data: { ...current.data, ...want } }) });
      }
      const sec = secretText(about(current));
      if (l.secret && sec !== l.secret && (!sec || sec === l.was?.secret)) {
        steps.push({ what: 'update', run: async () => putSecret(about(current), l.secret) });
      }
      return current;
    };
    for (const p of lore.places) {
      const row = sync('place', p, () => ({ kind: 'place', title: p.title, place: resolve(p.place), body: p.body }));
      if (row) ids[p.key] = row.id;
      else steps.at(-1).key = p.key; // the add step records the new id
    }
    for (const n of lore.notes) {
      const current = entries.find((e) => kindOf(e) === 'placenote' && e.data.place === n.place);
      const about = `map:${n.place}`;
      if (!current) {
        steps.push({ what: 'add', run: async () => { await put({ data: { kind: 'placenote', place: n.place, body: n.body, shown: false } }); if (n.secret) await putSecret(about, n.secret); } });
        continue;
      }
      if (n.was && current.data.body !== n.body && current.data.body === n.was.body) {
        steps.push({ what: 'update', run: async () => put({ id: current.id, data: { ...current.data, body: n.body } }) });
      }
      const sec = secretText(about);
      if (n.secret && sec !== n.secret && (!sec || sec === n.was?.secret)) steps.push({ what: 'update', run: async () => putSecret(about, n.secret) });
    }
    for (const p of lore.people) {
      sync('npc', p, () => ({ kind: 'npc', title: p.title, role: p.role, place: resolve(p.place), attitude: p.attitude, status: p.status, body: p.body }));
    }
    for (const x of lore.items ?? []) {
      sync('item', x, () => ({ kind: 'item', title: x.title, type: x.type, place: resolve(x.place ?? ''), body: x.body }));
    }
    for (const r of lore.removed ?? []) {
      const current = find(r.kind, r.title);
      if (current && (current.data.body ?? '') === (r.body ?? '')) {
        steps.push({ what: 'remove', run: async () => {
          await onDelete(current.id);
          entries.splice(entries.indexOf(current), 1);
          await putSecret(current.id, '');
        } });
      }
    }
    return steps;
  }
  const describePlan = (steps) => {
    const n = (w) => steps.filter((x) => x.what === w).length;
    return [n('add') && `add ${n('add')}`, n('update') && `update ${n('update')}`, n('remove') && `remove ${n('remove')}`].filter(Boolean).join(', ');
  };
  function drawImport() {
    const steps = canEdit() ? lorePlan() : [];
    importBtn.hidden = !steps.length && !importing;
    if (!importing) importBtn.textContent = `Update from lore (${steps.length})`;
  }
  importBtn.addEventListener('click', async () => {
    const steps = lorePlan();
    if (importing || !steps.length || !confirm(`From your lore file: ${describePlan(steps)} journal entries? New ones start hidden from the players. Anything you have edited in the app is left alone.`)) return;
    importing = true;
    let done = 0;
    try {
      // Places first, so people can point at them; the plan is worked out again after each
      // round, since new places get their ids only once saved.
      for (let round = 0; round < 300; round++) {
        const now = lorePlan();
        if (!now.length) break;
        for (const st of now) {
          await st.run();
          done++;
          importBtn.textContent = `Updating… ${done}`;
          if (st.key) break; // a new place: work out the plan again with its id
        }
      }
      alert(`Done: ${done} changes. New entries are hidden from the players until you press "Show to players".`);
    } catch (err) {
      alert(`The update stopped after ${done} changes: ${err.message}. Press the button again to finish.`);
    } finally {
      importing = false;
      render();
    }
  });

  newBtn.addEventListener('click', () => {
    const kind = SECTIONS.find((s) => s.id === section).kind;
    const blank = {
      quest: { title: '', body: '', status: 'active', place: '', steps: [], shown: true },
      npc: { kind: 'npc', title: '', role: '', place: '', attitude: 'neutral', status: 'alive', body: '', shown: true },
      place: { kind: 'place', title: '', place: '', body: '', shown: true },
      item: { kind: 'item', title: '', type: 'book', holder: '', place: '', body: '', shown: false },
    }[kind];
    editing = { data: blank };
    renderPage();
  });

  root.addEventListener('click', (e) => {
    const link = e.target.closest('[data-open]');
    if (link) { const [type, ...rest] = link.dataset.open.split(':'); show(type, rest.join(':')); return; }
    const toMap = e.target.closest('[data-map]');
    if (toMap) { onShowPlace(toMap.dataset.map); return; }
    const b = e.target.closest('[data-do], button.jr-tick');
    if (!b || !pageEl.contains(b)) return;
    if (b.dataset.do === 'back') { if (editing) editing = null; else open = null; render(); return; }
    if (b.dataset.do === 'cancel') { editing = null; renderPage(); return; }
    if (b.dataset.do === 'creatureshown' || b.dataset.do === 'creaturenote') {
      const m = open.id, e = creatureEntry(m);
      if (b.dataset.do === 'creaturenote') {
        editing = e ? { id: e.id, data: structuredClone(e.data) } : { data: { kind: 'creature', monster: m, body: '', shown: true } };
        renderPage();
      } else save({ id: e?.id, data: { kind: 'creature', monster: m, body: e?.data.body ?? '', shown: !known({ id: m }) } });
      return;
    }
    if (b.dataset.do === 'bestiary') { onOpenBestiary?.(open.id); return; }
    if (b.dataset.do === 'noteshown') {
      const note = entries.find((x) => kindOf(x) === 'placenote' && x.data.place === open.id);
      if (note) save({ id: note.id, data: { ...note.data, shown: note.data.shown === false } });
      return;
    }
    if (b.dataset.do === 'note') {
      const note = entries.find((x) => kindOf(x) === 'placenote' && x.data.place === open.id);
      editing = note ? { id: note.id, data: structuredClone(note.data) } : { data: { kind: 'placenote', place: open.id, body: '', shown: true } };
      renderPage();
      return;
    }
    const entry = open && open.type !== 'map' ? byId(open.id) : null;
    if (!entry) return;
    if (b.classList.contains('jr-tick')) {
      const steps = entry.data.steps.map((s, i) => (i === Number(b.dataset.step) ? { ...s, done: !s.done } : s));
      save({ id: entry.id, data: { ...entry.data, steps } });
      return;
    }
    switch (b.dataset.do) {
      case 'done': save({ id: entry.id, data: { ...entry.data, status: 'done', steps: (entry.data.steps ?? []).map((s) => ({ ...s, done: true })) } }); break;
      case 'active': save({ id: entry.id, data: { ...entry.data, status: 'active' } }); break;
      case 'shown': save({ id: entry.id, data: { ...entry.data, shown: entry.data.shown === false } }); break;
      case 'edit': editing = { id: entry.id, data: structuredClone(entry.data) }; renderPage(); break;
      case 'delete':
        if (!confirm(`Delete "${entry.data.title}" from the journal?`)) return;
        onDelete(entry.id).then(() => putSecret(entry.id, '')).then(() => {
          entries.splice(entries.indexOf(entry), 1);
          open = null;
          render();
        }).catch((err) => alert(err.message));
        break;
      default:
    }
  });

  pageEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, kind = f.dataset.kind, d = editing.data;
    const shown = f.shown.checked;
    let data;
    if (kind === 'quest') {
      const old = new Map((d.steps ?? []).map((s) => [s.text, s.done]));
      const steps = f.steps.value.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 20).map((text) => ({ text, done: old.get(text) ?? false }));
      data = { title: f.title.value.trim() || 'Untitled quest', body: f.body.value.trim(), steps, place: f.place.value, status: f.status.value, shown };
    } else if (kind === 'npc') {
      data = { kind, title: f.title.value.trim() || 'Someone', role: f.role.value.trim(), place: f.place.value, attitude: f.attitude.value, status: f.status.value, body: f.body.value.trim(), shown };
    } else if (kind === 'place') {
      data = { kind, title: f.title.value.trim() || 'A place', place: f.place.value, body: f.body.value.trim(), shown };
    } else if (kind === 'creature') {
      data = { kind, monster: d.monster, body: f.body.value.trim(), shown };
    } else if (kind === 'item') {
      data = { kind, title: f.title.value.trim() || 'Something', type: f.type.value, holder: f.holder.value, place: f.place.value, body: f.body.value, shown };
    } else {
      data = { kind, place: d.place, body: f.body.value.trim(), shown };
    }
    save({ id: editing.id, data }, f.secret ? f.secret.value.trim() : undefined);
  });

  return {
    render,
    // Someone changed the journal elsewhere: redraw (a page being written stays as it is).
    refresh() { renderList(); if (!editing) renderPage(); },
    // The party fought these Bestiary creatures: write them down (shown to the players).
    async meetCreatures(ids) {
      for (const m of new Set(ids)) {
        const e = creatureEntry(m);
        if (e?.data.shown) continue;
        await put({ id: e?.id, data: { kind: 'creature', monster: m, body: e?.data.body ?? '', shown: true } });
      }
      renderList();
    },
    // Opens a map place's page (from the place card on the map).
    openPlace(id) { query = ''; searchEl.value = ''; show('map', id); },
  };
}
