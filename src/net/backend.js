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

// Calls back with the new row whenever any character changes, on any device.
export function watchCharacters(onRow) {
  return supabase
    .channel('characters')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, (msg) => {
      if (msg.new?.id) onRow(msg.new);
    })
    .subscribe();
}
