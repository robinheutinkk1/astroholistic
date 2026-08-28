-- ---------------------------------------------------------------------------
-- 0012 — Policies for rides, events, tags and the cross-cutting tables.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- Rides
-- ===========================================================================

create policy ride_templates_select on ride_templates for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('ride_templates.view'))::uuid[])
  or client_id = any ((select app.visible_client_ids())::uuid[])
);

create policy ride_templates_insert on ride_templates for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('ride_templates.manage'))::uuid[]));

create policy ride_templates_update on ride_templates for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('ride_templates.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('ride_templates.manage'))::uuid[]));

create policy ride_templates_delete on ride_templates for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('ride_templates.manage'))::uuid[]));

-- Four principals, one policy. Each arm is an explicit relation.
create policy rides_select on rides for select to authenticated
using (
  -- Planners and dispatchers, organisation-wide.
  organization_id = any ((select app.permitted_org_ids('rides.view'))::uuid[])
  -- A driver sees the rides assigned to them, and only those.
  or driver_id = any ((select app.driver_ids())::uuid[])
  -- Client portal, parent portal, care organisation portal.
  or client_id = any ((select app.visible_client_ids())::uuid[])
);

create policy rides_insert on rides for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('rides.create'))::uuid[]));

-- Note the asymmetry: a driver may UPDATE a ride assigned to them (that is how
-- status changes happen from the PWA), but the state machine trigger still
-- decides which transitions are legal. Portal users get no update policy at
-- all — they file a change_request instead (decision D-08).
create policy rides_update on rides for update to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('rides.update'))::uuid[])
  or driver_id = any ((select app.driver_ids())::uuid[])
)
with check (
  organization_id = any ((select app.permitted_org_ids('rides.update'))::uuid[])
  or driver_id = any ((select app.driver_ids())::uuid[])
);

create policy rides_delete on rides for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('rides.cancel'))::uuid[]));

-- Append-only: SELECT and INSERT only. UPDATE and DELETE have no policy, the
-- privileges are revoked, and a trigger raises regardless (three layers,
-- docs/DATABASE.md §9).
create policy ride_events_select on ride_events for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('rides.view'))::uuid[])
  or exists (
    select 1 from rides r
    where r.id = ride_events.ride_id
      and (
        r.driver_id = any ((select app.driver_ids())::uuid[])
        or r.client_id = any ((select app.visible_client_ids())::uuid[])
      )
  )
);

create policy ride_events_insert on ride_events for insert to authenticated
with check (
  exists (
    select 1 from rides r
    where r.id = ride_events.ride_id
      and r.organization_id = ride_events.organization_id
      and (
        r.organization_id = any ((select app.permitted_org_ids('rides.update'))::uuid[])
        or r.driver_id = any ((select app.driver_ids())::uuid[])
      )
  )
);


-- ===========================================================================
-- Tags
-- ===========================================================================

-- Deliberately staff-only. A driver never queries this table: the check-in
-- flow resolves a token server-side through a SECURITY DEFINER function, so
-- scanning identifies a tag without exposing the tag table (docs/NFC.md §6).
create policy nfc_tags_select on nfc_tags for select to authenticated
using (organization_id = any ((select app.permitted_org_ids('tags.view'))::uuid[]));

create policy nfc_tags_insert on nfc_tags for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('tags.manage'))::uuid[]));

create policy nfc_tags_update on nfc_tags for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('tags.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('tags.manage'))::uuid[]));

create policy nfc_tags_delete on nfc_tags for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('tags.manage'))::uuid[]));

create policy tag_assignments_select on tag_assignments for select to authenticated
using (organization_id = any ((select app.permitted_org_ids('tags.view'))::uuid[]));

create policy tag_assignments_insert on tag_assignments for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('tags.manage'))::uuid[]));

create policy tag_assignments_update on tag_assignments for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('tags.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('tags.manage'))::uuid[]));


-- ===========================================================================
-- Cross-cutting
-- ===========================================================================

-- Read-only for everyone, insert-only through the service layer. No UPDATE or
-- DELETE policy exists, so normal users can never rewrite history (§37).
create policy audit_logs_select on audit_logs for select to authenticated
using (organization_id = any ((select app.permitted_org_ids('audit.view'))::uuid[]));

create policy audit_logs_insert on audit_logs for insert to authenticated
with check (organization_id = any ((select app.member_org_ids())::uuid[]));

create policy notifications_select on notifications for select to authenticated
using (recipient_user_id = (select auth.uid()));

-- Marking your own notification as read. The WITH CHECK repeats the USING
-- clause so a row cannot be handed to another user on the way out.
create policy notifications_update on notifications for update to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));

create policy change_requests_select on change_requests for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('change_requests.view'))::uuid[])
  or requested_by_user_id = (select auth.uid())
  or client_id = any ((select app.visible_client_ids())::uuid[])
);

-- Portals may only file a request for a client they can already see, and only
-- in their own name.
create policy change_requests_insert on change_requests for insert to authenticated
with check (
  requested_by_user_id = (select auth.uid())
  and (
    organization_id = any ((select app.permitted_org_ids('change_requests.review'))::uuid[])
    or client_id = any ((select app.visible_client_ids())::uuid[])
  )
);

-- Only staff review. A requester cannot approve their own request.
create policy change_requests_update on change_requests for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('change_requests.review'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('change_requests.review'))::uuid[]));
