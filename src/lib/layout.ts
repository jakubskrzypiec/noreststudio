/**
 * Układanie kadrów projektu w dwukolumnową siatkę bez dziur.
 *
 * Problem: dwa wąskie kadry obok siebie mają różne proporcje, więc jeden kończy się
 * wyżej i pod nim zostaje pusta połowa wiersza. Na materiale NoRest wychodziło tak
 * w 26 z 33 par, średnio 155 px dziury, najgorzej 472 px.
 *
 * Rozwiązanie: wąskie kadry parujemy po **zbliżonych proporcjach**, a wiersz dostaje
 * wspólną wysokość, więc dziura znika. Wyższy kadr jest wtedy minimalnie przycięty —
 * i tylko dlatego para w ogóle powstaje: jeśli zrównanie wysokości kosztowałoby więcej
 * niż `MAX_ROW_CROP`, kadr idzie na pełną szerokość, gdzie nic nie traci.
 *
 * Na obecnym materiale daje to 25 par przy średnim przycięciu 1,5% (najgorsze 5,8%)
 * i 47 kadrów na pełnej szerokości — zamiast 26 dziur.
 */

import type { ImageAsset, VideoAsset } from "./media";

/** Od tej proporcji kadr uznajemy za panoramiczny i dajemy mu pełną szerokość. */
const WIDE_FROM = 1.6;

/** Ile wolno uciąć wyższemu kadrowi, żeby wyrównać wiersz. */
const MAX_ROW_CROP = 0.06;

export type MediaItem =
  | { kind: "video"; asset: VideoAsset }
  | { kind: "image"; asset: ImageAsset; position: number };

export type PlacedItem = MediaItem & {
  /** Zajmuje pełną szerokość wiersza. */
  full: boolean;
  /**
   * Proporcje pojemnika w układzie dwukolumnowym. Dla pary wspólne — to właśnie
   * one wyrównują wysokość. Dla pełnej szerokości równe własnym, więc bez przycięcia.
   */
  rowRatio: number;
};

export function isWide(aspectRatio: number): boolean {
  return aspectRatio >= WIDE_FROM;
}

/**
 * Ile traci wyższy kadr, gdy oba dostaną wspólną wysokość.
 * Przy stałej szerokości wysokość to `szerokość / proporcje`, więc wspólną wysokość
 * wyznaczają większe proporcje, a przycięty zostaje kadr o mniejszych.
 */
function rowCrop(a: number, b: number): number {
  return 1 - Math.min(a, b) / Math.max(a, b);
}

export function placeMedia(items: MediaItem[]): PlacedItem[] {
  const placed: PlacedItem[] = [];
  const pending = [...items];

  const asFull = (item: MediaItem): PlacedItem => ({
    ...item,
    full: true,
    rowRatio: item.asset.aspectRatio,
  });

  while (pending.length > 0) {
    const item = pending.shift()!;

    if (isWide(item.asset.aspectRatio)) {
      placed.push(asFull(item));
      continue;
    }

    // Szukamy wśród pozostałych wąskich kadru o najbliższych proporcjach.
    let best = -1;
    for (let i = 0; i < pending.length; i++) {
      const candidate = pending[i];
      if (isWide(candidate.asset.aspectRatio)) continue;
      if (
        best === -1 ||
        rowCrop(item.asset.aspectRatio, candidate.asset.aspectRatio) <
          rowCrop(item.asset.aspectRatio, pending[best].asset.aspectRatio)
      ) {
        best = i;
      }
    }

    if (best === -1) {
      placed.push(asFull(item));
      continue;
    }

    const partner = pending[best];
    const crop = rowCrop(item.asset.aspectRatio, partner.asset.aspectRatio);
    if (crop > MAX_ROW_CROP) {
      // Nic dość podobnego — lepiej pokazać ten kadr w całości niż ciąć go dla wiersza.
      placed.push(asFull(item));
      continue;
    }

    pending.splice(best, 1);
    const rowRatio = Math.max(item.asset.aspectRatio, partner.asset.aspectRatio);
    placed.push({ ...item, full: false, rowRatio }, { ...partner, full: false, rowRatio });
  }

  return placed;
}
