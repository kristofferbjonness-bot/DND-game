-- Play sessions: the running fight is saved, everyone shares a dice log, and
-- the journal holds the party's quests.
-- Run in the Supabase SQL editor (after schema.sql). Safe to run again.

-- The fight the Dungeon Master is running (one row, id 1), so a reload or a
-- closed app does not lose it. Only the DM can see it: players get what they
-- may see of the fight live from the DM's app.
create table if not exists public.encounters (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.encounters enable row level security;
drop policy if exists "encounters: the DM only" on public.encounters;
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
drop policy if exists "rolls: everyone sees open rolls, the DM sees all" on public.rolls;
create policy "rolls: everyone sees open rolls, the DM sees all" on public.rolls
  for select to authenticated using (not secret or user_id = auth.uid() or public.is_dm());
drop policy if exists "rolls: you add your own" on public.rolls;
create policy "rolls: you add your own" on public.rolls
  for insert to authenticated with check (user_id = auth.uid() and (not secret or public.is_dm()));
drop policy if exists "rolls: the DM clears the log" on public.rolls;
create policy "rolls: the DM clears the log" on public.rolls
  for delete to authenticated using (public.is_dm());

-- The journal: quests. Players see the ones marked shown; the DM sees and edits all.
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,          -- { title, body, status, place, steps: [{ text, done }], shown }
  shown boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.quests enable row level security;
drop policy if exists "quests: players see shown ones, the DM sees all" on public.quests;
create policy "quests: players see shown ones, the DM sees all" on public.quests
  for select to authenticated using (shown or public.is_dm());
drop policy if exists "quests: the DM writes them" on public.quests;
create policy "quests: the DM writes them" on public.quests
  for all to authenticated using (public.is_dm()) with check (public.is_dm());

-- The party's first quest.
insert into public.quests (data, shown)
select '{"title": "Reach Bartedalen", "body": "The party is on the road to Bartedalen.", "status": "active", "place": "bartedalen", "steps": [{"text": "Travel to Bartedalen", "done": false}], "shown": true}'::jsonb, true
where not exists (select 1 from public.quests);

do $$ begin
  alter publication supabase_realtime add table public.rolls;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.quests;
exception when duplicate_object then null; end $$;
