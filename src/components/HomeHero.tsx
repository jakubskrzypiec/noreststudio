"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoAsset } from "@/lib/media";
import { AutoVideo } from "./AutoVideo";

/**
 * Pełnoekranowe tło strony głównej: jeden klip na cały kadr, zmieniany twardym cięciem.
 *
 * Był tu wcześniej podział ekranu na pół, wzorowany na stronie referencyjnej.
 * Nie utrzymał się, bo tam podział jest **zmontowany w samym materiale** — każda
 * połówka jest skomponowana pod połowę kadru. Nasze klipy są poziome (proporcje
 * od 1.17 do 2.41), a połowa ekranu laptopa jest pionowa (0.80), więc `object-cover`
 * zostawiał średnio 43% kadru, a z najszerszych ujęć ledwie 33%. Przy wizualizacjach
 * architektonicznych, gdzie liczy się kompozycja, to nie do obrony. Na pełnym ekranie
 * widać średnio 78%.
 *
 * Dwie rzeczy, których pilnuje ten komponent, bo obie potrafiły zepsuć tło:
 *
 * 1. **Cięcie następuje dopiero, gdy nowy klip ma dane do grania.** Stały odstęp
 *    nie wystarczał: przy wolniejszym łączu kadr przeskakiwał na nieprzygotowany
 *    film i pokazywał plakat albo czerń. Czekamy na `canplay`, z limitem czasu,
 *    żeby zacięty plik nie zatrzymał całego cyklu.
 *
 * 2. **Każdy klip ma własny element `<video>` o unikalnym kluczu.** Podmiana `src`
 *    w istniejącym elemencie kasowała obraz na moment — stąd mignięcia.
 *
 * Kolejność jest losowana przy każdym wejściu, z pamięcią kilku ostatnich ujęć,
 * żeby ten sam klip nie wracał po chwili. Pierwszy kadr zostaje stały, bo wychodzi
 * z serwerowego HTML-u — losowanie go w renderze rozjechałoby hydratację.
 */

/** Ile widać jeden kadr, zanim wetnie się następny. */
const HOLD_MS = 6000;

/** Odstęp po cięciu, zanim cykl ruszy dalej. Samo cięcie jest natychmiastowe. */
const CUT_SETTLE_MS = 120;

/** Najdłuższe czekanie na gotowość klipu; potem tniemy mimo wszystko. */
const READY_TIMEOUT_MS = 6000;

type Layer = {
  key: string;
  clip: VideoAsset;
  /** Warstwa czeka w ukryciu, dopóki się nie wczyta. */
  hidden: boolean;
};

type Phase = "hold" | "cue" | "settle";

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

  const [layers, setLayers] = useState<Layer[]>(() =>
    playlist[0] ? [{ key: `${playlist[0].id}#start`, clip: playlist[0], hidden: false }] : [],
  );
  const [phase, setPhase] = useState<Phase>("hold");

  /** Co zostało w bieżącej rundzie i co ostatnio poszło na ekran. */
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
      const zapas = queue.current.find((clip) => !naEkranie.has(clip.id)) ?? queue.current[0];
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

  useEffect(() => {
    if (playlist.length < 2 || layers.length === 0) return;

    const after = (delay: number, step: () => void) => {
      const timer = window.setTimeout(step, delay);
      return () => window.clearTimeout(timer);
    };

    const naEkranie = new Set(layers.map((layer) => layer.clip.id));

    switch (phase) {
      case "hold":
        return after(HOLD_MS, () => {
          const clip = takeNext(naEkranie);
          if (!clip) return;
          // Dokładamy w ukryciu, żeby klip zdążył się wczytać przed cięciem.
          setLayers((current) => [
            ...current,
            { key: `${clip.id}#${layerSeq++}`, clip, hidden: true },
          ]);
          setPhase("cue");
        });

      case "cue": {
        const top = layers[layers.length - 1];
        const gotowy = top !== undefined && ready.current.has(top.key);
        // Gotowy klip też przechodzi przez zegar, żeby nie zmieniać stanu w trakcie efektu.
        return after(gotowy ? 0 : READY_TIMEOUT_MS, () => {
          setLayers((current) =>
            current.map((layer, index) =>
              index === current.length - 1 ? { ...layer, hidden: false } : layer,
            ),
          );
          setPhase("settle");
        });
      }

      case "settle":
        return after(CUT_SETTLE_MS, () => {
          // Wierzchnia warstwa zakrywa już cały ekran, więc odrzucenie poprzedniej
          // jest niewidoczne, a jej własny element `<video>` gra dalej bez przerwy.
          setLayers((current) => {
            const top = current[current.length - 1];
            ready.current = new Set([top.key]);
            return [top];
          });
          setPhase("hold");
        });
    }
  }, [phase, layers, playlist.length, takeNext, readySignal]);

  if (layers.length === 0) {
    return <div className="absolute inset-0 bg-paper" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {layers.map((layer, index) => (
        <div
          key={layer.key}
          className="absolute inset-0"
          style={{ zIndex: 10 + index, visibility: layer.hidden ? "hidden" : "visible" }}
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
