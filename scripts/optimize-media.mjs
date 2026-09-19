/**
 * Przerabia surowe rendery z folderow PROJECTS/ i HOME/ na pliki nadajace sie na strone.
 *
 * Zdjecia -> WebP w kilku szerokosciach + maleńki placeholder base64 (blur pod lazy-load).
 * Filmy   -> MP4 (h264, yuv420p, faststart) zwezone do 1920 px + poster JPG z pierwszej klatki.
 *
 * Wynik laduje w public/media/, a opis wszystkiego (wymiary, sciezki, placeholdery)
 * w data/media.json - to jedyne zrodlo prawdy dla komponentow.
 *
 * Uruchomienie:  npm run media          (tylko brakujace pliki)
 *                npm run media -- --force   (od nowa)
 */

import { readFile, writeFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "media");
const MANIFEST = path.join(ROOT, "data", "media.json");

const FORCE = process.argv.includes("--force");

/** Szerokosci generowane dla kazdego zdjecia. Wieksze zrodla dostaja wiecej wariantow. */
const IMAGE_WIDTHS = [640, 1280, 1920, 2560];
const IMAGE_QUALITY = 78;

/** Filmy sa tlem/petla - dzwiek jest zbedny, a bez niego plik jest wyraznie lzejszy. */
const VIDEO_MAX_WIDTH = 1920;
const VIDEO_CRF = 24;

/**
 * Osobny, lzejszy wariant na telefon. Kadr 1920 px trzeba tam i tak zmniejszyc do
 * szerokosci ekranu, a samo dekodowanie zjada baterie i potrafi zaciac przewijanie -
 * przy dwoch filmach naraz (hero podmienia ujecia) bylo to widoczne golym okiem.
 */
const VIDEO_MOBILE_WIDTH = 900;
const VIDEO_MOBILE_CRF = 26;

/** ffmpeg z wingeta nie trafia do PATH kazdej powloki, wiec szukamy go tez recznie. */
function resolveFfmpegBin(name) {
  const wingetBin = path.join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin",
    `${name}.exe`,
  );
  return existsSync(wingetBin) ? wingetBin : name;
}

const FFMPEG = resolveFfmpegBin("ffmpeg");
const FFPROBE = resolveFfmpegBin("ffprobe");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png"]);
const VIDEO_EXT = new Set([".mp4", ".avi", ".mov"]);

/** "8A HARRIER" -> "8a-harrier"; uzywane tez w data/projects.json. */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Sortuje "1.jpg, 2.jpg, 10.jpg" po ludzku, a nie leksykalnie. */
function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Sredni kolor kadru w przestrzeni Lab - w niej odleglosc miedzy barwami
 * odpowiada temu, co widzi oko, wiec da sie na jej podstawie dobierac ujecia.
 *
 * Konwersje robimy sami. `sharp` potrafi zwrocic Lab, ale w surowym buforze
 * uint8, gdzie ujemne a/b zawijaja sie na ~250 - chlodne kadry wychodzilyby
 * wtedy jako skrajnie cieple.
 */
async function colorSignature(file) {
  const { data, info } = await sharp(file, { failOn: "none" })
    .resize(16, 16, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < pixels; i++) {
    const o = i * info.channels;
    r += data[o];
    g += data[o + 1];
    b += data[o + 2];
  }

  return rgbToLab(r / pixels, g / pixels, b / pixels);
}

function rgbToLab(r, g, b) {
  // sRGB -> liniowe RGB
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  // liniowe RGB -> XYZ (D65), znormalizowane do bieli
  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047;
  const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
  const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    L: Number((116 * fy - 16).toFixed(2)),
    a: Number((500 * (fx - fy)).toFixed(2)),
    b: Number((200 * (fy - fz)).toFixed(2)),
  };
}

async function probeVideo(file) {
  const { stdout } = await run(FFPROBE, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-show_entries", "format=duration",
    "-of", "json",
    file,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] ?? {};
  return {
    width: stream.width ?? 0,
    height: stream.height ?? 0,
    duration: Number(data.format?.duration ?? 0),
  };
}

async function processImage(srcFile, outBase) {
  const image = sharp(srcFile, { failOn: "none" });
  const meta = await image.metadata();
  const sources = [];

  for (const width of IMAGE_WIDTHS) {
    // Nie powiekszamy - zrodlo wezsze od progu zostaje przy swojej szerokosci.
    // Ten wariant MUSI powstac: bez niego zdjecie 1200 px dostawalo tylko 640 px
    // i uklad rozciagal je na 845 px w kaflu albo na 1520 px na stronie projektu.
    const target = Math.min(width, meta.width);
    const outFile = `${outBase}-${target}.webp`;

    if (!sources.some((source) => source.width === target)) {
      if (FORCE || !existsSync(outFile)) {
        await sharp(srcFile, { failOn: "none" })
          .resize({ width: target, withoutEnlargement: true })
          .webp({ quality: IMAGE_QUALITY, effort: 5 })
          .toFile(outFile);
      }
      sources.push({ width: target, src: toPublicPath(outFile) });
    }

    if (width >= meta.width) break;
  }

  // Rozmyty placeholder wstawiany inline, zeby siatka nie skakala przed doczytaniem zdjecia.
  const blurBuffer = await sharp(srcFile, { failOn: "none" })
    .resize({ width: 20 })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    width: meta.width,
    height: meta.height,
    aspectRatio: Number((meta.width / meta.height).toFixed(4)),
    // Kolor liczymy z najmniejszego wariantu - jest juz na dysku i czyta sie w mgnieniu.
    color: await colorSignature(path.join(ROOT, "public", sources[0].src.slice(1))),
    sources,
    blurDataURL: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
  };
}

