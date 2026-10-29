import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BG = [0x17, 0x33, 0x28];
const CREAM = [0xf6, 0xef, 0xe2];
const SHADE = [0xe4, 0xd3, 0xb4];
const INK = [0x23, 0x1e, 0x18];
const RED = [0x9c, 0x3b, 0x2e];
const GOLD = [0xc4, 0xa4, 0x6a];

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const start = y * (size * 4 + 1);
    raw[start] = 0;
    pixels.copy(raw, start + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = 255;
}

function fillRect(pixels, size, x0, y0, x1, y1, color) {
  const left = Math.max(0, Math.floor(Math.min(x0, x1)));
  const right = Math.min(size, Math.ceil(Math.max(x0, x1)));
  const top = Math.max(0, Math.floor(Math.min(y0, y1)));
  const bottom = Math.min(size, Math.ceil(Math.max(y0, y1)));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) setPixel(pixels, size, x, y, color);
  }
}

function pointInTriangle(px, py, x0, y0, x1, y1, x2, y2) {
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (area === 0) return false;
  const a = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
  const b = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
  const c = 1 - a - b;
  return a >= 0 && b >= 0 && c >= 0;
}

function fillTriangle(pixels, size, x0, y0, x1, y1, x2, y2, color) {
  const left = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
  const right = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)));
  const top = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const bottom = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)));
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (pointInTriangle(x + 0.5, y + 0.5, x0, y0, x1, y1, x2, y2)) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function drawIcon(size, inset) {
  const pixels = Buffer.alloc(size * size * 4, 255);
  fillRect(pixels, size, 0, 0, size, size, BG);

  const left = size * (0.2 + inset);
  const right = size * (0.8 - inset);
  const top = size * (0.22 + inset);
  const bottom = size * (0.78 - inset);
  const mid = (left + right) / 2;
  const pageGap = Math.max(2, size * 0.012);

  fillRect(pixels, size, left, top + size * 0.035, mid - pageGap, bottom, SHADE);
  fillRect(pixels, size, mid + pageGap, top, right, bottom, CREAM);
  fillRect(pixels, size, mid - pageGap, top, mid + pageGap, bottom, INK);

  const markLeft = mid + (right - mid) * 0.28;
  const markRight = markLeft + (right - mid) * 0.16;
  const markBottom = top + (bottom - top) * 0.38;
  const notch = markBottom + (bottom - top) * 0.08;
  fillRect(pixels, size, markLeft, top, markRight, markBottom, RED);
  fillTriangle(
    pixels,
    size,
    markLeft,
    markBottom,
    markRight,
    markBottom,
    (markLeft + markRight) / 2,
    notch,
    RED,
  );

  const lineLeft = left + (mid - left) * 0.18;
  const lineRight = mid - (mid - left) * 0.22;
  const thickness = Math.max(2, size * 0.012);
  for (let line = 0; line < 4; line += 1) {
    const y = top + (bottom - top) * (0.28 + line * 0.13);
    fillRect(pixels, size, lineLeft, y, lineRight, y + thickness, GOLD);
  }

  return encodePng(size, pixels);
}

const files = [
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/icon-maskable-512.png", 512, 0.08],
  ["public/icons/apple-touch-icon.png", 180, 0],
  ["src/app/icon.png", 32, 0],
];

for (const [file, size, inset] of files) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, drawIcon(size, inset));
}
