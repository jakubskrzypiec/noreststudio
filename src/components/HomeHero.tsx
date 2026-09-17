"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoAsset } from "@/lib/media";
import { AutoVideo } from "./AutoVideo";

/**
 * Pełnoekranowe tło strony głównej.
 *
 * Rytm wzięty ze strony referencyjnej: leci jeden film na całym ekranie, po czym
 * drugi **wcina się w prawą połowę kadru**, a po chwili kadr wraca do jednego filmu.
 * Zmiany są twardymi cięciami, bez animowanego wjazdu — tam podział jest cięciem
 * montażowym wewnątrz materiału, nie efektem strony.
 *
 * Trzy rzeczy, których pilnuje ten komponent, bo każda z nich potrafiła zepsuć tło:
 *
 * 1. **Żaden klip nie leci dwa razy pod rząd.** Wcześniej klip, który wciął się
 *    w połowę kadru, zaraz potem przejmował cały ekran — widz oglądał to samo ujęcie
 *    dwa razy. Dlatego po podziale wchodzi *kolejny* klip, a nie ten z prawej połowy.
 *
 * 2. **Cięcie następuje dopiero, gdy nowy klip ma dane do grania.** Stały odstęp
 *    nie wystarczał: przy wolniejszym łączu kadr przeskakiwał na nieprzygotowany
 *    film i pokazywał plakat albo czerń. Czekamy na `canplay`, z limitem czasu,
 *    żeby zacięty plik nie zatrzymał całego cyklu.
 *
 * 3. **Każdy klip ma własny element `<video>` o stałym kluczu.** Podmiana `src`
 *    w istniejącym elemencie kasowała obraz na moment — stąd mignięcia.
 *
 * Dalsza kolejność jest losowana przy każdym wejściu. Pierwszy kadr zostaje stały,
 * bo wychodzi z serwerowego HTML-u — losowanie go w renderze rozjechałoby hydratację
 * z zawartością pliku strony.
 */

/** Ile widać pojedynczy kadr, zanim wetnie się następny. */
const HOLD_SINGLE_MS = 5000;

/** Jak długo ekran zostaje podzielony. */
const HOLD_SPLIT_MS = 4000;

/** Odstęp po cięciu, zanim cykl ruszy dalej. Samo cięcie jest natychmiastowe. */
const CUT_SETTLE_MS = 120;

/** Najdłuższe czekanie na gotowość klipu; potem tniemy mimo wszystko. */
const READY_TIMEOUT_MS = 6000;

/** Pozycje krawędzi: film schowany, połowa kadru, cały kadr. */
const EDGE_HIDDEN = 100;
const EDGE_HALF = 50;
const EDGE_FULL = 0;

type Layer = {
  key: string;
  clip: VideoAsset;
  /** Lewa krawędź w procentach szerokości: 100 = niewidoczny, 50 = pół kadru, 0 = cały. */
  edge: number;
};

type Phase = "hold-single" | "cue-split" | "hold-split" | "cue-single" | "settle";

/** Rosnący numer wystąpienia warstwy — zapewnia unikalne klucze w Reakcie. */
let layerSeq = 0;

