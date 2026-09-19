"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoAsset } from "@/lib/media";
import { AutoVideo } from "./AutoVideo";

/**
 * Pełnoekranowe tło strony głównej: jeden kadr na cały ekran, zmieniany twardym cięciem.
 *
 * Czasy wynikają z długości konkretnego pliku, a nie ze stałej wartości. Klipy mają
 * od 5,04 do 9,04 s, a przy sztywnych 6 s cztery z ośmiu zapętlały się na ekranie
 * i widać było skok do pierwszej klatki. Każdy kadr jest teraz zdejmowany, zanim
 * dobiegnie końca, i zaczyna od zerowej klatki dokładnie w chwili wejścia.
 *
 * Ten skok wracał wielokrotnie, więc jest zabezpieczony na trzy sposoby:
 * klipy nie mają zapętlenia (opóźnione cięcie przytrzyma ostatnią klatkę, a nie
 * przeskoczy na początek), następny kadr jest montowany z wyprzedzeniem pod bieżącym
 * i tam się buforuje, a czekanie na gotowość ma krótki limit.
 *
 * Kolejność jest losowana przy każdym wejściu, z pamięcią kilku ostatnich ujęć,
 * żeby ten sam kadr nie wracał po chwili. Pierwszy kadr zostaje stały, bo wychodzi
 * z serwerowego HTML-u — losowanie go w renderze rozjechałoby hydratację.
 */

/** Zapas na samo cięcie, doliczany do budżetu kadru. */
const CUT_MARGIN_MS = 120;

/** Najdłuższe czekanie na gotowość klipu; potem tniemy mimo wszystko. */
const READY_TIMEOUT_MS = 2500;

/** Zapas przed końcem pliku — żeby żaden kadr nie zdążył dobiec do końca na ekranie. */
const CUT_LEAD_MS = 350;

type Layer = {
  key: string;
  clip: VideoAsset;
};

type Phase = "hold" | "cue";

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

/**
 * Ile kadr może zostać na ekranie. Odejmujemy dwa odstępy: ten, po którym sam wszedł,
 * i ten, po którym zostanie zdjęty — oba mieszczą się w długości pliku.
 */
function holdMs(clip: VideoAsset) {
  return Math.max(2000, clip.duration * 1000 - CUT_LEAD_MS - 2 * CUT_MARGIN_MS);
}

export function HomeHero({ videos }: { videos: VideoAsset[] }) {
  const playlist = useMemo(() => videos.filter((video) => video.src), [videos]);

  const [layers, setLayers] = useState<Layer[]>(() =>
    playlist[0] ? [{ key: `${playlist[0].id}#start`, clip: playlist[0] }] : [],
  );
  const [phase, setPhase] = useState<Phase>("hold");

  /** Elementy wideo po kluczu warstwy — potrzebne, by przewinąć klip na start. */
  const elements = useRef(new Map<string, HTMLVideoElement>());

  /** Co zostało w bieżącej rundzie i co ostatnio poszło na ekran. */
  const queue = useRef<VideoAsset[]>([]);
  const lastShown = useRef<string | null>(playlist[0]?.id ?? null);

  /** Kilka ostatnio pokazanych ujęć, żeby ten sam kadr nie wracał po chwili. */
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

    const base = layers[0];
    const top = layers[layers.length - 1];
    const naEkranie = new Set(layers.map((layer) => layer.clip.id));

    switch (phase) {
      case "hold":
        return after(holdMs(base.clip), () => {
          const clip = takeNext(naEkranie);
          if (!clip) return;
          // Nowy kadr wchodzi POD bieżący, nie w ukryciu: może się buforować i grać,
          // a użytkownik go nie widzi, bo tło zasłania cały ekran.
          setLayers((current) => [...current, { key: `${clip.id}#${layerSeq++}`, clip }]);
          setPhase("cue");
        });

      case "cue": {
        const gotowy = ready.current.has(top.key);
        // Gotowy klip też przechodzi przez zegar, żeby nie zmieniać stanu w trakcie efektu.
        return after(gotowy ? 0 : READY_TIMEOUT_MS, () => {
          const element = elements.current.get(top.key);
          if (element) {
            // Klip grał zasłonięty, żeby się zbuforować — w kadr ma wejść od pierwszej klatki.
            try {
              element.currentTime = 0;
            } catch {
              /* przewijanie bywa odrzucane, zanim metadane dojdą — nie blokuje cięcia */
            }
            // Kilka podejsc: na telefonie pierwsze `play()` po cieciu bywa odrzucane
            // i kadr stal na pierwszej klatce do czasu dotkniecia ekranu.
            const zagraj = (proba: number) => {
              element.play().catch(() => {});
              if (proba < 4) window.setTimeout(() => element.paused && zagraj(proba + 1), 200);
            };
            zagraj(0);
          }
          // Zdjęcie bieżącego tła odsłania nowy kadr — to jest samo cięcie.
          setLayers((current) => {
            const ostatni = current[current.length - 1];
            ready.current = new Set([ostatni.key]);
            for (const [key] of elements.current) {
              if (key !== ostatni.key) elements.current.delete(key);
            }
            return [ostatni];
          });
          setPhase("hold");
        });
      }
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
          /*
           * Bieżące tło jest na wierzchu, czekający kadr pod nim. Świadomie nie
           * używamy tu `visibility: hidden` ani `display: none`: Chrome na Androidzie
           * nie pozwala wystartować niewidocznemu filmowi, więc kolejny kadr wchodził
           * zatrzymany na pierwszej klatce i trzeba go było kliknąć. Zasłonięty
           * element jest dla przeglądarki widoczny i spokojnie się rozgrywa.
           */
          style={{ zIndex: index === 0 ? 20 : 10 }}
        >
          <AutoVideo
            video={layer.clip}
            ariaLabel="NOREST STUDIO"
            preload="auto"
            // Bez zapętlenia: opóźnione cięcie przytrzyma ostatnią klatkę, nie skoczy na pierwszą.
            loop={false}
            onReady={() => markReady(layer.key)}
            elementRef={(element) => {
              // Tylko zapisujemy. Usuwaniem zajmuje sie ciecie w fazie `cue`, zeby chwilowe
              // odpiecie referencji nie zabralo uchwytu potrzebnego przy cieciu.
              if (element) elements.current.set(layer.key, element);
            }}
            className="h-full w-full object-cover"
          />
        </div>
      ))}

      {/* Delikatne przyciemnienie u góry, żeby logo i menu były czytelne na jasnym renderze. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-40 bg-gradient-to-b from-black/25 to-transparent" />
    </div>
  );
}
