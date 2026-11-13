-- Play sessions: the running fight is saved, and everyone shares a dice log.
-- Run once in the Supabase SQL editor (after schema.sql).

-- The fight the Dungeon Master is running (one row, id 1), so a reload or a
-- closed app does not lose it. Only the DM can see it: players get what they
-- may see of the fight live from the DM's app, as before.
create table if not exists public.encounters (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.encounters enable row level security;
create policy "encounters: the DM only" on public.encounters
  for all to authenticated using (public.is_dm()) with check (public.is_dm());

-- Every dice roll, shown to the whole table. Hidden rolls are the DM's alone.
create table if not exists public.rolls (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  who text not null,
  colour text,
  label text,
  dice jsonb not null,          -- [{ "sides": 20, "value": 17, "kept": true }, ...]
  bonus int not null default 0,
  total int not null,
  secret boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.rolls enable row level security;
create policy "rolls: everyone sees open rolls, the DM sees all" on public.rolls
  for select to authenticated using (not secret or user_id = auth.uid() or public.is_dm());
create policy "rolls: you add your own" on public.rolls
  for insert to authenticated with check (user_id = auth.uid() and (not secret or public.is_dm()));
create policy "rolls: the DM clears the log" on public.rolls
  for delete to authenticated using (public.is_dm());

alter publication supabase_realtime add table public.rolls;
