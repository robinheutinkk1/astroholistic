-- ---------------------------------------------------------------------------
-- 0019 — Publish the tables the dispatch board listens to.
--
-- Supabase Realtime delivers row changes only for tables in the
-- `supabase_realtime` publication, and it evaluates RLS per subscriber before
-- delivering. A dispatcher therefore receives changes to their own
-- organisation's rides and nothing else — the same boundary as a query.
--
-- SCOPE IS DELIBERATE. Only rides, ride_events and trips are published: those
-- are what changes minute by minute while a dispatcher watches. Publishing
-- clients or drivers would stream personal data to every open board for
-- edits nobody is waiting to see.
--
-- SCALE WARNING (decision D-10). postgres_changes re-evaluates RLS for every
-- subscriber on every change. With hundreds of organisations each running
-- several boards, this is the first thing that will strain. The application
-- keeps all of it behind one hook so moving to Realtime Broadcast — one
-- channel per organisation, fed by a trigger — stays a single-file change.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Supabase creates this itself; the bare-PostgreSQL test environment does not.
    create publication supabase_realtime;
  end if;
end
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['rides', 'ride_events', 'trips'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

-- Replica identity FULL sends the previous row alongside the new one. Without
-- it an update arrives with only the primary key populated in `old`, and the
-- client cannot tell whether a ride moved into or out of a status bucket.
alter table rides replica identity full;
alter table trips replica identity full;
