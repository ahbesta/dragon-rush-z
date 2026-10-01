import sharp from "sharp";
import fs from "node:fs/promises";
const input = JSON.parse(await fs.readFile(".local/art-input.json", "utf8"));
const manifest = [];
async function tiles(rows, columns, numRows, folder, w, h) {
  await fs.mkdir(`public/images/${folder}`, { recursive: true });
  for (const atlas of rows) {
    const meta = await sharp(atlas.path).metadata();
    for (const [i, id] of atlas.ids.entries()) {
      const left = Math.round(((i % columns) * meta.width) / columns),
        top = Math.round((Math.floor(i / columns) * meta.height) / numRows);
      const width = Math.round((((i % columns) + 1) * meta.width) / columns) - left,
        height = Math.round(((Math.floor(i / columns) + 1) * meta.height) / numRows) - top;
      const target = `public/images/${folder}/${id}.webp`;
      await sharp(atlas.path)
        .extract({ left, top, width, height })
        .resize(w, h, { fit: "contain", background: "#00000000" })
        .webp({ quality: 90 })
        .toFile(target);
      manifest.push({ id, folder, width: w, height: h });
    }
  }
}
await tiles(input.characters, 4, 2, "classic", 384, 512);
await tiles(input.backgrounds, 2, 3, "classic-areas", 1200, 675);
if (input.items) await tiles(input.items, 4, 4, "classic-items", 384, 384);
if (input.solo) {
  for (const a of input.solo) {
    await sharp(a.path)
      .trim({ threshold: 15 })
      .resize(384, 512, { fit: "contain", background: "#00000000" })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: "#00000000" })
      .resize(384, 512)
      .webp({ quality: 90 })
      .toFile(`public/images/classic/${a.id}.webp`);
  }
}
await fs.writeFile(".local/classic-art-manifest.json", JSON.stringify(manifest));
console.log(`Prepared ${manifest.length} art assets.`);
