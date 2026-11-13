// The Journal: the party's quests. Players read the quests the Dungeon Master
// has shown them; the DM writes, edits, completes and hides them. A quest can
// lead to a place on the world map ("Show on map").
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const STATUS = {
  active: { label: 'Active', icon: '📜' },
  done: { label: 'Completed', icon: '✅' },
  failed: { label: 'Failed', icon: '✖️' },
};

// quests: the shared list of { id, data }.
// canEdit(): true for the Dungeon Master (not previewing).
// places(): world-map places [{ id, name }] the viewer may know; placeName(id) → name or null.
// onSave(quest) → saved row; onDelete(id); onShowPlace(id).
export function createJournalScreen(root, { quests, canEdit, places, placeName, onSave, onDelete, onShowPlace }) {
  root.innerHTML = `
    <div class="journal__side">
      <div class="journal__head"><h2>Journal</h2><button type="button" class="journal__new" hidden>＋ New quest</button></div>
      <div class="journal__list"></div>
    </div>
    <div class="journal__page"></div>`;
  const $ = (sel) => root.querySelector(sel);
  const listEl = $('.journal__list'), pageEl = $('.journal__page'), newBtn = $('.journal__new');
  let selected = null, editing = null; // editing: a draft { id?, data }

  const visible = () => quests.filter((q) => canEdit() || q.data.shown !== false);
  const order = (q) => ({ active: 0, done: 1, failed: 2 }[q.data.status] ?? 0);

  function renderList() {
    const all = visible();
    if (!all.some((q) => q.id === selected)) selected = all.find((q) => q.data.status === 'active')?.id ?? all[0]?.id ?? null;
    const groups = ['active', 'done', 'failed'].map((st) => [st, all.filter((q) => (q.data.status ?? 'active') === st)]).filter(([, qs]) => qs.length);
    listEl.innerHTML = groups.length ? groups.map(([st, qs]) => `
      <p class="journal__group">${STATUS[st].label}</p>
      <ul>${qs.map((q) => {
        const steps = q.data.steps ?? [];
        const done = steps.filter((s) => s.done).length;
        return `
        <li><button type="button" class="quest-pick${q.id === selected && !editing ? ' is-on' : ''}${q.data.shown === false ? ' is-hidden' : ''}" data-id="${esc(q.id)}">
          <span class="quest-pick__icon">${STATUS[st].icon}</span>
          <span class="quest-pick__who"><b>${esc(q.data.title)}</b><small>${q.data.shown === false ? '🔒 Hidden from players · ' : ''}${steps.length ? `${done}/${steps.length} done` : esc(placeName(q.data.place) ?? '')}</small></span>
        </button></li>`;
      }).join('')}</ul>`).join('')
      : `<p class="journal__empty">${canEdit() ? 'No quests yet. Add the first one.' : 'No quests yet. The Dungeon Master will add them here.'}</p>`;
    newBtn.hidden = !canEdit();
  }

  function renderPage() {
    if (editing) { renderEditor(); return; }
    const q = quests.find((x) => x.id === selected);
    if (!q) { pageEl.innerHTML = ''; return; }
    const d = q.data, st = STATUS[d.status] ?? STATUS.active;
    const place = placeName(d.place);
    const edit = canEdit();
    pageEl.innerHTML = `
      <article class="quest">
        <p class="quest__kicker">${st.icon} ${st.label} quest${d.shown === false ? ' · 🔒 hidden from players' : ''}</p>
        <h2 class="quest__title">${esc(d.title)}</h2>
        ${place ? `<button type="button" class="quest__place" data-place="${esc(d.place)}">🗺️ ${esc(place)} · Show on map</button>` : ''}
        ${d.body ? `<p class="quest__body">${esc(d.body).replace(/\n/g, '<br />')}</p>` : ''}
        ${d.steps?.length ? `
          <ul class="quest__steps">
            ${d.steps.map((s, i) => `<li class="${s.done ? 'is-done' : ''}">
              ${edit ? `<button type="button" class="quest__tick" data-step="${i}" aria-label="Mark as ${s.done ? 'not done' : 'done'}">${s.done ? '✔' : ''}</button>` : `<span class="quest__tick">${s.done ? '✔' : ''}</span>`}
              <span>${esc(s.text)}</span></li>`).join('')}
          </ul>` : ''}
        ${edit ? `
          <div class="quest__tools">
            ${d.status === 'active' ? '<button type="button" data-do="done">✅ Completed</button>' : '<button type="button" data-do="active">📜 Make active again</button>'}
            <button type="button" data-do="shown">${d.shown === false ? '👁️ Show to players' : '🔒 Hide from players'}</button>
            <button type="button" data-do="edit">✏️ Edit</button>
            <button type="button" data-do="delete" class="quest__delete">Delete</button>
          </div>` : ''}
      </article>`;
  }

  function renderEditor() {
    const d = editing.data;
    pageEl.innerHTML = `
      <form class="quest quest--edit">
        <h2 class="quest__title">${editing.id ? 'Edit quest' : 'New quest'}</h2>
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
        <div class="quest__tools">
          <button type="submit" class="quest__save">Save quest</button>
          <button type="button" data-do="cancel">Cancel</button>
        </div>
      </form>`;
    pageEl.querySelector('[name=title]').focus();
  }

  async function save(quest) {
    try {
      const row = await onSave(quest);
      const i = quests.findIndex((q) => q.id === row.id);
      if (i >= 0) quests[i] = row; else quests.push(row);
      selected = row.id;
      editing = null;
      render();
    } catch (err) {
      const el = pageEl.querySelector('.quest__error');
      if (el) el.textContent = err.message; else alert(err.message);
    }
  }

  listEl.addEventListener('click', (e) => {
    const b = e.target.closest('.quest-pick');
    if (!b) return;
    selected = b.dataset.id;
    editing = null;
    render();
  });
  newBtn.addEventListener('click', () => {
    editing = { data: { title: '', body: '', status: 'active', place: '', steps: [], shown: true } };
    render();
  });

  pageEl.addEventListener('click', (e) => {
    const placeBtn = e.target.closest('[data-place]');
    if (placeBtn) { onShowPlace(placeBtn.dataset.place); return; }
    const q = quests.find((x) => x.id === selected);
    const tick = e.target.closest('button.quest__tick');
    if (tick && q) {
      const steps = q.data.steps.map((s, i) => (i === Number(tick.dataset.step) ? { ...s, done: !s.done } : s));
      save({ id: q.id, data: { ...q.data, steps } });
      return;
    }
    const b = e.target.closest('[data-do]');
    if (!b) return;
    if (b.dataset.do === 'cancel') { editing = null; render(); return; }
    if (!q) return;
    switch (b.dataset.do) {
      case 'done': save({ id: q.id, data: { ...q.data, status: 'done', steps: (q.data.steps ?? []).map((s) => ({ ...s, done: true })) } }); break;
      case 'active': save({ id: q.id, data: { ...q.data, status: 'active' } }); break;
      case 'shown': save({ id: q.id, data: { ...q.data, shown: q.data.shown === false } }); break;
      case 'edit': editing = { id: q.id, data: structuredClone(q.data) }; render(); break;
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

  pageEl.addEventListener('submit', (e) => {
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

  function render() {
    quests.sort((a, b) => order(a) - order(b) || String(a.created_at).localeCompare(String(b.created_at)));
    renderList();
    renderPage();
  }

  return {
    render,
    // Someone changed the quests elsewhere: redraw unless the DM is mid-edit.
    refresh() { if (!editing) render(); else renderList(); },
  };
}
