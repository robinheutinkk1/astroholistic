# Supabase

The database is the security boundary for this platform (docs/SECURITY.md).
Everything in here is versioned SQL — there are no manual changes in the
Supabase dashboard (masterprompt §40).

## Layout

| Path          | Contents                                                      |
| ------------- | ------------------------------------------------------------- |
| `migrations/` | Numbered, forward-only SQL migrations. The source of truth.   |
| `tests/`      | pgTAP tests for policies and constraints (`npm run db:test`). |
| `seed/`       | Development seed data. Fictional people only (§55).           |

## Local development

No cloud project is required to build or test. The CLI runs the whole stack
(Postgres, Auth, Realtime, Storage) in Docker:

```bash
npm run db:start     # start the local stack
npm run db:reset     # drop, re-run every migration, re-seed
npm run db:types     # regenerate src/types/database.ts
npm run db:test      # run the pgTAP suite
npm run db:stop
```

`npm run db:reset` must succeed from an empty database on every commit. If it
does not, a migration is not reproducible and the change is not finished.

## Rules

1. Every table that holds tenant data has `organization_id` and
   `enable row level security` **in the same migration that creates it**. A
   table that exists for even one migration without RLS is how isolation leaks
   silently.
2. Policies are written per command (`select`, `insert`, `update`, `delete`).
   `for all` hides gaps.
3. Every `insert` and `update` policy has a `with check` clause. A `using`
   clause alone still allows writing a row _into_ another tenant.
4. Helper functions are called as `(select app.fn())` so Postgres evaluates them
   once per statement instead of once per row (docs/SECURITY.md §4).
5. Migrations are never edited after being merged. Fix forward.
