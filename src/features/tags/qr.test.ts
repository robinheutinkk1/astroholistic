import { describe, expect, it } from 'vitest';
import { encodeQr, qrSvg } from './qr';

describe('encodeQr', () => {
  it('produces a 33x33 matrix (QR version 4)', () => {
    const matrix = encodeQr('https://app.tagpoint.nl/t/ABCDEFGHJKMNPQRSTVWXYZ0123');
    expect(matrix).toHaveLength(33);
    expect(matrix.every((row) => row.length === 33)).toBe(true);
  });

  it('places the three finder patterns', () => {
    // Without these a scanner cannot locate the code at all, so this is the
    // cheapest check that the output is a QR code and not noise.
    const m = encodeQr('test');
    for (const [row, col] of [
      [0, 0],
      [0, 26],
      [26, 0],
    ] as const) {
      expect(m[row]![col], `finder at ${row},${col}`).toBe(true);
      expect(m[row + 1]![col + 1]).toBe(false);
      expect(m[row + 3]![col + 3]).toBe(true);
    }
  });

  it('places the timing patterns', () => {
    const m = encodeQr('test');
    expect(m[6]![8]).toBe(true);
    expect(m[6]![9]).toBe(false);
    expect(m[8]![6]).toBe(true);
  });

  it('always sets the dark module', () => {
    expect(encodeQr('test')[33 - 8]![8]).toBe(true);
  });

  it('is deterministic', () => {
    const a = encodeQr('same input');
    const b = encodeQr('same input');
    expect(a).toEqual(b);
  });

  it('produces different output for different input', () => {
    const a = encodeQr('https://app.tagpoint.nl/t/AAAAAAAAAAAAAAAAAAAAAAAAAA');
    const b = encodeQr('https://app.tagpoint.nl/t/BBBBBBBBBBBBBBBBBBBBBBBBBB');
    expect(a).not.toEqual(b);
  });

  it('refuses a payload that does not fit rather than truncating it', () => {
    // Silently truncating would produce a scannable code pointing at the wrong
    // tag, which is far worse than an error.
    expect(() => encodeQr('x'.repeat(200))).toThrow(RangeError);
  });

  it('fits a full tag URL', () => {
    const url = 'https://dispatch.taxi-ontzorgd.nl/t/ABCDEFGHJKMNPQRSTVWXYZ0123';
    expect(() => encodeQr(url)).not.toThrow();
  });
});

describe('qrSvg', () => {
  it('renders inline SVG with a quiet zone', () => {
    const svg = qrSvg('test');
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('viewBox="0 0 37 37"');
    expect(svg).toContain('</svg>');
  });

  it('renders a white background so it prints and scans', () => {
    expect(qrSvg('test')).toContain('fill="#fff"');
  });

  it('honours the requested size', () => {
    expect(qrSvg('test', 240)).toContain('width="240"');
  });
});

/**
 * Reads the payload back out of the matrix.
 *
 * Structural checks prove the finder patterns are in place; they do not prove
 * the data landed where a scanner will look for it. This walks the same
 * zig-zag, undoes the same mask, and parses the byte-mode header — so a
 * mistake in placement or masking shows up as garbled text rather than as a QR
 * code that only fails on a real phone.
 *
 * It does not replace scanning with an actual camera, which is the only way to
 * confirm contrast, quiet zone and print quality.
 */
function decodePayload(matrix: boolean[][]): string {
  const MODULES = 33;
  const reserved = buildReservedMask(MODULES);

  const bits: number[] = [];
  let upward = true;
  for (let col = MODULES - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let i = 0; i < MODULES; i += 1) {
      const row = upward ? MODULES - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (reserved[row]![c]) continue;
        // Undo mask 0.
        bits.push(matrix[row]![c] !== ((row + c) % 2 === 0) ? 1 : 0);
      }
    }
    upward = !upward;
  }

  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }

  // De-interleave the two data blocks of 32 codewords each.
  const blockSize = 32;
  const blocks: number[][] = [[], []];
  for (let i = 0; i < blockSize * 2; i += 1) {
    blocks[i % 2]!.push(codewords[i]!);
  }
  const data = [...blocks[0]!, ...blocks[1]!];

  const mode = data[0]! >> 4;
  if (mode !== 0b0100) throw new Error(`Unexpected mode ${mode}`);
  const length = ((data[0]! & 0x0f) << 4) | (data[1]! >> 4);

  const bytes: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const hi = data[1 + i]! & 0x0f;
    const lo = data[2 + i]! >> 4;
    bytes.push((hi << 4) | lo);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function buildReservedMask(size: number): boolean[][] {
  const reserved = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const mark = (row: number, col: number, height: number, width: number) => {
    for (let r = 0; r < height; r += 1) {
      for (let c = 0; c < width; c += 1) {
        if (row + r >= 0 && row + r < size && col + c >= 0 && col + c < size) {
          reserved[row + r]![col + c] = true;
        }
      }
    }
  };

  mark(0, 0, 9, 9);
  mark(0, size - 8, 9, 8);
  mark(size - 8, 0, 8, 9);
  mark(24, 24, 5, 5);
  for (let i = 0; i < size; i += 1) {
    reserved[6]![i] = true;
    reserved[i]![6] = true;
  }
  return reserved;
}

describe('round trip', () => {
  it('reads back a short payload', () => {
    expect(decodePayload(encodeQr('hello'))).toBe('hello');
  });

  it('reads back a full tag URL', () => {
    const url = 'https://app.tagpoint.nl/t/ABCDEFGHJKMNPQRSTVWXYZ0123';
    expect(decodePayload(encodeQr(url))).toBe(url);
  });

  it('reads back a custom-domain tag URL', () => {
    const url = 'https://dispatch.taxi-ontzorgd.nl/t/9F3A21BCDEFGHJKMNPQRST';
    expect(decodePayload(encodeQr(url))).toBe(url);
  });
});
