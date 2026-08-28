#!/usr/bin/env node
/**
 * Generates src/types/database.ts by introspecting a live PostgreSQL schema.
 *
 * WHY THIS EXISTS
 * ---------------
 * `supabase gen types typescript` is the authoritative generator and should be
 * used wherever it runs (`npm run db:types`). It pulls a postgres-meta Docker
 * image, which is unavailable in restricted environments — the same constraint
 * that made scripts/local-postgres.sh necessary.
 *
 * This emits the same shape supabase-js expects (Row / Insert / Update per
 * table, plus Enums), so switching between the two does not churn the file.
 */
import { writeFileSync } from 'node:fs';
import pg from 'pg';

const CONNECTION =
  process.env.TYPEGEN_DATABASE_URL ??
  'postgresql://postgres@localhost:5433/postgres?host=/tmp';
const OUTPUT = 'src/types/database.ts';

/** Postgres type → TypeScript type. Unknown types fall back to a named enum or string. */
const SCALAR_TYPES = new Map([
  ['uuid', 'string'],
  ['text', 'string'],
  ['citext', 'string'],
  ['character varying', 'string'],
  ['inet', 'string'],
  ['date', 'string'],
  ['time without time zone', 'string'],
  ['timestamp with time zone', 'string'],
  ['timestamp without time zone', 'string'],
  ['boolean', 'boolean'],
  ['smallint', 'number'],
  ['integer', 'number'],
  ['bigint', 'number'],
  ['numeric', 'number'],
  ['double precision', 'number'],
  ['real', 'number'],
  ['json', 'Json'],
  ['jsonb', 'Json'],
  ['bytea', 'string'],
]);

function tsType(column, enumNames) {
  const { data_type: dataType, udt_name: udtName } = column;

  if (dataType === 'ARRAY') {
    const element = udtName.replace(/^_/, '');
    if (enumNames.has(element)) return `Database['public']['Enums']['${element}'][]`;
    const mapped = SCALAR_TYPES.get(element) ?? mapUdt(element);
    return `${mapped}[]`;
  }
  if (dataType === 'USER-DEFINED' && enumNames.has(udtName)) {
    return `Database['public']['Enums']['${udtName}']`;
  }
  return SCALAR_TYPES.get(dataType) ?? mapUdt(udtName);
}

function mapUdt(udtName) {
  const byUdt = {
    uuid: 'string',
    text: 'string',
    citext: 'string',
    varchar: 'string',
    bool: 'boolean',
    int2: 'number',
    int4: 'number',
    int8: 'number',
    numeric: 'number',
    float4: 'number',
    float8: 'number',
    date: 'string',
    time: 'string',
    timestamptz: 'string',
    timestamp: 'string',
    json: 'Json',
    jsonb: 'Json',
    bytea: 'string',
    inet: 'string',
  };
  // pg_get_function_result prints SQL type names ("boolean", "timestamp with
  // time zone"), while information_schema.columns gives udt names ("bool",
  // "timestamptz"). Both reach this function, so both spellings must resolve —
  // otherwise a boolean RPC column silently types as string.
  return SCALAR_TYPES.get(udtName) ?? byUdt[udtName] ?? 'string';
}

/** `p_token_hash bytea, p_source event_source DEFAULT 'NFC'` → typed fields. */
function parseArgs(signature) {
  if (!signature || signature.trim() === '') return [];
  return signature.split(',').map((raw) => {
    const part = raw.trim();
    const optional = / DEFAULT /i.test(part);
    const [name, ...rest] = part
      .replace(/ DEFAULT .*/i, '')
      .trim()
      .split(/\s+/);
    return { name, optional, type: mapUdt(rest.join(' ').replace(/\[\]$/, '')) };
  });
}

/** `TABLE(outcome checkin_outcome, ride_id uuid, ...)` → an object type. */
function parseResult(result, returnsSet, enums) {
  const table = /^TABLE\((.*)\)$/is.exec(result ?? '');
  if (!table) {
    const scalar = mapUdt((result ?? 'text').replace(/^SETOF /i, ''));
    return returnsSet ? `${scalar}[]` : scalar;
  }
  const fields = table[1].split(',').map((raw) => {
    const [name, ...rest] = raw.trim().split(/\s+/);
    const type = rest.join(' ');
    const mapped = enums.has(type)
      ? `Database['public']['Enums']['${type}']`
      : mapUdt(type);
    return `${name}: ${mapped} | null`;
  });
  return `{ ${fields.join('; ')} }[]`;
}