async function processVideo(srcFile, outBase) {
  const meta = await probeVideo(srcFile);
  const mp4 = `${outBase}.mp4`;
  const poster = `${outBase}-poster.webp`;

  if (FORCE || !existsSync(mp4)) {
    // scale wymusza parzyste wymiary (-2), inaczej h264 odmawia wspolpracy.
    await run(FFMPEG, [
      "-y", "-i", srcFile,
      "-an",
      "-vf", `scale='min(${VIDEO_MAX_WIDTH},iw)':-2:flags=lanczos`,
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", String(VIDEO_CRF),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      mp4,
    ]);
  }

  const mobile = `${outBase}-mobile.mp4`;
  const potrzebnyMobile = meta.width > VIDEO_MOBILE_WIDTH;
  if (potrzebnyMobile && (FORCE || !existsSync(mobile))) {
    await run(FFMPEG, [
      "-y", "-i", srcFile,
      "-an",
      "-vf", `scale='min(${VIDEO_MOBILE_WIDTH},iw)':-2:flags=lanczos`,
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", String(VIDEO_MOBILE_CRF),
      "-profile:v", "main",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      mobile,
    ]);
  }

  if (FORCE || !existsSync(poster)) {
    const tmpPng = `${outBase}-frame.png`;
    await run(FFMPEG, ["-y", "-i", srcFile, "-frames:v", "1", "-vf", `scale='min(1920,iw)':-2`, tmpPng]);
    await sharp(tmpPng).webp({ quality: 72 }).toFile(poster);
    await unlink(tmpPng);
  }

  const outMeta = await probeVideo(mp4);
  return {
    src: toPublicPath(mp4),
    srcMobile: potrzebnyMobile ? toPublicPath(mobile) : toPublicPath(mp4),
    poster: toPublicPath(poster),
    width: outMeta.width,
    height: outMeta.height,
    aspectRatio: outMeta.height ? Number((outMeta.width / outMeta.height).toFixed(4)) : 0,
    color: await colorSignature(poster),
    duration: Number(meta.duration.toFixed(2)),
    sourceBytes: (await stat(srcFile)).size,
    outputBytes: (await stat(mp4)).size,
  };
}

function toPublicPath(absFile) {
  return "/" + path.relative(path.join(ROOT, "public"), absFile).split(path.sep).join("/");
}

/** Przerabia jeden folder zrodlowy na wpis w manifescie. */
async function processDir(srcDir, outSubdir, label) {
  const absSrc = path.join(ROOT, srcDir);
  if (!existsSync(absSrc)) {
    console.warn(`  pomijam ${srcDir} - nie ma takiego folderu`);
    return { images: [], videos: [] };
  }

  const absOut = path.join(OUT_DIR, outSubdir);
  await mkdir(absOut, { recursive: true });

  const entries = (await readdir(absSrc, { withFileTypes: true }))
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort(naturalSort);

  const images = [];
  const videos = [];

  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    const stem = slugify(path.basename(name, path.extname(name)));
    const srcFile = path.join(absSrc, name);

    try {
      if (IMAGE_EXT.has(ext)) {
        const result = await processImage(srcFile, path.join(absOut, stem));
        images.push({ id: stem, sourceFile: name, ...result });
        process.stdout.write(`  ${label}/${name} -> ${result.sources.length} wariantow\n`);
      } else if (VIDEO_EXT.has(ext)) {
        const result = await processVideo(srcFile, path.join(absOut, stem));
        const mb = (n) => (n / 1048576).toFixed(1);
        videos.push({ id: stem, sourceFile: name, ...result });
        process.stdout.write(
          `  ${label}/${name} -> ${mb(result.sourceBytes)}MB => ${mb(result.outputBytes)}MB\n`,
        );
      }
    } catch (error) {
      console.error(`  BLAD przy ${label}/${name}: ${error.message}`);
    }
  }

  return { images, videos };
}

async function main() {
  const projectsFile = JSON.parse(await readFile(path.join(ROOT, "data", "projects.json"), "utf8"));
  await mkdir(OUT_DIR, { recursive: true });

  const manifest = { generatedAt: new Date().toISOString(), home: null, projects: {} };

  console.log("HOME (animacje tla)");
  manifest.home = await processDir("HOME", "home", "HOME");

  for (const project of projectsFile.projects) {
    console.log(project.title);
    manifest.projects[project.slug] = await processDir(
      project.sourceDir,
      path.join("projects", project.slug),
      project.title,
    );
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  const totals = Object.values(manifest.projects).concat([manifest.home]);
  const imageCount = totals.reduce((sum, p) => sum + p.images.length, 0);
  const videoCount = totals.reduce((sum, p) => sum + p.videos.length, 0);
  console.log(`\nGotowe: ${imageCount} zdjec, ${videoCount} filmow. Manifest: data/media.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
