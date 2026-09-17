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
    // Nie powiekszamy - jesli zrodlo jest wezsze, zostaje przy swojej szerokosci.
    if (width > meta.width && sources.length > 0) break;
    const target = Math.min(width, meta.width);
    const outFile = `${outBase}-${target}.webp`;
    if (FORCE || !existsSync(outFile)) {
      await sharp(srcFile, { failOn: "none" })
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: IMAGE_QUALITY, effort: 5 })
        .toFile(outFile);
    }
    sources.push({ width: target, src: toPublicPath(outFile) });
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

  if (FORCE || !existsSync(poster)) {
    const tmpPng = `${outBase}-frame.png`;
    await run(FFMPEG, ["-y", "-i", srcFile, "-frames:v", "1", "-vf", `scale='min(1920,iw)':-2`, tmpPng]);
    await sharp(tmpPng).webp({ quality: 72 }).toFile(poster);
    await unlink(tmpPng);
  }

  const outMeta = await probeVideo(mp4);
  return {
    src: toPublicPath(mp4),
    poster: toPublicPath(poster),
    width: outMeta.width,
    height: outMeta.height,
    aspectRatio: outMeta.height ? Number((outMeta.width / outMeta.height).toFixed(4)) : 0,
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