const client = new pg.Client({ connectionString: CONNECTION });
await client.connect();

const { rows: enums } = await client.query(`
  -- string_agg rather than array_agg: node-postgres returns a text[] as a raw
  -- string for some array types, and splitting a delimiter we control is more
  -- predictable than depending on its array parsing.
  select t.typname as name,
         string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
  order by t.typname
`);
for (const e of enums) {
  e.labels = String(e.labels).split(',');
}
const enumNames = new Set(enums.map((e) => e.name));

// Functions exposed through PostgREST. Without these, every .rpc() call is
// untyped and its result collapses to `never` at the call site.
const { rows: functions } = await client.query(`
  select p.proname as name,
         pg_get_function_arguments(p.oid) as args,
         pg_get_function_result(p.oid) as result,
         p.proretset as returns_set
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and has_function_privilege('authenticated', p.oid, 'execute')
    -- Extension-owned functions (pgcrypto, citext, ...) are not ours to type,
    -- and their overloads would collide on name.
    and not exists (
      select 1 from pg_depend d
      where d.objid = p.oid and d.deptype = 'e'
    )
  order by p.proname
`);

// Overloads share a name, which cannot be expressed in this type shape. Keep
// the first and warn, rather than emitting a duplicate key.
const seenFunctions = new Set();
const uniqueFunctions = functions.filter((fn) => {
  if (seenFunctions.has(fn.name)) {
    console.warn(`Skipping overload of ${fn.name}(); only the first is typed.`);
    return false;
  }
  seenFunctions.add(fn.name);
  return true;
});

const { rows: tables } = await client.query(`
  select tablename as name from pg_tables
  where schemaname = 'public' order by tablename
`);

const { rows: columns } = await client.query(`
  select table_name, column_name, data_type, udt_name, is_nullable, column_default,
         is_identity, is_generated
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position
`);

// Foreign keys drive the Relationships block, which is what lets supabase-js
// type a nested select like `.select('organizations!inner (name)')`. Without
// them every embedded relation resolves to `never`.
const { rows: foreignKeys } = await client.query(`
  select
    con.conname as constraint_name,
    src.relname as table_name,
    string_agg(srcatt.attname, '|' order by u.ord) as columns,
    tgt.relname as referenced_table,
    string_agg(tgtatt.attname, '|' order by u.ord) as referenced_columns,
    exists (
      select 1 from pg_index i
      where i.indrelid = con.conrelid
        and i.indisunique
        and i.indkey::int2[] @> con.conkey
        and array_length(con.conkey, 1) = i.indnatts
    ) as is_one_to_one
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class tgt on tgt.oid = con.confrelid
  join pg_namespace n on n.oid = src.relnamespace
  cross join lateral unnest(con.conkey, con.confkey) with ordinality as u(src_att, tgt_att, ord)
  join pg_attribute srcatt on srcatt.attrelid = con.conrelid and srcatt.attnum = u.src_att
  join pg_attribute tgtatt on tgtatt.attrelid = con.confrelid and tgtatt.attnum = u.tgt_att
  where con.contype = 'f' and n.nspname = 'public'
  group by con.conname, src.relname, tgt.relname, con.conrelid, con.conkey
  order by src.relname, con.conname
`);

const foreignKeysByTable = new Map();
for (const fk of foreignKeys) {
  // node-postgres hands some array types back as raw strings, so aggregate with
  // a delimiter we control and split it here instead.
  fk.columns = String(fk.columns).split('|');
  fk.referenced_columns = String(fk.referenced_columns).split('|');
  if (!foreignKeysByTable.has(fk.table_name)) foreignKeysByTable.set(fk.table_name, []);
  foreignKeysByTable.get(fk.table_name).push(fk);
}

const byTable = new Map();
for (const column of columns) {
  if (!byTable.has(column.table_name)) byTable.set(column.table_name, []);
  byTable.get(column.table_name).push(column);
}

const lines = [
  '/**',
  ' * GENERATED FILE — do not edit by hand.',
  ' *',
  ' * Regenerate with `npm run db:types` (Supabase CLI, authoritative) or',
  ' * `npm run db:types:local` (introspection fallback, see',
  ' * scripts/generate-db-types.mjs).',
  ' *',
  ' * The schema is the source of truth (masterprompt §41). A hand-edited type',
  ' * that drifts from the database is worse than no type at all.',
  ' */',
  '',
  'export type Json =',
  '  | string',
  '  | number',
  '  | boolean',
  '  | null',
  '  | { [key: string]: Json | undefined }',
  '  | Json[];',
  '',
  'export interface Database {',
  '  public: {',
  '    Tables: {',
];

