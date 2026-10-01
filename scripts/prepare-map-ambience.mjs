import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Crop/align already approved transparent atlases; does not paint or remove backgrounds.
const [wildlife, people, foliage] = process.argv.slice(2);
if (!wildlife || !people || !foliage)
  throw new Error(
    "Usage: node scripts/prepare-map-ambience.mjs wildlife.png people.png foliage.png",
  );
const outputDirectory = "public/images/world-map/ambience";
await mkdir(outputDirectory, { recursive: true });

async function readAtlas(input, expectedRows) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const regions = [];
  const visited = new Uint8Array(info.width * info.height);
  const queue = new Int32Array(info.width * info.height);
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 10) transparent++;
  // The generator can offset wing tips from the grid. Find full silhouettes,
  // rather than cutting the atlas into a fixed grid that could clip a wing.
  for (let pixel = 0; pixel < visited.length; pixel++) {
    if (visited[pixel] || data[pixel * 4 + 3] <= 40) continue;
    let head = 0,
      tail = 1,
      x0 = info.width,
      x1 = 0,
      y0 = info.height,
      y1 = 0,
      sumY = 0;
    queue[0] = pixel;
    visited[pixel] = 1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % info.width,
        y = Math.floor(current / info.width);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      sumY += y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || nx >= info.width || ny < 0 || ny >= info.height) continue;
          const next = ny * info.width + nx;
          if (!visited[next] && data[next * 4 + 3] > 40) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        }
    }
    if (tail > 250)
      regions.push({
        left: x0,
        top: y0,
        width: x1 - x0 + 1,
        height: y1 - y0 + 1,
        area: tail,
        centerY: sumY / tail,
      });
  }
  if (transparent / (info.width * info.height) < 0.35)
    throw new Error("Atlas must have real transparent gutters.");
  const major = regions
    .sort((a, b) => b.area - a.area)
    .slice(0, expectedRows * 4)
    .sort((a, b) => a.centerY - b.centerY);
  if (major.length !== expectedRows * 4)
    throw new Error(`Missing complete sprites: ${major.length}.`);
  const rows = Array.from({ length: expectedRows }, (_, row) =>
    major.slice(row * 4, row * 4 + 4).sort((a, b) => a.left - b.left),
  );
  for (const region of major) {
    if (
      region.left < 2 ||
      region.left + region.width > info.width - 2 ||
      region.top < 2 ||
      region.top + region.height > info.height - 2
    )
      throw new Error("Sprite touches an outer atlas edge.");
  }
  for (let i = 0; i < major.length; i++)
    for (let j = i + 1; j < major.length; j++) {
      const a = major[i],
        b = major[j];
      if (
        a.left < b.left + b.width &&
        a.left + a.width > b.left &&
        a.top < b.top + b.height &&
        a.top + a.height > b.top
      )
        throw new Error(
          "Source sprite rectangles overlap; revise atlas spacing before extraction.",
        );
    }
  console.log(
    JSON.stringify({ rows, transparentFraction: transparent / (info.width * info.height) }),
  );
  return { input, info, rows };
}

async function prepare(atlas, row, name, width, height, anchored = true) {
  const cells = [];
  for (let column = 0; column < 4; column++) {
    const region = atlas.rows[row][column];
    const crop = {
      left: region.left - 1,
      top: region.top - 1,
      width: region.width + 2,
      height: region.height + 2,
    };
    const png = await sharp(atlas.input).extract(crop).png().toBuffer();
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let x0 = info.width,
      x1 = -1,
      y0 = info.height,
      y1 = -1;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++)
        if (data[(y * info.width + x) * 4 + 3] > 40) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    if (x1 < 0) throw new Error(`${name} frame ${column} is empty.`);
    const box = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
    let centerY = box.height / 2;
    if (!anchored) {
      let sumY = 0,
        pixels = 0;
      // The rightmost beak is stable across wingbeats; align it instead of the wing bounding box.
      for (let y = y0; y <= y1; y++)
        for (let x = x1 - Math.ceil(box.width * 0.08); x <= x1; x++)
          if (data[(y * info.width + x) * 4 + 3] > 40) {
            sumY += y - y0;
            pixels++;
          }
      if (pixels) centerY = sumY / pixels;
    }
    cells.push({
      buffer: await sharp(png).extract(box).png().toBuffer(),
      width: box.width,
      height: box.height,
      centerY,
    });
  }
  const above = Math.max(...cells.map((c) => c.centerY));
  const below = Math.max(...cells.map((c) => c.height - c.centerY));
  const scale = Math.min(
    (width * 0.86) / Math.max(...cells.map((c) => c.width)),
    (height * 0.86) / (anchored ? Math.max(...cells.map((c) => c.height)) : above + below),
  );
  const frames = await Promise.all(
    cells.map(async (cell, column) => {
      const frameWidth = Math.round(cell.width * scale),
        frameHeight = Math.round(cell.height * scale);
      return {
        input: await sharp(cell.buffer)
          .resize(frameWidth, frameHeight, { kernel: "lanczos3" })
          .png()
          .toBuffer(),
        left: column * width + Math.floor((width - frameWidth) / 2),
        top: anchored
          ? Math.round(height * 0.94) - frameHeight
          : Math.round(height * 0.07 + (above - cell.centerY) * scale),
      };
    }),
  );
  const output = `${outputDirectory}/${name}.webp`;
  const metadata = await sharp({
    create: { width: width * 4, height, channels: 4, background: "#00000000" },
  })
    .composite(frames)
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(output);
  console.log(
    JSON.stringify({ file: output, bytes: metadata.size, frameWidth: width, frameHeight: height }),
  );
}

const creatures = await readAtlas(wildlife, 4);
const humans = await readAtlas(people, 3);
const trees = await readAtlas(foliage, 2);
await prepare(creatures, 0, "dino-sauropod", 192, 160);
await prepare(creatures, 1, "dino-predator", 192, 160);
await prepare(creatures, 2, "seabird", 96, 80, false);
await prepare(creatures, 3, "pterosaur", 128, 96, false);
await prepare(humans, 0, "npc-bulma", 80, 112);
await prepare(humans, 1, "npc-kame", 80, 112);
await prepare(humans, 2, "npc-merchant", 80, 112);
await prepare(trees, 0, "palm", 128, 160);
await prepare(trees, 1, "forest-tree", 160, 160);
