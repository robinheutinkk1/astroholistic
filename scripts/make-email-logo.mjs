/**
 * Maakt van een aangeleverd logo het bestand dat in de e-mails wordt gebruikt.
 *
 *   node scripts/make-email-logo.mjs <bronbestand>
 *
 * Waarom dit een script is en geen handmatige stap: de eisen zijn precies, en
 * een logo dat op een verkeerde maat of met een witte achtergrond in de mail
 * belandt zie je pas als de eerste ouder hem opent.
 *
 * - 264 bij 64 pixels: twee keer de weergavemaat van 132x32, anders oogt hij
 *   wazig op een telefoon met een scherp scherm.
 * - Transparante achtergrond: de mail heeft een lichte ondergrond en een wit
 *   blokje eromheen valt op.
 * - PNG: het enige formaat dat elk mailprogramma zonder mopperen toont.
 *
 * Bijna wit wordt doorzichtig gemaakt, want de meeste aangeleverde logo's staan
 * op een witte achtergrond. De drempel is bewust hoog (250) zodat alleen de
 * echte achtergrond verdwijnt en lichte tinten in het logo zelf blijven staan.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const source = process.argv[2];
if (!source) {
  console.error('Gebruik: node scripts/make-email-logo.mjs <bronbestand>');
  process.exit(1);
}

const WIDTH = 264;
const HEIGHT = 64;
const WHITE_THRESHOLD = 250;

const input = sharp(source).ensureAlpha();
const { width, height } = await input.metadata();
console.log(`Bron: ${width}x${height}`);

// Wit doorzichtig maken, vóór het bijsnijden: anders snijdt trim() niets weg.
const { data, info } = await input.raw().toBuffer({ resolveWithObject: true });
let madeTransparent = 0;
for (let i = 0; i < data.length; i += info.channels) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
    data[i + 3] = 0;
    madeTransparent += 1;
  }
}
console.log(`Doorzichtig gemaakt: ${madeTransparent} pixels`);

const trimmed = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: info.channels },
})
  .png()
  .trim()
  .toBuffer();

const meta = await sharp(trimmed).metadata();
console.log(`Na bijsnijden: ${meta.width}x${meta.height}`);

// `contain` en niet `cover`: het logo mag nooit worden bijgesneden om te passen.
const out = await sharp(trimmed)
  .resize(WIDTH, HEIGHT, {
    fit: 'contain',
    position: 'left',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toBuffer();

writeFileSync('public/email-logo.png', out);
const final = await sharp(out).metadata();
console.log(
  `Geschreven: public/email-logo.png (${final.width}x${final.height}, ${out.length} bytes)`,
);