for (const { name } of tables) {
  const cols = byTable.get(name) ?? [];
  lines.push(`      ${name}: {`);

  lines.push('        Row: {');
  for (const c of cols) {
    const nullable = c.is_nullable === 'YES' ? ' | null' : '';
    lines.push(`          ${c.column_name}: ${tsType(c, enumNames)}${nullable};`);
  }
  lines.push('        };');

  // Insert: a column is optional when it has a default, is generated, or is nullable.
  lines.push('        Insert: {');
  for (const c of cols) {
    const hasDefault =
      c.column_default !== null || c.is_identity === 'YES' || c.is_generated === 'ALWAYS';
    const optional = hasDefault || c.is_nullable === 'YES' ? '?' : '';
    const nullable = c.is_nullable === 'YES' ? ' | null' : '';
    lines.push(
      `          ${c.column_name}${optional}: ${tsType(c, enumNames)}${nullable};`,
    );
  }
  lines.push('        };');

  lines.push('        Update: {');
  for (const c of cols) {
    const nullable = c.is_nullable === 'YES' ? ' | null' : '';
    lines.push(`          ${c.column_name}?: ${tsType(c, enumNames)}${nullable};`);
  }
  lines.push('        };');

  // supabase-js resolves its query helper types through Relationships; without
  // this block, every table collapses to `never` at the call site and a nested
  // select cannot be typed at all.
  const tableForeignKeys = foreignKeysByTable.get(name) ?? [];
  if (tableForeignKeys.length === 0) {
    lines.push('        Relationships: [];');
  } else {
    lines.push('        Relationships: [');
    for (const fk of tableForeignKeys) {
      const cols = fk.columns.map((c) => `'${c}'`).join(', ');
      const refCols = fk.referenced_columns.map((c) => `'${c}'`).join(', ');
      lines.push('          {');
      lines.push(`            foreignKeyName: '${fk.constraint_name}';`);
      lines.push(`            columns: [${cols}];`);
      lines.push(`            isOneToOne: ${fk.is_one_to_one ? 'true' : 'false'};`);
      lines.push(`            referencedRelation: '${fk.referenced_table}';`);
      lines.push(`            referencedColumns: [${refCols}];`);
      lines.push('          },');
    }
    lines.push('        ];');
  }
  lines.push('      };');
}

lines.push('    };');
lines.push('    Views: Record<string, never>;');

if (uniqueFunctions.length === 0) {
  lines.push('    Functions: Record<string, never>;');
} else {
  lines.push('    Functions: {');
  for (const fn of uniqueFunctions) {
    lines.push(`      ${fn.name}: {`);
    lines.push('        Args: {');
    for (const arg of parseArgs(fn.args)) {
      lines.push(`          ${arg.name}${arg.optional ? '?' : ''}: ${arg.type};`);
    }
    lines.push('        };');
    lines.push(`        Returns: ${parseResult(fn.result, fn.returns_set, enumNames)};`);
    lines.push('      };');
  }
  lines.push('    };');
}
lines.push('    Enums: {');
for (const e of enums) {
  lines.push(`      ${e.name}: ${e.labels.map((l) => `'${l}'`).join(' | ')};`);
}
lines.push('    };');
lines.push('    CompositeTypes: Record<string, never>;');
lines.push('  };');
lines.push('}');
lines.push('');
lines.push('/** Convenience aliases so features do not repeat the deep index type. */');
lines.push("export type Tables<T extends keyof Database['public']['Tables']> =");
lines.push("  Database['public']['Tables'][T]['Row'];");
lines.push("export type TablesInsert<T extends keyof Database['public']['Tables']> =");
lines.push("  Database['public']['Tables'][T]['Insert'];");
lines.push("export type TablesUpdate<T extends keyof Database['public']['Tables']> =");
lines.push("  Database['public']['Tables'][T]['Update'];");
lines.push("export type Enums<T extends keyof Database['public']['Enums']> =");
lines.push("  Database['public']['Enums'][T];");
lines.push('');

writeFileSync(OUTPUT, lines.join('\n'));
await client.end();
console.log(`Wrote ${OUTPUT}: ${tables.length} tables, ${enums.length} enums`);
