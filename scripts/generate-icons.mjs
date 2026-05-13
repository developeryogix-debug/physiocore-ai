/**
 * generate-icons.mjs
 * Creates icon-192.png and icon-512.png for PhysioCore AI PWA.
 * Pure Node.js — no external dependencies.
 * Design: dark navy (#050810) background, teal (#00D4AA) circle, white "P"
 */
import zlib from 'node:zlib';
import fs   from 'node:fs';
import path from 'node:path';

// ── CRC-32 for PNG chunks ─────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

// ── Pixel-art "P" bitmap (7 cols × 9 rows, 1=filled) ─────────────────────────
const P_BITMAP = [
  [1,1,1,1,0,0,0],
  [1,0,0,0,1,0,0],
  [1,0,0,0,1,0,0],
  [1,1,1,1,0,0,0],
  [1,0,0,0,0,0,0],
  [1,0,0,0,0,0,0],
  [1,0,0,0,0,0,0],
  [1,0,0,0,0,0,0],
  [1,0,0,0,0,0,0],
];
const P_ROWS = P_BITMAP.length;    // 9
const P_COLS = P_BITMAP[0].length; // 7

// ── Draw icon to RGBA buffer ──────────────────────────────────────────────────
function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);

  // Background: #050810
  for (let i = 0; i < size * size; i++) {
    buf[i * 4 + 0] = 0x05;
    buf[i * 4 + 1] = 0x08;
    buf[i * 4 + 2] = 0x10;
    buf[i * 4 + 3] = 0xFF;
  }

  // Teal circle: #00D4AA, radius 42% of size
  const cx = size / 2, cy = size / 2;
  const r = size * 0.42;
  const r2 = r * r;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= r2) {
        const idx = (y * size + x) * 4;
        buf[idx + 0] = 0x00;
        buf[idx + 1] = 0xD4;
        buf[idx + 2] = 0xAA;
        buf[idx + 3] = 0xFF;
      }
    }
  }

  // White "P" centred in circle, scaled to ~40% of diameter
  const glyphH   = r * 0.80;           // pixel-art glyph total height
  const pixH     = glyphH / P_ROWS;    // height per pixel-art row
  const pixW     = pixH * 0.75;        // keep aspect (slightly condensed)
  const glyphW   = pixW * P_COLS;
  const glyphX   = cx - glyphW / 2;
  const glyphY   = cy - glyphH / 2;

  for (let row = 0; row < P_ROWS; row++) {
    for (let col = 0; col < P_COLS; col++) {
      if (!P_BITMAP[row][col]) continue;

      // Each "pixel" in the bitmap → a filled rectangle in the canvas
      const x0 = Math.round(glyphX + col * pixW);
      const y0 = Math.round(glyphY + row * pixH);
      const x1 = Math.round(glyphX + (col + 1) * pixW);
      const y1 = Math.round(glyphY + (row + 1) * pixH);

      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          if (px < 0 || px >= size || py < 0 || py >= size) continue;
          const idx = (py * size + px) * 4;
          buf[idx + 0] = 0xFF;
          buf[idx + 1] = 0xFF;
          buf[idx + 2] = 0xFF;
          buf[idx + 3] = 0xFF;
        }
      }
    }
  }

  return buf;
}

// ── Encode RGBA buffer → PNG ──────────────────────────────────────────────────
function encodePNG(size, rgba) {
  // PNG signature
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);       // width
  ihdr.writeUInt32BE(size, 4);       // height
  ihdr[8]  = 8;                      // bit depth
  ihdr[9]  = 6;                      // colour type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data: filter byte (0x00 = None) + row bytes
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0x00; // filter type: None
    rgba.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Write both sizes ──────────────────────────────────────────────────────────
const OUT_DIR = path.resolve(import.meta.dirname, '../packages/app/public');

for (const size of [192, 512]) {
  const rgba  = drawIcon(size);
  const png   = encodePNG(size, rgba);
  const file  = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✓ ${file}  (${(png.length / 1024).toFixed(1)} KB)`);
}
