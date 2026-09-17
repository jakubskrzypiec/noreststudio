/**
 * Układanie kadrów projektu w dwukolumnową siatkę bez dziur.
 *
 * Kadry z renderów mają bardzo różne proporcje. Poziome zajmują pełną szerokość,
 * pionowe i kwadratowe idą po dwa w rzędzie. Problem pojawia się, kiedy wąski kadr
 * nie ma pary — wtedy obok niego zostaje pusta połowa ekranu. Dlatego wąskie kadry
 * łączymy w pary z góry, a taki, który pary nie znalazł, dostaje pełną szerokość.
 */

import type { ImageAsset, VideoAsset } from "./media";

/** Od tej proporcji kadr uznajemy za panoramiczny i dajemy mu pełną szerokość. */
const WIDE_FROM = 1.6;

export type MediaItem =
  | { kind: "video"; asset: VideoAsset }
  | { kind: "image"; asset: ImageAsset; position: number };

export type PlacedItem = MediaItem & { full: boolean };

export function isWide(aspectRatio: number): boolean {
  return aspectRatio >= WIDE_FROM;
}

/**
 * Zwraca kadry w kolejności wyświetlania, każdy z informacją, czy zajmuje
 * pełną szerokość. Gwarantuje, że wąskie kadry występują w parach — żaden
 * nie zostaje sam z pustym miejscem obok.
 */
export function placeMedia(items: MediaItem[]): PlacedItem[] {
  const placed: PlacedItem[] = [];
  let pending: MediaItem | null = null;

  const flushPendingAsFull = () => {
    if (!pending) return;
    placed.push({ ...pending, full: true });
    pending = null;
  };

  for (const item of items) {
    if (isWide(item.asset.aspectRatio)) {
      // Panorama przerywa parowanie, więc czekający kadr musi rozejść się na całą szerokość.
      flushPendingAsFull();
      placed.push({ ...item, full: true });
      continue;
    }

    if (pending) {
      placed.push({ ...pending, full: false }, { ...item, full: false });
      pending = null;
    } else {
      pending = item;
    }
  }

  flushPendingAsFull();
  return placed;
}
