// The online side of the game (Supabase): logins, the party's characters, and
// live updates when someone changes something. The database itself decides
// who may read or change what (see supabase/schema.sql), so the URL and the
// publishable key below are safe to have in the app.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bmuktbeyfpwovcrqnvsk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uL3hyIjaIce4lsPpQx_bNg_N88CVXvN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Friendly words for the errors people actually run into.
export function explain(error) {
  const m = error?.message ?? String(error);
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/already registered/i.test(m)) return 'That email already has an account. Log in instead.';
  if (/password should be at least/i.test(m)) return 'The password needs at least 6 characters.';
  if (/unable to validate email|invalid email/i.test(m)) return 'That email address does not look right.';
  if (/failed to fetch|network/i.test(m)) return 'No connection. Check the internet and try again.';
  return m;
}

// --- Logins ---------------------------------------------------------------------------

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(name, email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
  if (error) throw error;
  if (!data.session) await signIn(email, password);
}

export const signOut = () => supabase.auth.signOut();

// The logged-in person's profile ({ id, display_name, role }), or null.
export async function myProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from('profiles').select('id, display_name, role').eq('id', session.user.id).single();
  if (error) throw error;
  return data;
}

// --- Characters --------------------------------------------------------------------------
// A row is { id, owner, data }; `data` is the whole character sheet.

export async function loadCharacters() {
  const { data, error } = await supabase.from('characters').select('id, owner, data');
  if (error) throw error;
  return data;
}

// The Dungeon Master puts the starting heroes online the first time.
export async function seedCharacters(characters) {
  const { error } = await supabase.from('characters').insert(characters.map((c) => ({ id: c.id, data: c })));
  if (error) throw error;
}

export async function saveCharacter(character) {
  const { error } = await supabase.from('characters').update({ data: character }).eq('id', character.id);
  if (error) throw error;
}

export async function claimCharacter(id) {
  const { error } = await supabase.rpc('claim_character', { character_id: id });
  if (error) throw error;
}

// A hero from the character creator. A player becomes its owner straight away;
// the Dungeon Master's heroes are left free for a player to claim.
export async function createCharacter(character) {
  const { error } = await supabase.rpc('create_character', { sheet: character });
  if (error) {
    if (/create_character/.test(error.message)) throw new Error('The database is not ready for new heroes yet: the Dungeon Master must run supabase/creator.sql in Supabase.');
    throw error;
  }
}

export async function deleteCharacter(id) {
  const { error } = await supabase.from('characters').delete().eq('id', id);
  if (error) throw error;
}

// Calls back whenever any character changes, on any device: `onRow(row)` with the
// new row, or `onRow({ id, deleted: true })` when one is deleted.
export function watchCharacters(onRow) {
  return supabase
    .channel('characters')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, (msg) => {
      if (msg.eventType === 'DELETE') { if (msg.old?.id) onRow({ id: msg.old.id, deleted: true }); return; }
      if (msg.new?.id) onRow(msg.new);
    })
    .subscribe();
}

// --- Revealed places -------------------------------------------------------------------------
// Which places on the world map the players know (ids from src/world/locations.js).
// Everyone can read them; only the Dungeon Master can reveal or hide.

export async function loadRevealed() {
  const { data, error } = await supabase.from('revealed_places').select('place_id');
  if (error) throw error;
  return data.map((r) => r.place_id);
}

export async function setRevealed(ids, on) {
  const { error } = on
    ? await supabase.from('revealed_places').upsert(ids.map((place_id) => ({ place_id })))
    : await supabase.from('revealed_places').delete().in('place_id', ids);
  if (error) throw error;
}

// Calls back with (placeId, revealed) whenever the Dungeon Master reveals or hides a place.
export function watchRevealed(onChange) {
  return supabase
    .channel('revealed_places')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'revealed_places' }, (msg) => {
      if (msg.eventType === 'DELETE') { if (msg.old?.place_id) onChange(msg.old.place_id, false); }
      else if (msg.new?.place_id) onChange(msg.new.place_id, true);
    })
    .subscribe();
}

// --- The world: weather, time of day and where the party is ---------------------------------
// One row (id 1) holding { sky: {...}, party: { x, z, shown } }. Everyone reads it; the
// Dungeon Master changes it (supabase/world.sql).

export async function loadWorld() {
  const { data, error } = await supabase.from('world').select('data').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data?.data ?? {};
}

export async function saveWorld(data) {
  const { error } = await supabase.from('world').upsert({ id: 1, data });
  if (error) {
    if (/relation|world/.test(error.message)) throw new Error('Run supabase/world.sql in Supabase first, so everyone sees the weather and the party.');
    throw error;
  }
}

export function watchWorld(onChange) {
  return supabase
    .channel('world')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'world' }, (msg) => { if (msg.new?.data) onChange(msg.new.data); })
    .subscribe();
}

// --- The running fight (Dungeon Master only, supabase/session.sql) ---------------------------