/** Fisher-Yates — kolejność klipów na ten jeden pobyt na stronie. */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function HomeHero({ videos }: { videos: VideoAsset[] }) {
  const playlist = useMemo(() => videos.filter((video) => video.src), [videos]);

  /**
   * Pierwszy kadr jest zawsze ten sam, bo wychodzi z serwerowego HTML-u —
   * gdyby losować go w renderze, hydratacja zastałaby inny plik niż w pliku strony.
   * Losowana jest dopiero dalsza kolejność.
   */
  const [layers, setLayers] = useState<Layer[]>(() =>
    playlist[0] ? [{ key: `${playlist[0].id}#start`, clip: playlist[0], edge: EDGE_FULL }] : [],
  );
  const [phase, setPhase] = useState<Phase>("hold-single");

  /** Co zostało w bieżącej rundzie i co właśnie zeszło z ekranu. */
  const queue = useRef<VideoAsset[]>([]);
  const lastShown = useRef<string | null>(playlist[0]?.id ?? null);

  /**
   * Kilka ostatnio pokazanych ujęć. Sama losowa kolejność potrafiła przywrócić
   * ten sam klip już po dwóch innych, co przy ośmiu plikach rzucało się w oczy.
   */
  const recent = useRef<string[]>(playlist[0] ? [playlist[0].id] : []);
  const recentLimit = Math.max(0, Math.min(3, playlist.length - 2));

  /**
   * Losowanie dzieje się tutaj, a nie w renderze ani w efekcie: funkcję woła
   * dopiero zegar cyklu, więc serwer i klient renderują to samo.
   */
  const takeNext = useCallback(
    (naEkranie: Set<string>): VideoAsset | undefined => {
      const refill = () => {
        const fresh = shuffled(playlist);
        // Nowa runda nie zaczyna się ujęciem, które przed chwilą było na ekranie.
        if (fresh.length > 1 && fresh[0].id === lastShown.current) {
          fresh.push(fresh.shift()!);
        }
        queue.current = fresh;
      };

      const zapamietaj = (clip: VideoAsset) => {
        lastShown.current = clip.id;
        recent.current = [clip.id, ...recent.current].slice(0, recentLimit);
        return clip;
      };

      if (queue.current.length === 0) refill();

      // Kolejka zawiera też klipy, które właśnie widać albo dopiero co zeszły —
      // te przekładamy na koniec, zamiast pokazywać ten sam materiał ponownie.
      for (let proba = 0; proba < playlist.length; proba++) {
        if (queue.current.length === 0) refill();
        const clip = queue.current.shift();
        if (!clip) return undefined;
        if (!naEkranie.has(clip.id) && !recent.current.includes(clip.id)) {
          return zapamietaj(clip);
        }
        queue.current.push(clip);
      }

      // Za mało materiału, żeby spełnić oba warunki — bierzemy cokolwiek spoza ekranu.
      const zapas =
        queue.current.find((clip) => !naEkranie.has(clip.id)) ?? queue.current[0];
      if (!zapas) return undefined;
      queue.current = queue.current.filter((clip) => clip !== zapas);
      return zapamietaj(zapas);
    },
    [playlist, recentLimit],
  );

  /** Klucze klipów, które zgłosiły gotowość. */
  const ready = useRef(new Set<string>());
  const [readySignal, setReadySignal] = useState(0);

  const markReady = useCallback((key: string) => {
    if (ready.current.has(key)) return;
    ready.current.add(key);
    setReadySignal((value) => value + 1);
  }, []);

  /** Dokłada klip jako niewidoczną warstwę na wierzch, żeby zdążył się wczytać. */
  const addLayer = useCallback((clip: VideoAsset) => {
    // Ten sam klip może wrócić w kolejnej rundzie, więc klucz musi być unikalny
    // dla każdego wystąpienia — inaczej React uznałby to za ten sam element.
    const key = `${clip.id}#${layerSeq++}`;
    setLayers((current) => [...current, { key, clip, edge: EDGE_HIDDEN }]);
  }, []);

  const [splitAllowed, setSplitAllowed] = useState(true);

  // Na telefonie podział na dwa pionowe pasy jest nieczytelny — tam po prostu
  // wchodzi kolejny klip na cały ekran.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setSplitAllowed(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (playlist.length < 2 || layers.length === 0) return;

    const after = (delay: number, step: () => void) => {
      const timer = window.setTimeout(step, delay);
      return () => window.clearTimeout(timer);
    };

    /**
     * Czeka na gotowość ostatniej warstwy, ale nie dłużej niż limit.
     * Gotowy klip też przechodzi przez `setTimeout`, żeby nie zmieniać stanu
     * w trakcie samego efektu.
     */
    const whenTopReady = (step: () => void) => {
      const top = layers[layers.length - 1];
      const gotowy = top !== undefined && ready.current.has(top.key);
      return after(gotowy ? 0 : READY_TIMEOUT_MS, step);
    };

    /** Ustawia krawędź ostatniej warstwy — to jest właśnie cięcie. */
    const cutTopTo = (edge: number) =>
      setLayers((current) =>
        current.map((layer, index) => (index === current.length - 1 ? { ...layer, edge } : layer)),
      );

    const naEkranie = new Set(layers.map((layer) => layer.clip.id));

    switch (phase) {
      case "hold-single":
        return after(HOLD_SINGLE_MS, () => {
          const clip = takeNext(naEkranie);
          if (!clip) return;
          addLayer(clip);
          setPhase(splitAllowed ? "cue-split" : "cue-single");
        });

      case "cue-split":
        return whenTopReady(() => {
          cutTopTo(EDGE_HALF);
          setPhase("hold-split");
        });

      case "hold-split":
        return after(HOLD_SPLIT_MS, () => {
          const clip = takeNext(naEkranie);
          if (!clip) return;
          // Kolejny klip, nie ten z prawej połowy — inaczej to samo ujęcie leciałoby dwa razy.
          addLayer(clip);
          setPhase("cue-single");
        });

      case "cue-single":
        return whenTopReady(() => {
          cutTopTo(EDGE_FULL);
          setPhase("settle");
        });

      case "settle":
        return after(CUT_SETTLE_MS, () => {
          // Wierzchnia warstwa zakrywa już cały ekran, więc odrzucenie reszty
          // jest niewidoczne, a jej własny element `<video>` gra dalej bez przerwy.
          setLayers((current) => {
            const top = current[current.length - 1];
            ready.current = new Set([top.key]);
            return [top];
          });
          setPhase("hold-single");
        });
    }
  }, [phase, layers, playlist.length, splitAllowed, takeNext, addLayer, readySignal]);

  if (layers.length === 0) {
    return <div className="absolute inset-0 bg-paper" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {layers.map((layer, index) => (
        <div
          key={layer.key}
          className="absolute inset-0"
          style={{
            zIndex: 10 + index,
            clipPath: layer.edge > 0 ? `inset(0 0 0 ${layer.edge}%)` : undefined,
          }}
        >
          <AutoVideo
            video={layer.clip}
            ariaLabel="NOREST STUDIO"
            preload="auto"
            onReady={() => markReady(layer.key)}
            className="h-full w-full object-cover"
          />
        </div>
      ))}

      {/* Delikatne przyciemnienie u góry, żeby logo i menu były czytelne na jasnym renderze. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-40 bg-gradient-to-b from-black/25 to-transparent" />
    </div>
  );
}
