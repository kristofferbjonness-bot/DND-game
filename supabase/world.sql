-- The world: weather, time of day and where the party is on the map.
-- Run in the Supabase SQL editor (after schema.sql). Safe to run again.
--
-- One row (id 1) with everything in `data`. Everyone logged in can read it,
-- only the Dungeon Master can change it, and changes reach every phone live.

create table if not exists public.world (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.world enable row level security;

drop policy if exists "world: logged-in users can read" on public.world;
create policy "world: logged-in users can read" on public.world
  for select to authenticated using (true);
drop policy if exists "world: the DM changes it" on public.world;
create policy "world: the DM changes it" on public.world
  for all to authenticated using (public.is_dm()) with check (public.is_dm());

insert into public.world (id, data) values (1, '{}') on conflict (id) do nothing;

do $$ begin
  alter publication supabase_realtime add table public.world;
exception when duplicate_object then null; end $$;
