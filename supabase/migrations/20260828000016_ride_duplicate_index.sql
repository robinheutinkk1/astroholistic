-- ---------------------------------------------------------------------------
-- 0016 — Make the ride duplicate guard usable by ON CONFLICT.
--
-- WHAT WAS WRONG
-- --------------
-- Migration 0006 created the guard as a PARTIAL unique index:
--
--   create unique index rides_template_date_unique
--     on rides (ride_template_id, scheduled_date)
--     where ride_template_id is not null;
--
-- The semantics were right, but PostgreSQL cannot infer a partial index from
-- `on conflict (ride_template_id, scheduled_date)` unless the statement repeats
-- the same WHERE clause — and PostgREST does not emit one. Ride generation
-- would therefore have failed on its very first run with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification", instead of quietly skipping the rides that already existed.
--
-- WHY A PLAIN INDEX IS EQUIVALENT
-- -------------------------------
-- The partial clause existed to let manually created rides (ride_template_id
-- null) repeat freely. A plain unique index already does that: NULLS DISTINCT
-- is the default, so two rows with a null template never conflict with each
-- other. The guard on generated rides is unchanged.
-- ---------------------------------------------------------------------------

drop index if exists rides_template_date_unique;

create unique index rides_template_date_unique
  on rides (ride_template_id, scheduled_date);

comment on index rides_template_date_unique is
  'Prevents duplicate generated rides. Deliberately NOT partial: ON CONFLICT '
  'cannot infer a partial index, and generation relies on that inference. '
  'Manual rides (ride_template_id null) are unaffected because NULLS DISTINCT '
  'is the default.';
