-- ---------------------------------------------------------------------------
-- 0017 — An empty days_of_week array slipped past the check constraint.
--
-- WHAT WAS WRONG
-- --------------
--   check (array_length(days_of_week, 1) >= 1)
--
-- `array_length('{}', 1)` returns NULL, not 0. `NULL >= 1` evaluates to NULL,
-- and a CHECK constraint treats NULL as satisfied. So a recurring ride with no
-- weekdays selected was accepted — and then generated nothing, for ever,
-- without any error. A planner would create the ride, see nothing appear, and
-- have no way to find out why.
--
-- The same mistake was present on trip_templates.
-- ---------------------------------------------------------------------------

alter table ride_templates drop constraint ride_templates_days_not_empty;
alter table ride_templates add constraint ride_templates_days_not_empty
  check (coalesce(array_length(days_of_week, 1), 0) >= 1);

alter table trip_templates drop constraint trip_templates_days_not_empty;
alter table trip_templates add constraint trip_templates_days_not_empty
  check (coalesce(array_length(days_of_week, 1), 0) >= 1);
