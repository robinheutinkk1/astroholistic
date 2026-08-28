/**
 * QR generation.
 *
 * A QR code is a rendering of the SAME URL an NFC tap opens (decision D-05).
 * There is no separate QR identifier, no separate revocation path, and no way
 * for a tag to be revoked as NFC yet still work as QR.
 *
 * Written by hand rather than pulled in as a dependency: this needs one fixed
 * configuration (version 4, error correction M, byte mode), not a library that
 * handles every mode. Each new dependency has to earn its place (§67.14).
 */

// Fixed at QR version 4, error correction level M. That gives 33x33 modules
// and 64 data codewords — comfortably more than a tag URL needs, while staying
// small enough to print on a sticker and still scan.
const MODULES = 33; // 17 + 4 * version
const DATA_CODEWORDS = 64;
const EC_CODEWORDS = 16;
const BLOCKS = 2;

/** GF(256) tables for Reed–Solomon, generated once at module load. */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]!;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!]!;
}

function generatorPolynomial(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] = (next[j] ?? 0) ^ gfMul(poly[j]!, EXP[i]!);
      next[j + 1] = (next[j + 1] ?? 0) ^ poly[j]!;
    }
    poly = next;
  }
  return poly;
}

function errorCorrection(data: number[], count: number): number[] {
  const generator = generatorPolynomial(count);
  const remainder = new Array<number>(count).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder[0]!;
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < count; i += 1) {
      remainder[i] = remainder[i]! ^ gfMul(generator[i + 1]!, factor);
    }
  }
  return remainder;
}

/** Returns a 33×33 matrix of booleans, true meaning a dark module. */
export function encodeQr(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  if (bytes.length > DATA_CODEWORDS - 2) {
    throw new RangeError(`QR payload too long: ${bytes.length} bytes`);
  }

  // Byte mode, 8-bit character count for this version range.
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  const padding = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < DATA_CODEWORDS) {
    data.push(padding[padIndex % 2]!);
    padIndex += 1;
  }

  // Version 4-M: two blocks of 32 data codewords, 8 EC codewords each.
  const blockSize = DATA_CODEWORDS / BLOCKS;
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  for (let i = 0; i < BLOCKS; i += 1) {
    const block = data.slice(i * blockSize, (i + 1) * blockSize);
    dataBlocks.push(block);
    ecBlocks.push(errorCorrection(block, EC_CODEWORDS / BLOCKS));
  }

  const interleaved: number[] = [];
  for (let i = 0; i < blockSize; i += 1) {
    for (const block of dataBlocks) interleaved.push(block[i]!);
  }
  for (let i = 0; i < EC_CODEWORDS / BLOCKS; i += 1) {
    for (const block of ecBlocks) interleaved.push(block[i]!);
  }

  return renderMatrix(interleaved);
}

function renderMatrix(codewords: number[]): boolean[][] {
  const matrix: (boolean | null)[][] = Array.from({ length: MODULES }, () =>
    new Array<boolean | null>(MODULES).fill(null),
  );

  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= MODULES || cc < 0 || cc >= MODULES) continue;
        const inRing = r >= 0 && r <= 6 && (c === 0 || c === 6);
        const inCol = c >= 0 && c <= 6 && (r === 0 || r === 6);
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[rr]![cc] = inRing || inCol || inCore;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, MODULES - 7);
  placeFinder(MODULES - 7, 0);

  // Alignment pattern (version 4: centre at 26,26).
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      matrix[26 + r]![26 + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
    }
  }

  for (let i = 8; i < MODULES - 8; i += 1) {
    const dark = i % 2 === 0;
    if (matrix[6]![i] === null) matrix[6]![i] = dark;
    if (matrix[i]![6] === null) matrix[i]![6] = dark;
  }
  matrix[MODULES - 8]![8] = true;

  // Format information for EC level M with mask 0.
  const FORMAT = 0b101010000010010;
  for (let i = 0; i < 15; i += 1) {
    const bit = ((FORMAT >> i) & 1) === 1;
    if (i < 6) matrix[i]![8] = bit;
    else if (i < 8) matrix[i + 1]![8] = bit;
    else if (i === 8) matrix[8]![7] = bit;
    else matrix[8]![14 - i] = bit;

    if (i < 8) matrix[8]![MODULES - 1 - i] = bit;
    else matrix[MODULES - 15 + i]![8] = bit;
  }

  // Data placement: upward/downward zig-zag in two-column strips.
  let bitIndex = 0;
  const nextBit = (): boolean => {
    const byte = codewords[bitIndex >> 3];
    if (byte === undefined) return false;
    const bit = (byte >> (7 - (bitIndex & 7))) & 1;
    bitIndex += 1;
    return bit === 1;
  };

  let upward = true;
  for (let col = MODULES - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1; // skip the vertical timing column
    for (let i = 0; i < MODULES; i += 1) {
      const row = upward ? MODULES - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (matrix[row]![c] !== null) continue;
        // Mask 0: invert where (row + col) is even.
        matrix[row]![c] = nextBit() !== ((row + c) % 2 === 0);
      }
    }
    upward = !upward;
  }

  return matrix.map((row) => row.map((cell) => cell === true));
}

/** Renders the matrix as an inline SVG, ready to print. */
export function qrSvg(text: string, size = 160): string {
  const matrix = encodeQr(text);
  const quiet = 2;
  const total = MODULES + quiet * 2;

  let path = '';
  for (let row = 0; row < MODULES; row += 1) {
    for (let col = 0; col < MODULES; col += 1) {
      if (matrix[row]![col]) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`,
    ` viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img">`,
    `<rect width="${total}" height="${total}" fill="#fff"/>`,
    `<path d="${path}" fill="#000"/>`,
    '</svg>',
  ].join('');
}
