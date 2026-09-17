/**
 * Warstwa dostępu do mediów.
 *
 * `data/projects.json` opisuje projekty (nazwy, klient, data), a `data/media.json`
 * jest wynikiem `npm run media` i zawiera już przekonwertowane pliki z public/media.
 * Komponenty korzystają wyłącznie z tych funkcji, żeby nie znać układu katalogów.
 */

import { asset } from "./assets";
import projectsData from "../../data/projects.json";
import manifestData from "../../data/media.json";

/**
 * Średni kolor kadru w Lab, liczony przez pipeline. Nic go teraz nie czyta —
 * powstał, gdy tło strony głównej zestawiało po dwa ujęcia i trzeba było je
 * dobierać kolorystycznie. Zostaje w manifescie, bo opisuje materiał i nie kosztuje
 * nic poza jedną linią w skrypcie.
 */
export type LabColor = { L: number; a: number; b: number };

export type ImageAsset = {
  id: string;
  sourceFile: string;
  width: number;
  height: number;
  aspectRatio: number;
  color: LabColor;
  sources: { width: number; src: string }[];
  blurDataURL: string;
};

export type VideoAsset = {
  id: string;
  sourceFile: string;
  src: string;
  poster: string;
  width: number;
  height: number;
  aspectRatio: number;
  color: LabColor;
  duration: number;
};

export type MediaBundle = {
  images: ImageAsset[];
  videos: VideoAsset[];
};

export type MediaManifest = {
  generatedAt: string | null;
  home: MediaBundle;
  projects: Record<string, MediaBundle>;
};

export type Project = {
  slug: string;
  title: string;
  sourceDir: string;
  client: string;
  date: string;
  info: string;
  images: string[];
  videos: string[];
};

const EMPTY_BUNDLE: MediaBundle = { images: [], videos: [] };

/**
 * media.json jest nadpisywany przez `npm run media`. W repo leży wersja pusta,
 * żeby projekt budował się także na świeżym klonie, zanim ktokolwiek odpali konwersję.
 */
const manifest = manifestData as unknown as MediaManifest;

/** Czy konwersja mediów została już wykonana — strony używają tego do fallbacków. */
export const mediaReady =
  manifest.home.images.length > 0 || Object.keys(manifest.projects).length > 0;

export const projects = (projectsData.projects as Project[]).filter(
  (project) => project.images.length > 0 || project.videos.length > 0,
);

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export function getProjectMedia(slug: string): MediaBundle {
  return manifest?.projects[slug] ?? EMPTY_BUNDLE;
}

export function getHomeMedia(): MediaBundle {
  return manifest?.home ?? EMPTY_BUNDLE;
}

/**
 * Projekt obok bieżącego — zasila "NEXT PROJECT →". Lista zapętla się,
 * żeby ostatni projekt nie był ślepym zaułkiem.
 */
export function getNextProject(slug: string): Project | undefined {
  const index = projects.findIndex((project) => project.slug === slug);
  if (index === -1) return undefined;
  return projects[(index + 1) % projects.length];
}

/** Pierwsze zdjęcie projektu — okładka w galerii i w liście. */
export function getCover(slug: string): ImageAsset | undefined {
  return getProjectMedia(slug).images[0];
}

/** Buduje srcset z wariantów wygenerowanych przez pipeline. */
export function toSrcSet(image: ImageAsset): string {
  return image.sources.map((source) => `${asset(source.src)} ${source.width}w`).join(", ");
}

/** Największy wariant — używany jako `src` fallbackowy. */
export function largestSrc(image: ImageAsset): string {
  return asset(image.sources[image.sources.length - 1]?.src ?? "");
}


