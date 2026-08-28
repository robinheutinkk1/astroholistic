#!/usr/bin/env node
/**
 * Bundelt de migraties tot een paar grote SQL-bestanden.
 *
 * WAAROM. `supabase db push` is de normale weg, maar die vraagt een terminal en
 * een gekoppeld project. Wie dat niet heeft, kan de SQL ook in de SQL Editor van
 * Supabase plakken — en 26 keer plakken is 26 kansen om er één over te slaan.
 *
 * WAAROM NIET ÉÉN BESTAND. Samen zijn de migraties zo'n 175 kB. Dat gaat in de
 * editor, maar als er iets misgaat weet je niet waar. In stukken is een fout
 * meteen te plaatsen, en je kunt verdergaan waar je gebleven was.
 *
 * De volgorde is heilig: bestandsnaam oplopend, precies zoals `db push` doet.
 * De uitvoer is afgeleid en hoort niet in git — zie .gitignore.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'supabase/migrations';
const OUTPUT = process.argv[2] ?? 'dist-sql';
const CHUNKS = Number(process.env.BUNDLE_CHUNKS ?? 4);

const files = readdirSync(SOURCE)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`Geen migraties gevonden in ${SOURCE}`);
  process.exit(1);
}

// Verdeel op grootte, niet op aantal: de eerste migraties zijn veel groter dan
// de latere, dus vier gelijke stapels bestanden zouden heel ongelijke stukken
// opleveren.
const withSize = files.map((name) => {
  const body = readFileSync(join(SOURCE, name), 'utf8');
  return { name, body, size: body.length };
});

const total = withSize.reduce((sum, file) => sum + file.size, 0);
const target = total / CHUNKS;

const groups = [[]];
let running = 0;
for (const file of withSize) {
  const current = groups[groups.length - 1];
  // Een bestand nooit doorsnijden: een halve migratie is geen migratie.
  if (current.length > 0 && running + file.size > target && groups.length < CHUNKS) {
    groups.push([file]);
    running = file.size;
  } else {
    current.push(file);
    running += file.size;
  }
}

mkdirSync(OUTPUT, { recursive: true });

groups.forEach((group, index) => {
  const number = String(index + 1).padStart(2, '0');
  const first = group[0].name.slice(0, 17);
  const last = group[group.length - 1].name.slice(0, 17);

  const header = [
    '-- =========================================================================',
    `-- DEEL ${index + 1} VAN ${groups.length}`,
    '--',
    `-- Bevat ${group.length} migraties: ${first} tot en met ${last}.`,
    '--',
    '-- Plak dit hele bestand in de SQL Editor van Supabase en klik Run.',
    '-- Draai de delen op volgorde. Deel 2 werkt niet zonder deel 1.',
    '--',
    '-- Gaat er iets mis: stop, en meld welke foutmelding je ziet. Doorgaan na',
    '-- een fout levert een half schema op, en dat is lastiger te repareren dan',
    '-- opnieuw beginnen.',
    '-- =========================================================================',
    '',
  ].join('\n');

  const body = group
    .map((file) => `\n-- ----- ${file.name} -----\n\n${file.body.trim()}\n`)
    .join('\n');

  const path = join(OUTPUT, `deel-${number}-van-${groups.length}.sql`);
  writeFileSync(path, `${header}${body}`);
  console.log(
    `${path} — ${group.length} migraties, ${(Buffer.byteLength(body) / 1024).toFixed(0)} kB`,
  );
});

console.log(`\n${files.length} migraties verdeeld over ${groups.length} bestanden.`);
