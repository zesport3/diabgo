import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // non-interlaced

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw pixel data: each scanline starts with filter byte 0x00
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.38;

  // Draw icon: Dark navy background `#0F172A` with rounded droplet in turquoise `#06B6D4`
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // filter byte: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Distance from center
      const dx = (x - cx) / (width * 0.45);
      const dy = (y - cy) / (height * 0.45);
      const d2 = dx * dx + dy * dy;

      // Squircle app icon background
      const rSquircle = Math.pow(Math.abs(dx), 3.5) + Math.pow(Math.abs(dy), 3.5);

      if (rSquircle <= 1.0) {
        // Inside icon background: Navy #0B192C -> #0F172A
        let r = 11, g = 25, b = 44, a = 255;

        // Droplet shape:
        // top point at cy - 0.28*h, bottom circle at cy + 0.05*h with r = 0.2*h
        const dropCy = cy + height * 0.06;
        const dropRadius = width * 0.22;
        const distDrop = Math.hypot(x - cx, y - dropCy);

        // cone part
        const dyTip = (cy - height * 0.24) - y;
        const dxTip = Math.abs(x - cx);
        const insideCone = y <= dropCy && y >= (cy - height * 0.24) && (dxTip <= (y - (cy - height * 0.24)) * 0.6);
        const insideCircle = distDrop <= dropRadius;

        if (insideCone || insideCircle) {
          // Turquoise gradient #06B6D4 to #0EA5E9
          const t = (y - (cy - height * 0.24)) / (dropRadius * 2);
          r = Math.floor(6 + t * 8);
          g = Math.floor(182 - t * 17);
          b = Math.floor(212 + t * 21);

          // Inner plus/cross or glucose curve in center
          const inHBar = Math.abs(y - dropCy) < width * 0.03 && Math.abs(x - cx) < width * 0.09;
          const inVBar = Math.abs(x - cx) < width * 0.03 && Math.abs(y - dropCy) < width * 0.09;
          if (inHBar || inVBar) {
            r = 255; g = 255; b = 255;
          }
        }

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      } else {
        // Transparent outside squircle
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, 192));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, 512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, 180));
console.log('PNG icons generated in public/');