export async function loadEncounter() {
  const { data, error } = await supabase.from('encounters').select('data').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

// Saves the fight, or clears it when `encounter` is null.
export async function saveEncounter(encounter) {
  const { error } = encounter
    ? await supabase.from('encounters').upsert({ id: 1, data: encounter })
    : await supabase.from('encounters').delete().eq('id', 1);
  if (error) throw error;
}

// --- Dice log (supabase/session.sql) -------------------------------------------------------------

export async function loadRolls(limit = 40) {
  const { data, error } = await supabase.from('rolls').select('*').order('id', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

export async function addRoll(roll) {
  const { data, error } = await supabase.from('rolls').insert(roll).select().single();
  if (error) throw error;
  return data;
}

export async function clearRolls() {
  const { error } = await supabase.from('rolls').delete().gt('id', 0);
  if (error) throw error;
}

// Calls back with ('INSERT', row) or ('DELETE', { id }).
export function watchRolls(onChange) {
  return supabase
    .channel('rolls')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rolls' }, (msg) => onChange(msg.eventType, msg.eventType === 'DELETE' ? msg.old : msg.new))
    .subscribe();
}

// --- Journal: quests, people and places (supabase/session.sql) ------------------------------------
// A row is { id, data, shown }; data.kind is missing for quests, or 'npc', 'place' or 'placenote'
// (see journalScreen.js).

export async function loadQuests() {
  const { data, error } = await supabase.from('quests').select('id, data, created_at').order('created_at');
  if (error) throw error;
  return data;
}

// Saves a quest; a new one (no id) gets its id back from the database.
export async function saveQuest(quest) {
  const row = { data: quest.data, shown: quest.data.shown !== false, ...(quest.id ? { id: quest.id } : {}) };
  const { data, error } = await supabase.from('quests').upsert(row).select('id, data, created_at').single();
  if (error) throw error;
  return data;
}

export async function deleteQuest(id) {
  const { error } = await supabase.from('quests').delete().eq('id', id);
  if (error) throw error;
}

// Calls back with ('INSERT' | 'UPDATE', row) or ('DELETE', { id }).
export function watchQuests(onChange) {
  return supabase
    .channel('quests')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quests' }, (msg) => onChange(msg.eventType, msg.eventType === 'DELETE' ? msg.old : msg.new))
    .subscribe();
}

// --- Live encounter ------------------------------------------------------------------------
// The Dungeon Master broadcasts what players may see of a fight; players who join
// late say hello and the DM answers with the current state. Nothing is stored.
export function encounterChannel({ onState, onHello }) {
  const ch = supabase.channel('encounter', { config: { broadcast: { self: false } } });
  if (onState) ch.on('broadcast', { event: 'state' }, (m) => onState(m.payload));
  if (onHello) ch.on('broadcast', { event: 'hello' }, () => onHello());
  let ready = false, pending = null;
  const send = (event, payload) => ch.send({ type: 'broadcast', event, payload });
  ch.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    ready = true;
    if (onState) send('hello', {});
    if (pending) { send('state', pending); pending = null; }
  });
  return {
    publish(state) { if (ready) send('state', state); else pending = state; },
  };
}

// --- Who is online (Supabase Realtime presence; nothing is stored) ----------------------------------
// Every logged-in app announces itself with its hero id (or as the DM). `onChange(heroIds)` gets the
// set of heroes whose players have the app open now.
export function presenceChannel({ uid, hero, dm }, onChange) {
  const ch = supabase.channel('online', { config: { presence: { key: uid } } });
  ch.on('presence', { event: 'sync' }, () => {
    const ids = new Set();
    for (const metas of Object.values(ch.presenceState())) for (const m of metas) if (m.hero) ids.add(m.hero);
    onChange(ids);
  });
  ch.subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ hero: hero ?? null, dm: Boolean(dm), at: Date.now() }); });
  return { leave() { supabase.removeChannel(ch); } };
}

// --- Bestiary ---------------------------------------------------------------------------------
// Generated monsters: { id, data } where data holds the stats and the figure recipe.

export async function loadMonsters() {
  const { data, error } = await supabase.from('monsters').select('id, data').order('created_at');
  if (error) throw error;
  return data;
}

export async function saveMonster(id, data) {
  const { error } = await supabase.from('monsters').upsert({ id, data });
  if (error) throw error;
}

export async function deleteMonster(id) {
  const { error } = await supabase.from('monsters').delete().eq('id', id);
  if (error) throw error;
}

export function watchMonsters(onChange) {
  return supabase
    .channel('monsters')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'monsters' }, (msg) => onChange(msg.eventType, msg.new?.id ? msg.new : msg.old))
    .subscribe();
}

// Asks the server (netlify/edge-functions/generate.js) to have Claude design a
// monster or a hero's look. Claude's answer streams in; `onProgress(characters)`
// is called as it grows. Resolves with the parsed JSON.
export const generateMonster = (prompt, onProgress) => generate('/api/generate-monster', { prompt }, onProgress);
export const generatePlace = (town, prompt, onProgress) => generate('/api/generate-place', { town, prompt }, onProgress);
export const generateHero = (request, onProgress) => generate('/api/generate-hero', request, onProgress);

async function generate(path, request, onProgress) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please log in again.');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(request),
  });
  if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
    let message = `The generator answered ${res.status}.`;
    try { message = (await res.json()).error ?? message; } catch { /* keep the status */ }
    throw new Error(message);
  }

  // Read the server-sent events and collect Claude's text.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      let event;
      try { event = JSON.parse(line.slice(5)); } catch { continue; }
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        text += event.delta.text;
        onProgress?.(text.length);
      } else if (event.type === 'error') {
        throw new Error(event.error?.message ?? 'Claude stopped with an error.');
      }
    }
  }
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Claude did not send an answer. Try again.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The answer came back garbled. Try again.');
  }
}
