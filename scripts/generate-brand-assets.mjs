/**
 * Regenerates every raster brand asset from the vector mark.
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * Source of truth: public/brand/foremint-mark.svg (traced from the Foremint
 * Academy logo artwork in public/brand/foremint-logo-dark.png).
 * Outputs:
 *   public/brand/foremint-mark-{48,256,512}.png  transparent marks (emails, PDFs, JSON-LD)
 *   src/app/icon.svg                             favicon
 *   src/app/apple-icon.png                       180×180 home-screen icon on the logo's night background
 */
import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = join(import.meta.dirname, "..");
const svgPath = join(root, "public/brand/foremint-mark.svg");
const svg = await readFile(svgPath);

for (const size of [48, 256, 512]) {
  await sharp(svg, { density: Math.max(72, Math.ceil((size / 430) * 72 * 4)) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(root, `public/brand/foremint-mark-${size}.png`));
}

const appleMark = await sharp(svg, { density: 300 }).resize(128, 128).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: "#0E0B24" } })
  .composite([{ input: appleMark, left: 26, top: 24 }])
  .png({ compressionLevel: 9 })
  .toFile(join(root, "src/app/apple-icon.png"));

await copyFile(svgPath, join(root, "src/app/icon.svg"));
console.log("Brand assets regenerated.");
