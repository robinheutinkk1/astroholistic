/**
 * Tekent het beeldmerk van Tagpoint: drie staven die oplopen.
 *
 * WAAROM ALLEEN DE STAVEN EN NIET HET HELE LOGO. Het woordmerk staat in een
 * geometrische schreefloze letter die hier niet beschikbaar is. Namaken met een
 * andere letter levert een logo op dat er nét naast zit, en dat valt bij een
 * merk meer op dan wanneer je het helemaal niet probeert.
 *
 * De staven zijn wél exact na te maken: het zijn drie rechthoeken met ronde
 * hoeken. Het woord "Tagpoint" komt in de mail als gewone tekst naast dit
 * beeldmerk te staan, en dat is voor e-mail zelfs beter:
 *
 * - tekst wordt altijd getoond, ook als het mailprogramma plaatjes blokkeert,
 *   en dat doet Outlook standaard
 * - tekst blijft scherp op elk scherm, ongeacht de pixeldichtheid
 * - de ontvanger kan hem selecteren en voorlezen laten worden
 *
 * Levert er iemand later het echte logobestand aan, dan is het vervangen van
 * dit beeldmerk plus de tekstregel één wijziging in beide sjablonen.
 */
import sharp from 'sharp';

// Twee keer de weergavemaat, anders oogt het wazig op een scherp scherm.
const SCALE = 2;
const DISPLAY_WIDTH = 26;
const DISPLAY_HEIGHT = 32;

/*
 * Overgenomen van het aangeleverde logo: drie staven van gelijke breedte, met
 * dezelfde tussenruimte, allemaal op dezelfde onderlijn en oplopend in hoogte.
 * De kleuren lopen van licht naar het indigo van het merk.
 */
const BARS = [
  { heightRatio: 0.46, fill: '#C5BFF7' },
  { heightRatio: 0.72, fill: '#8C83F0' },
  { heightRatio: 1.0, fill: '#4B37E0' },
];

const BAR_WIDTH = 7;
const GAP = 2.5;
const RADIUS = 2;

const width = BARS.length * BAR_WIDTH + (BARS.length - 1) * GAP;
const height = 32;

const rects = BARS.map((bar, index) => {
  const barHeight = height * bar.heightRatio;
  const x = index * (BAR_WIDTH + GAP);
  // Onderaan uitlijnen: het oplopende ritme is het hele idee van het merk.
  const y = height - barHeight;
  return `<rect x="${x}" y="${y}" width="${BAR_WIDTH}" height="${barHeight}" rx="${RADIUS}" fill="${bar.fill}"/>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rects}</svg>`;

await sharp(Buffer.from(svg))
  .resize(DISPLAY_WIDTH * SCALE, DISPLAY_HEIGHT * SCALE, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toFile('public/email-mark.png');

const meta = await sharp('public/email-mark.png').metadata();
console.log(
  `public/email-mark.png: ${meta.width}x${meta.height}, toont op ${DISPLAY_WIDTH}x${DISPLAY_HEIGHT}`,
);
