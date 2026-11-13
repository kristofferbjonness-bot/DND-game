// The Journal: the party's quests, as cards. Active quests are big cards at the
// top, finished ones smaller below. Players read the quests the Dungeon Master
// has shown them; the DM writes, edits, completes and hides them. A quest can
// lead to a place on the world map ("Show on map").
import { icon } from '../ui/icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const STATUS = {
  active: { label: 'Active', icon: 'scroll' },
  done: { label: 'Completed', icon: 'prof' },
  failed: { label: 'Failed', icon: 'bestiary' },
};

// quests: the shared list of { id, data }.
// canEdit(): true for the Dungeon Master (not previewing).
// places(): world-map places [{ id, name }] the viewer may know; placeName(id) → name or null.
// onSave(quest) → saved row; onDelete(id); onShowPlace(id).
export function createJournalScreen(root, { quests, canEdit, places, placeName, onSave, onDelete, onShowPlace }) {
  root.innerHTML = `
    <div class="journal__inner">
      <header class="screen-head">
        <h2 class="screen-title">Journal</h2>
        <button type="button" class="btn btn--gold journal__new" hidden>${icon('plus')}New quest</button>
      </header>
      <div class="journal__list"></div>
    </div>
    <div class="journal__editor" hidden></div>`;
  const $ = (sel) => root.querySelector(sel);
  const listEl = $('.journal__list'), editorEl = $('.journal__editor'), newBtn = $('.journal__new');
  let editing = null; // a draft { id?, data }

  const visible = () => quests.filter((q) => canEdit() || q.data.shown !== false);

  function card(q, big) {
    const d = q.data, st = d.status ?? 'active';
    const steps = d.steps ?? [];
    const done = steps.filter((s) => s.done).length;
    const place = placeName(d.place);
    const edit = canEdit();
    return `
      <article class="quest quest--${st}${big ? ' quest--big' : ''}${d.shown === false ? ' is-hidden' : ''}" data-id="${esc(q.id)}">
        <span class="quest__seal">${icon(STATUS[st]?.icon ?? 'scroll')}</span>
        <p class="quest__kicker">${STATUS[st]?.label ?? 'Active'} quest${d.shown === false ? ` · ${icon('lock', 'inline')} hidden from players` : ''}</p>
        <h3 class="quest__title">${esc(d.title)}</h3>
        ${big || d.body ? `<div class="quest__page">
          ${d.body ? `<p class="quest__body">${esc(d.body).replace(/\n/g, '<br />')}</p>` : ''}
          ${steps.length ? `
            <ul class="quest__steps">
              ${steps.map((s, i) => `<li class="${s.done ? 'is-done' : ''}">
                ${edit ? `<button type="button" class="quest__tick" data-step="${i}" aria-label="Mark as ${s.done ? 'not done' : 'done'}">${s.done ? icon('check') : ''}</button>` : `<span class="quest__tick">${s.done ? icon('check') : ''}</span>`}
                <span>${esc(s.text)}</span></li>`).join('')}
            </ul>` : ''}
        </div>` : ''}
        <footer class="quest__foot">
          ${place ? `<button type="button" class="quest__place" data-place="${esc(d.place)}">${icon('pin')}${esc(place)}</button>` : '<span></span>'}
          ${steps.length ? `<span class="quest__progress" title="${done} of ${steps.length} steps done">${steps.map((s) => `<i class="${s.done ? 'is-on' : ''}"></i>`).join('')}</span>` : ''}
        </footer>
        ${edit ? `
          <div class="quest__tools">
            ${st === 'active' ? `<button type="button" data-do="done" title="Mark as completed">${icon('check')}<span>Done</span></button>` : `<button type="button" data-do="active" title="Make active again">${icon('scroll')}<span>Reopen</span></button>`}
            <button type="button" data-do="shown" title="${d.shown === false ? 'Show to players' : 'Hide from players'}">${icon(d.shown === false ? 'wis' : 'lock')}<span>${d.shown === false ? 'Show' : 'Hide'}</span></button>
            <button type="button" data-do="edit" title="Edit">${icon('pen')}<span>Edit</span></button>
            <button type="button" data-do="delete" class="quest__delete" title="Delete">×</button>
          </div>` : ''}
      </article>`;
  }

  function renderList() {
    const all = visible();
    const active = all.filter((q) => (q.data.status ?? 'active') === 'active');
    const past = all.filter((q) => (q.data.status ?? 'active') !== 'active');
    newBtn.hidden = !canEdit();
    listEl.innerHTML = all.length ? `
      ${active.length ? `<div class="quests quests--active">${active.map((q) => card(q, true)).join('')}</div>`
        : '<p class="journal__empty">No quest right now.</p>'}
      ${past.length ? `<h3 class="sheet__h journal__past">Finished</h3><div class="quests quests--past">${past.map((q) => card(q, false)).join('')}</div>` : ''}`
      : `<p class="journal__empty">${canEdit() ? 'No quests yet. Add the first one.' : 'No quests yet. The Dungeon Master will add them here.'}</p>`;
  }

  function renderEditor() {
    editorEl.hidden = !editing;
    if (!editing) { editorEl.innerHTML = ''; return; }
    const d = editing.data;
    editorEl.innerHTML = `
      <form class="quest-form">
        <h3 class="quest-form__title">${editing.id ? 'Edit quest' : 'New quest'}</h3>
        <label class="field"><span>Title</span><input class="field__input" name="title" maxlength="60" required value="${esc(d.title)}" placeholder="e.g. Reach Bartedalen" /></label>
        <label class="field"><span>What the party knows</span><textarea class="field__input" name="body" rows="3" maxlength="1500" placeholder="A few lines for the players">${esc(d.body)}</textarea></label>
        <label class="field"><span>Steps (one per line)</span><textarea class="field__input" name="steps" rows="3" maxlength="1500" placeholder="Find a guide&#10;Cross the mountains">${esc((d.steps ?? []).map((s) => s.text).join('\n'))}</textarea></label>
        <div class="field-row">
          <label class="field"><span>Leads to</span><select class="field__input" name="place">
            <option value="">Nowhere on the map</option>
            ${places().map((p) => `<option value="${esc(p.id)}"${p.id === d.place ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select></label>
          <label class="field"><span>Status</span><select class="field__input" name="status">
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === (d.status ?? 'active') ? ' selected' : ''}>${v.label}</option>`).join('')}
          </select></label>
        </div>
        <label class="toggle"><input type="checkbox" name="shown"${d.shown !== false ? ' checked' : ''} /> Players can see this quest</label>
        <p class="quest__error" role="alert"></p>
        <div class="quest-form__actions">
          <button type="button" class="btn" data-do="cancel">Cancel</button>
          <button type="submit" class="btn btn--gold quest__save">Save quest</button>
        </div>
      </form>`;
    editorEl.querySelector('[name=title]').focus();
  }

  async function save(quest) {
    try {
      const row = await onSave(quest);
      const i = quests.findIndex((q) => q.id === row.id);
      if (i >= 0) quests[i] = row; else quests.push(row);
      editing = null;
      render();
    } catch (err) {
      const el = editorEl.querySelector('.quest__error');
      if (el) el.textContent = err.message; else alert(err.message);
    }
  }

  newBtn.addEventListener('click', () => {
    editing = { data: { title: '', body: '', status: 'active', place: '', steps: [], shown: true } };
    renderEditor();
  });

  listEl.addEventListener('click', (e) => {
    const placeBtn = e.target.closest('[data-place]');
    if (placeBtn) { onShowPlace(placeBtn.dataset.place); return; }
    const q = quests.find((x) => x.id === e.target.closest('.quest')?.dataset.id);
    if (!q) return;
    const tick = e.target.closest('button.quest__tick');
    if (tick) {
      const steps = q.data.steps.map((s, i) => (i === Number(tick.dataset.step) ? { ...s, done: !s.done } : s));
      save({ id: q.id, data: { ...q.data, steps } });
      return;
    }
    const b = e.target.closest('[data-do]');
    if (!b) return;
    switch (b.dataset.do) {
      case 'done': save({ id: q.id, data: { ...q.data, status: 'done', steps: (q.data.steps ?? []).map((s) => ({ ...s, done: true })) } }); break;
      case 'active': save({ id: q.id, data: { ...q.data, status: 'active' } }); break;
      case 'shown': save({ id: q.id, data: { ...q.data, shown: q.data.shown === false } }); break;
      case 'edit': editing = { id: q.id, data: structuredClone(q.data) }; renderEditor(); break;
      case 'delete':
        if (!confirm(`Delete the quest "${q.data.title}"?`)) return;
        onDelete(q.id).then(() => {
          quests.splice(quests.indexOf(q), 1);
          render();
        }).catch((err) => alert(err.message));
        break;
      default:
    }
  });

  editorEl.addEventListener('click', (e) => {
    if (e.target === editorEl || e.target.closest('[data-do=cancel]')) { editing = null; renderEditor(); }
  });
  editorEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const old = new Map((editing.data.steps ?? []).map((s) => [s.text, s.done]));
    const steps = f.steps.value.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 20).map((text) => ({ text, done: old.get(text) ?? false }));
    save({
      id: editing.id,
      data: {
        title: f.title.value.trim() || 'Untitled quest', body: f.body.value.trim(), steps,
        place: f.place.value, status: f.status.value, shown: f.shown.checked,
      },
    });
  });

  const order = (q) => ({ active: 0, done: 1, failed: 2 }[q.data.status] ?? 0);
  function render() {
    quests.sort((a, b) => order(a) - order(b) || String(a.created_at).localeCompare(String(b.created_at)));
    renderList();
    renderEditor();
  }

  return {
    render,
    // Someone changed the quests elsewhere: redraw (an open editor stays as it is).
    refresh() { renderList(); },
  };
}
