import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/*
  Turns public/aquafix-logo.jpg into the assets the console and the field app
  actually need, and is re-runnable if the source artwork is ever replaced.

  The source is a JPEG: a flat green mark baked onto an off-white square with a
  lot of empty margin. JPEG has no alpha, so dropping it straight onto the
  brand-coloured tile would show a pale box around it. Rather than key on an
  exact colour — JPEG compression means no two "white" pixels are identical —
  alpha is derived from how far each pixel has travelled from the background
  towards the ink. Half-covered edge pixels land on a half alpha, which is what
  keeps the curves smooth instead of stair-stepped.

    node scripts/build-logo-assets.mjs
*/

const SOURCE = 'public/aquafix-logo.jpg';

// Measured from the source rather than guessed.
const BG = [251, 251, 249];
const INK = [28, 100, 44]; // #1C642C, the logo's own green

const BRAND = [14, 110, 107]; // --color-brand-600, the console's teal
const WHITE = [255, 255, 255];

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** The mark as straight alpha, cropped to the artwork, tinted flat. */
async function mark(tint) {
  const { data, info } = await sharp(SOURCE)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bgLum = lum(BG);
  const inkLum = lum(INK);
  const span = bgLum - inkLum;

  const out = Buffer.alloc(info.width * info.height * 4);
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * info.channels;
      const pixelLum = lum([data[i], data[i + 1], data[i + 2]]);

      // 0 where the pixel matches the paper, 1 where it matches the ink.
      let alpha = (bgLum - pixelLum) / span;
      alpha = Math.max(0, Math.min(1, alpha));

      const o = (y * info.width + x) * 4;
      out[o] = tint[0];
      out[o + 1] = tint[1];
      out[o + 2] = tint[2];
      out[o + 3] = Math.round(alpha * 255);

      // Ignore the faint noise JPEG leaves on the paper when finding the edges.
      if (alpha > 0.15) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Square the crop around the artwork so nothing is distorted later, and so
  // every output is centred the same way.
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const side = Math.max(w, h);
  const left = Math.max(0, Math.round(minX - (side - w) / 2));
  const top = Math.max(0, Math.round(minY - (side - h) / 2));

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({
      left,
      top,
      width: Math.min(side, info.width - left),
      height: Math.min(side, info.height - top),
    })
    .png();
}

/** Transparent square, with the mark inset so it breathes. */
async function transparentIcon(source, size, inset = 0.9) {
  const inner = Math.round(size * inset);
  const pad = Math.round((size - inner) / 2);
  return sharp(await source.clone().resize(inner, inner).toBuffer())
    .extend({
      top: pad, bottom: size - inner - pad,
      left: pad, right: size - inner - pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/** Opaque tile, for launcher icons — Android will not composite transparency. */
async function solidIcon(source, size, background, inset = 0.68) {
  const inner = Math.round(size * inset);
  const pad = Math.round((size - inner) / 2);
  return sharp({
    create: {
      width: size, height: size, channels: 4,
      background: { r: background[0], g: background[1], b: background[2], alpha: 1 },
    },
  })
    .composite([{ input: await source.clone().resize(inner, inner).toBuffer(), top: pad, left: pad }])
    .png()
    .toBuffer();
}

async function write(file, buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
  console.log(`  ${file}  ${(buffer.length / 1024).toFixed(1)} kB`);
}

async function main() {
  const green = await mark(INK);
  const white = await mark(WHITE);

  console.log('web:');
  // Trimmed tight to the artwork. The mark is small wherever it is used — a
  // 34px tile beside the organisation name — and every pixel of built-in
  // margin comes straight off the part anyone can actually see, so the
  // breathing room is left to whatever places it.
  await write('public/logo.png', await transparentIcon(green, 512, 1));
  await write('public/logo-white.png', await transparentIcon(white, 512, 1));
  // The browser tab sits on light chrome far more often than dark, so the tab
  // icon keeps the logo's own green rather than a knockout.
  await write('src/app/icon.png', await transparentIcon(green, 512, 0.94));
  // iOS composites onto white and rounds the corners itself; a solid tile in
  // the console's teal is what survives that.
  await write('src/app/apple-icon.png', await solidIcon(white, 180, BRAND, 0.62));

  console.log('field app:');
  await write('mobile/assets/logo-white.png', await transparentIcon(white, 256));
  await write('mobile/assets/logo.png', await transparentIcon(green, 256));

  // Android launcher densities: mdpi 48 through xxxhdpi 192.
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [density, size] of Object.entries(densities)) {
    await write(
      // The legacy square bitmap, still used by anything older than Android 8.
      // The launcher icon is the logo's own identity, so it keeps the logo's
      // green rather than borrowing the console's teal.
      `mobile/android/app/src/main/res/mipmap-${density}/ic_launcher.png`,
      await solidIcon(white, size, INK),
    );
  }

  /* Android 8 and later want a layered adaptive icon so the launcher can mask
     it to whatever shape the device uses — a circle on stock Android. Ship only
     the legacy bitmap and the launcher pads it onto a white circle instead,
     which is why the square icon sat awkwardly among the round ones.

     The canvas is 108dp but only the middle 72dp is guaranteed visible: the
     rest is cropped by the mask and used for parallax. So the mark is placed at
     just over half the canvas, well inside that safe circle. */
  const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  for (const [density, size] of Object.entries(adaptive)) {
    await write(
      `mobile/android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`,
      await transparentIcon(white, size, 0.52),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
