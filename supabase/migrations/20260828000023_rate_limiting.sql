-- ---------------------------------------------------------------------------
-- 0023 — Rate limiting (§53, docs/SECURITY.md §10).
--
-- WHY IN THE DATABASE. The obvious implementation is a Map in module scope,
-- and it is worthless here: the app runs as serverless functions, so each
-- instance would keep its own counter and an attacker spreading requests over
-- ten cold starts gets ten times the allowance. The database is the only piece
-- of shared state this product has.
--
-- WHY ONLY THE SERVICE ROLE MAY CALL IT. The limit and the window are
-- parameters. If `anon` could reach this function, two things follow: a caller
-- could pass a limit of a million and never be refused, and — worse — a caller
-- could burn someone *else's* allowance by recording hits against their
-- subject, locking them out of their own account. Keeping the function to
-- `service_role` means only our own server code decides what counts and how
-- much is allowed.
--
-- THE SUBJECT IS HASHED. A rate-limit table is exactly the kind of place where
-- a readable list of e-mail addresses quietly accumulates in something nobody
-- thinks of as personal data. Hashing is not a defence against someone who
-- already holds the service role; it is data minimisation (§38).
--
-- The hash uses the built-in `sha256()`, not pgcrypto's `digest()`. That is a
-- portability decision, and it bit once: `create extension pgcrypto` lands in
-- `extensions` on a Supabase project and in `public` on a bare cluster, so
-- there is no single spelling that resolves in a function with
-- `set search_path = ''`. Everything used below lives in `pg_catalog`, which is
-- always searched.
-- ---------------------------------------------------------------------------

create table rate_limit_hits (
  id bigserial primary key,
  bucket text not null,
  subject_hash bytea not null,
  occurred_at timestamptz not null default now()
);
alter table rate_limit_hits enable row level security;

create index rate_limit_hits_lookup
  on rate_limit_hits (bucket, subject_hash, occurred_at desc);
create index rate_limit_hits_sweep on rate_limit_hits (occurred_at);

-- Nobody reaches this table through the API. The explicit deny-all policy
-- states that intent rather than leaving it implied by the absence of a policy,
-- which reads the same to PostgreSQL but not to the next person.
revoke all on rate_limit_hits from authenticated, anon;
revoke all on sequence rate_limit_hits_id_seq from authenticated, anon;

create policy rate_limit_hits_no_access on rate_limit_hits
  for all to authenticated
  using (false)
  with check (false);

comment on table rate_limit_hits is
  'Rate limiting. Written only by public.consume_rate_limit, service role only.';

/**
 * Records an attempt and says whether it is allowed.
 *
 * Counts first, then records — so the request that crosses the line is itself
 * refused rather than being the first one let through. A refused attempt is
 * still recorded: repeatedly hammering a locked bucket keeps it locked, which
 * is the behaviour you want from a lockout.
 */
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash bytea := sha256(convert_to(p_bucket || ':' || p_subject, 'UTF8'));
  v_since timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count integer;
begin
  select count(*) into v_count
  from public.rate_limit_hits h
  where h.bucket = p_bucket
    and h.subject_hash = v_hash
    and h.occurred_at > v_since;

  insert into public.rate_limit_hits (bucket, subject_hash) values (p_bucket, v_hash);

  return v_count < p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

/**
 * Deletes hits that can no longer influence any decision.
 *
 * Called from the nightly job. Without it the table grows forever, and the
 * index that makes the limiter fast becomes the thing that makes it slow.
 */
create or replace function public.sweep_rate_limit_hits(p_older_than_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limit_hits
  where occurred_at < now() - make_interval(hours => p_older_than_hours);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.sweep_rate_limit_hits(integer) from public;
grant execute on function public.sweep_rate_limit_hits(integer) to service_role;
