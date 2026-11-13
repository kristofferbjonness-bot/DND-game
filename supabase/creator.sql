-- Character creator: lets a player add their own new hero.
-- Run once in the Supabase SQL editor (after schema.sql).
--
-- Players cannot insert into the characters table directly, so this function
-- does it for them, with the rules checked here:
--   * a player gets one hero, which becomes theirs straight away;
--   * the Dungeon Master's new heroes are left free, for a player to claim.

create or replace function public.create_character(sheet jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  new_id text := sheet ->> 'id';
begin
  if auth.uid() is null then
    raise exception 'Please log in again';
  end if;
  if new_id is null or new_id !~ '^[a-z0-9-]{1,60}$' then
    raise exception 'That hero has no proper id';
  end if;
  if octet_length(sheet::text) > 300000 then
    raise exception 'That hero is too big to save';
  end if;
  if public.is_dm() then
    insert into public.characters (id, data) values (new_id, sheet);
  else
    if exists (select 1 from public.characters where owner = auth.uid()) then
      raise exception 'You already play a character';
    end if;
    insert into public.characters (id, owner, data) values (new_id, auth.uid(), sheet);
  end if;
  return new_id;
end;
$$;

grant execute on function public.create_character(jsonb) to authenticated;
