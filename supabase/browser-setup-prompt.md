Please set up a Supabase backend for my game "DND World" (a browser game hosted at https://cool-jelly-22cdf9.netlify.app). Work in my browser, step by step, and check each step worked before moving on.

Ground rules:
- I handle all logins and passwords myself. When a page asks me to sign in, or asks for a password, stop and let me do it. Never type, invent, or repeat a password in the chat.
- Use the FREE plan. Do not enter payment details or upgrade anything.
- Run the SQL below exactly as written. If it gives an error, stop and tell me the exact error message. Do not edit the SQL to make it pass.
- At the end, NEVER show me or copy the "secret" / "service_role" key or the database password. I only need the public values listed in step 7.

Steps:

1. Go to https://supabase.com/dashboard and let me sign in (or sign up, e.g. with GitHub).

2. Create a new project:
   - Name: dnd-world
   - Region: the one closest to Norway (Stockholm / eu-north-1 if offered, otherwise Frankfurt / eu-central-1)
   - Database password: use the "Generate a password" button, then tell me to save it in my password manager before continuing.
   - Plan: Free
   Wait until the project has finished setting up.

3. Open "SQL Editor", start a new query, paste the whole SQL block below, and click Run. It should finish with "Success. No rows returned".

4. Open "Authentication":
   - Under Sign In / Providers → Email: make sure Email is enabled, and turn OFF "Confirm email" (my friends should be able to log in right away). Save.
   - Under URL Configuration: set Site URL to https://cool-jelly-22cdf9.netlify.app and add these Redirect URLs:
       https://cool-jelly-22cdf9.netlify.app/**
       http://localhost:5199/**
     Save.

5. Check the result:
   - "Table Editor" shows these 5 tables in the public schema, each with RLS enabled: profiles, characters, revealed_places, secrets, dm_notes.
   - "Database" → "Publications" → supabase_realtime includes: characters, revealed_places, secrets.

6. Do NOT create any users or add any rows. The game will do that.

7. Finally, open Project Settings → API (or "API Keys") and tell me:
   - the Project URL (looks like https://xxxxxxxx.supabase.co)
   - the publishable key (starts with sb_publishable_), or if the project only shows legacy keys, the "anon public" key
   These two are meant to be public. Again: do not show the secret / service_role key.

SQL to run in step 3:

```sql
-- DND World: database for logins, characters and Dungeon Master secrets.
-- Run once in the Supabase SQL editor on a new project.
--
-- Who can do what (enforced by the database itself, not by the app):
--   * Everyone logged in can see the party's characters and the revealed places.
--   * A player can edit only the character they own.
--   * Only the Dungeon Master can change ownership, reveal places, read and
--     write DM notes, and see secrets that are not revealed yet.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One profile per login. New logins are players; the DM is promoted by hand.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'player' check (role in ('player', 'dm')),
  created_at timestamptz not null default now()
);

-- A character sheet, stored whole as JSON (same shape as src/data/characters.js).
-- Each player owns at most one character.
create table public.characters (
  id text primary key,
  owner uuid unique references public.profiles (id) on delete set null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Places on the map the party has discovered (ids from src/world/locations.js).
create table public.revealed_places (
  place_id text primary key,
  revealed_at timestamptz not null default now()
);

-- Plot secrets. Players only see the ones marked revealed.
create table public.secrets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  revealed boolean not null default false,
  created_at timestamptz not null default now()
);

-- The Dungeon Master's private notes, keyed by what they are about (e.g. 'place:razz').
create table public.dm_notes (
  key text primary key,
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers and triggers
-- ---------------------------------------------------------------------------

-- True when the logged-in user is the Dungeon Master.
create or replace function public.is_dm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'dm');
$$;

-- Every new login gets a player profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep characters.updated_at current.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger characters_touch
  before update on public.characters
  for each row execute function public.touch_updated_at();

-- Players may not hand characters around; only claiming a free one is allowed.
create or replace function public.guard_character_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner is distinct from old.owner
     and not public.is_dm()
     and not (old.owner is null and new.owner = auth.uid()) then
    raise exception 'Only the Dungeon Master can change who plays a character';
  end if;
  return new;
end;
$$;

create trigger characters_guard
  before update on public.characters
  for each row execute function public.guard_character_owner();

-- A player claims a free character as theirs (one each).
create or replace function public.claim_character(character_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.characters where owner = auth.uid()) then
    raise exception 'You already play a character';
  end if;
  update public.characters set owner = auth.uid() where id = character_id and owner is null;
  if not found then
    raise exception 'That character is already taken';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.revealed_places enable row level security;
alter table public.secrets enable row level security;
alter table public.dm_notes enable row level security;

create policy "profiles: logged-in users can read" on public.profiles
  for select to authenticated using (true);
create policy "profiles: the DM can edit" on public.profiles
  for update to authenticated using (public.is_dm()) with check (public.is_dm());

create policy "characters: logged-in users can read" on public.characters
  for select to authenticated using (true);
create policy "characters: the DM can do anything" on public.characters
  for all to authenticated using (public.is_dm()) with check (public.is_dm());
create policy "characters: players edit their own" on public.characters
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create policy "revealed places: logged-in users can read" on public.revealed_places
  for select to authenticated using (true);
create policy "revealed places: the DM manages" on public.revealed_places
  for all to authenticated using (public.is_dm()) with check (public.is_dm());

create policy "secrets: players see revealed ones, the DM sees all" on public.secrets
  for select to authenticated using (revealed or public.is_dm());
create policy "secrets: the DM manages" on public.secrets
  for all to authenticated using (public.is_dm()) with check (public.is_dm());

create policy "dm notes: the DM only" on public.dm_notes
  for all to authenticated using (public.is_dm()) with check (public.is_dm());

-- ---------------------------------------------------------------------------
-- Live updates: phones hear about changes straight away.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.characters, public.revealed_places, public.secrets;
```
