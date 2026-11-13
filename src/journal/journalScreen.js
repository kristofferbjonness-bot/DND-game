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
// Players see entries marked shown (RLS) and only map places they have discovered.
import { icon } from '../ui/icons.js';

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
];
const TIER_NAME = { continent: 'Continent', city: 'Town', local: 'Place', region: 'Land', water: 'Water' };

// entries: the shared list of { id, data, created_at }.
// canEdit(): true for the Dungeon Master (not previewing).
// mapPlaces(): the world-map places this viewer may see: [{ id, name, subtitle, text, tier, secret }].
// onSave(entry) → saved row; onDelete(id); onShowPlace(mapPlaceId).
export function createJournalScreen(root, { entries, canEdit, mapPlaces, onSave, onDelete, onShowPlace }) {
  root.innerHTML = `
    <div class="jr">
      <header class="jr__head">
        <h2 class="jr__title">Journal</h2>
        <label class="jr__search">${icon('wis', 'inline')}<input type="search" placeholder="Search people, places and quests" aria-label="Search the journal" /></label>
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
  const searchEl = $('.jr__search input'), newBtn = $('.jr__new');

  let section = 'quests';
  let open = null;      // what the page shows: { type: 'quest' | 'npc' | 'place' | 'map', id }
  let editing = null;   // a draft { id?, data } being written (DM)
  let query = '';

  // --- Looking things up -------------------------------------------------------------------------
  const visible = (e) => canEdit() || e.data.shown !== false;
  const all = (kind) => entries.filter((e) => kindOf(e) === kind && visible(e));
  const byId = (id) => entries.find((e) => e.id === id);
  const mapPlace = (id) => mapPlaces().find((p) => p.id === id) ?? null;
  const noteFor = (id) => entries.find((e) => kindOf(e) === 'placenote' && e.data.place === id && visible(e));

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
    return ps.length ? `<ul>${ps.map((n) => item('npc', n.id, {
      title: n.data.title,
      sub: [esc(n.data.role), esc(placeRef(n.data.place)?.name ?? ''), n.data.shown === false ? '🔒 hidden' : ''].filter(Boolean).join(' · '),
      mark: `<span class="jr-face jr-face--${n.data.attitude ?? 'unknown'}" title="${ATTITUDE[n.data.attitude] ?? 'Unknown'}">${esc(n.data.title[0] ?? '?')}</span>`,
      cls: `${n.data.status === 'dead' ? ' is-dead' : ''}${n.data.shown === false ? ' is-hidden' : ''}`,
    })).join('')}</ul>` : '';
  }

  function placeItems() {
    const known = mapPlaces()
      .filter((p) => matches(p.name, p.subtitle, p.text, noteFor(p.id)?.data.body))
      .map((p) => {
        const here = atPlace(p.id);
        const count = here.people.length ? `${here.people.length} ${here.people.length === 1 ? 'person' : 'people'}` : '';
        return item('map', p.id, {
          title: p.name,
          sub: [TIER_NAME[p.tier] ?? 'Place', count, p.secret ? '🔒 not discovered' : ''].filter(Boolean).join(' · '),
          mark: `<span class="jr-mark">${icon('map')}</span>`,
          cls: p.secret ? ' is-hidden' : '',
        });
      });
    const own = all('place')
      .filter((p) => matches(p.data.title, p.data.body, placeRef(p.data.place)?.name))
      .sort((a, b) => a.data.title.localeCompare(b.data.title))
      .map((p) => item('place', p.id, {
        title: p.data.title,
        sub: [placeRef(p.data.place) ? `In ${esc(placeRef(p.data.place).name)}` : '', p.data.shown === false ? '🔒 hidden' : ''].filter(Boolean).join(' · '),
        mark: `<span class="jr-mark">${icon('pin')}</span>`,
        cls: p.data.shown === false ? ' is-hidden' : '',
      }));
    return [
      own.length ? `<p class="jr-group">Places we found</p><ul>${own.join('')}</ul>` : '',
      known.length ? `<p class="jr-group">On the map</p><ul>${known.join('')}</ul>` : '',
    ].join('');
  }

  const ITEMS = { quests: questItems, people: peopleItems, places: placeItems };
  const EMPTY = {
    quests: 'No quests yet.',
    people: 'Nobody written down yet. People the party meets will appear here.',
    places: 'No places yet.',
  };

  function renderList() {
    const counts = {
      quests: all('quest').length,
      people: all('npc').length,
      places: mapPlaces().length + all('place').length,
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
    newBtn.hidden = !canEdit();
    newBtn.querySelector('span').textContent = s.newLabel;
  }

  // --- The page ------------------------------------------------------------------------------------
  const back = '<button type="button" class="jr-back" data-do="back">‹ Back</button>';
  const tools = (e, extra = '') => (canEdit() ? `
    <div class="jr-tools">
      ${extra}
      <button type="button" data-do="shown">${icon(e.data.shown === false ? 'wis' : 'lock')}${e.data.shown === false ? 'Show to players' : 'Hide from players'}</button>
      <button type="button" data-do="edit">${icon('pen')}Edit</button>
      <button type="button" data-do="delete" class="jr-tools__delete">Delete</button>
    </div>` : '');
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

  function placePage(p) {
    const d = p.data;
    return `
      <p class="jr-kicker">Place${d.shown === false ? ' · 🔒 hidden from players' : ''}</p>
      <h3 class="jr-name">${esc(d.title)}</h3>
      ${d.place ? `<p class="jr-meta">${placeLink(d.place, 'In ')}</p>` : ''}
      ${d.body ? `<p class="jr-text">${lines(d.body)}</p>` : '<p class="jr-text is-empty">Nothing written about it yet.</p>'}
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
      ${hereLists(m.id)}
      ${edit ? `<div class="jr-tools"><button type="button" data-do="note">${icon('pen')}${note ? 'Edit notes' : 'Write notes'}</button></div>` : ''}`;
  }

  // --- Writing (DM) --------------------------------------------------------------------------------
  // The place picker: map places and the DM's own places.
  const placeOptions = (current, none) => `
    <option value="">${none}</option>
    <optgroup label="On the map">${mapPlaces().map((p) => `<option value="${esc(p.id)}"${p.id === current ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>
    ${all('place').length ? `<optgroup label="Places we found">${all('place').filter((p) => p.id !== editing?.id).map((p) => `<option value="${esc(p.id)}"${p.id === current ? ' selected' : ''}>${esc(p.data.title)}</option>`).join('')}</optgroup>` : ''}`;
  const shownBox = (d, label = 'Players can see this') => `<label class="toggle"><input type="checkbox" name="shown"${d.shown !== false ? ' checked' : ''} /> ${label}</label>`;
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
        ${shownBox(d)}${formEnd}
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
        ${shownBox(d)}${formEnd}
      </form>`;
    if (kind === 'place') return `
      <form class="jr-form" data-kind="place">
        <h3 class="jr-name">${isNew ? 'New place' : 'Edit place'}</h3>
        <label class="field"><span>Name</span><input class="field__input" name="title" maxlength="60" required value="${esc(d.title)}" placeholder="e.g. The Rusty Anchor" /></label>
        <label class="field"><span>Where it is</span><select class="field__input" name="place">${placeOptions(d.place, 'Not on the map')}</select></label>
        <label class="field"><span>What the party knows about it</span><textarea class="field__input" name="body" rows="5" maxlength="2000">${esc(d.body)}</textarea></label>
        ${shownBox(d)}${formEnd}
      </form>`;
    return `
      <form class="jr-form" data-kind="placenote">
        <h3 class="jr-name">Notes on ${esc(mapPlace(d.place)?.name ?? 'this place')}</h3>
        <label class="field"><span>What the party learned here</span><textarea class="field__input" name="body" rows="7" maxlength="3000">${esc(d.body)}</textarea></label>
        ${shownBox(d)}${formEnd}
      </form>`;
  }

  function renderPage() {
    sheet.classList.toggle('is-reading', Boolean(open || editing));
    if (editing) { pageEl.innerHTML = back + editorPage(); pageEl.querySelector('input:not([type=checkbox]), textarea')?.focus(); return; }
    let html = '';
    if (open?.type === 'map') { const m = mapPlace(open.id); if (m) html = mapPage(m); } else if (open) {
      const e = byId(open.id);
      if (e && visible(e)) html = { quest: questPage, npc: npcPage, place: placePage }[kindOf(e)]?.(e) ?? '';
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
    if (!query) section = type === 'quest' ? 'quests' : type === 'npc' ? 'people' : 'places';
    render();
  }

  // --- Saving --------------------------------------------------------------------------------------
  async function save(entry) {
    try {
      const row = await onSave(entry);
      const i = entries.findIndex((e) => e.id === row.id);
      if (i >= 0) entries[i] = row; else entries.push(row);
      editing = null;
      const kind = kindOf(row);
      if (kind === 'placenote') open = { type: 'map', id: row.data.place };
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

  newBtn.addEventListener('click', () => {
    const kind = SECTIONS.find((s) => s.id === section).kind;
    const blank = {
      quest: { title: '', body: '', status: 'active', place: '', steps: [], shown: true },
      npc: { kind: 'npc', title: '', role: '', place: '', attitude: 'neutral', status: 'alive', body: '', shown: true },
      place: { kind: 'place', title: '', place: '', body: '', shown: true },
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
        onDelete(entry.id).then(() => {
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
    } else {
      data = { kind, place: d.place, body: f.body.value.trim(), shown };
    }
    save({ id: editing.id, data });
  });

  return {
    render,
    // Someone changed the journal elsewhere: redraw (a page being written stays as it is).
    refresh() { renderList(); if (!editing) renderPage(); },
    // Opens a map place's page (from the place card on the map).
    openPlace(id) { query = ''; searchEl.value = ''; show('map', id); },
  };
}
