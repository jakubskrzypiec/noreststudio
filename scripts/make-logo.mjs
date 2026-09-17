/**
 * Z materiałów w IKONKI/ robi dwie maski PNG:
 *
 *   public/logo/wordmark.png  - napis "NORESTSTUDIO" (z napis.jpg, białe na czarnym)
 *   public/logo/mark.png      - sam znak "N" (wycięty z logo.jpg, czarne na białym)
 *
 * Zapisujemy je jako czerń z kanałem alfa, bo w interfejsie logo raz jest czarne
 * (na papierze), a raz białe (na pełnoekranowym renderze). Komponent nakłada je
 * przez CSS `mask-image` i koloruje `currentColor`, więc jeden plik obsługuje oba przypadki.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "logo");

/**
 * Buduje PNG: kolor czarny, a przezroczystość wzięta z jasności źródła.
 * `invert` odwraca logikę dla grafik, które są czarne na białym tle.
 */
async function toMask(input, outFile, { invert = false, trim = true } = {}) {
  let pipeline = sharp(input).grayscale();
  if (invert) pipeline = pipeline.negate({ alpha: false });

  const alpha = await pipeline.toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
  const { width, height } = alpha.info;

  let out = sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).joinChannel(alpha.data, { raw: { width, height, channels: 1 } });

  // Źródła mają szeroki margines; bez przycięcia logo tonie w pustce.
  if (trim) out = out.trim({ threshold: 5 });

  await out.png({ compressionLevel: 9 }).toFile(outFile);

  const meta = await sharp(outFile).metadata();
  console.log(`  ${path.basename(outFile)}  ${meta.width}x${meta.height}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  console.log("Maski logo:");

  // napis.jpg to biały napis na czarnym tle - jasność to od razu gotowa alfa.
  await toMask(path.join(ROOT, "IKONKI", "napis.jpg"), path.join(OUT, "wordmark.png"));

  // logo.jpg to czarny znak na białym; bierzemy górną część kwadratu, czyli samo "N".
  const logoPath = path.join(ROOT, "IKONKI", "logo.jpg");
  const { width, height } = await sharp(logoPath).metadata();
  const markCrop = await sharp(logoPath)
    .extract({
      left: Math.round(width * 0.18),
      top: Math.round(height * 0.2),
      width: Math.round(width * 0.64),
      height: Math.round(height * 0.48),
    })
    .toBuffer();

  await toMask(markCrop, path.join(OUT, "mark.png"), { invert: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
