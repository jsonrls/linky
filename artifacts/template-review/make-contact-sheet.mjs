import sharp from "sharp";
import { readdir } from "node:fs/promises";
const directory = "artifacts/template-review";
const ids = (await readdir("public/templates"))
  .sort()
  .map((file) => file.replace(/^\d+-/, "").replace(/\.webp$/, ""));
const layers = [];
for (const [index, id] of ids.entries()) {
  const left = (index % 5) * 240;
  const top = Math.floor(index / 5) * 800;
  const title = `${String(index + 1).padStart(2, "0")} ${id.replaceAll("-", " ")}`;
  layers.push({
    input: Buffer.from(
      `<svg width="240" height="40"><rect width="240" height="40" fill="white"/><text x="10" y="24" font-family="sans-serif" font-size="14">${title}</text></svg>`,
    ),
    left,
    top,
  });
  layers.push({
    input: await sharp(`${directory}/${id}-390.png`)
      .resize(230, 750, { fit: "inside" })
      .toBuffer(),
    left: left + 5,
    top: top + 40,
  });
}
await sharp({
  create: { width: 1200, height: 3200, channels: 3, background: "white" },
})
  .composite(layers)
  .png()
  .toFile(`${directory}/contact-sheet.png`);
