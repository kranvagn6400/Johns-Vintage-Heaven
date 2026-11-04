// يرسم أيقونات PNG (192 و 512) بنفس تصميم icon.svg بدون أي مكتبات: node tools/make-icons.js
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function draw(N) {
  const px = Buffer.alloc(N * N * 4), S = N / 64, SS = 4;
  const bg = hex('#241810'), disc = hex('#120c08'), gold = hex('#c9a253'), groove = hex('#3a2a1e'), wine = hex('#7a2331'), dot = hex('#f3e8d2');
  const colorAt = (x, y) => {               // إحداثيات بنظام 64×64
    const d = Math.hypot(x - 32, y - 32);
    if (d < 1.6) return dot;
    if (d < 8.5) return wine;
    if (d < 9.5) return gold;
    if (Math.abs(d - 20) < .5 || Math.abs(d - 15.5) < .5) return groove;
    if (d < 24.25) return disc;
    if (d < 25.75) return gold;
    return bg;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const c = colorAt((x + (sx + .5) / SS) / S, (y + (sy + .5) / SS) / S); r += c[0]; g += c[1]; b += c[2];
    }
    const i = (y * N + x) * 4, n = SS * SS;
    px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n; px[i + 3] = 255;
  }
  const raw = Buffer.alloc((N * 4 + 1) * N);
  for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4); }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const n of [192, 512]) fs.writeFileSync(path.join(__dirname, '..', `icon-${n}.png`), draw(n));
console.log('ok');
