"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { colorDistance, sceneOf, type VideoAsset } from "@/lib/media";
import { AutoVideo } from "./AutoVideo";

/**
 * Pełnoekranowe tło strony głównej.
 *
 * Rytm: jeden klip na cały kadr, po chwili drugi **wcina się po skosie** i przecina
 * ekran, a potem trzeci zabiera całość i cykl zaczyna się od nowa. Każda zmiana jest
 * twardym cięciem — krawędź nie przejeżdża, tylko pojawia się od razu.
 *
 * Kluczowe: **oba klipy są przez cały czas pełnoekranowe**, a ukośna krawędź to
 * maska (`clip-path`). Dzięki temu kadrowanie jest takie samo jak przy jednym
 * filmie — nie wciskamy ujęcia do połowy ekranu, co zjadałoby kompozycję.
 *
 * Partner podziału jest dobierany **najpierw po treści, potem po kolorze**. Kolor
 * sam nie wystarczał: wszystkie ujęcia mają ciepłą paletę, więc zestawiał salon
 * z widokiem z dystansu albo taras z elewacją i mimo zgodnych barw nie czytało się
 * to jako jedna kompozycja. Kategorie siedzą w `data/hero.json`; klip jedyny
 * w swojej kategorii (detal blatu, ujęcie z dystansu) leci zawsze sam.
 *
 * Podział wypada dokładnie pół na pół — środek skosu przechodzi przez środek ekranu.
 *
 * Czasy wynikają z długości konkretnego pliku, a nie ze stałej wartości. Wcześniej
 * każdy klip wisiał 6 s, a cztery z ośmiu mają 5,04 s — zapętlały się na ekranie
 * i widać było skok do pierwszej klatki. Teraz każdy jest zdejmowany, zanim
 * dobiegnie końca, i zaczyna od zera dokładnie w chwili wejścia w kadr.
 *
 * Skok do pierwszej klatki jest tu zabezpieczony na trzy sposoby, bo wracał
 * wielokrotnie: klipy hero nie mają zapętlenia (opóźnione cięcie przytrzyma
 * ostatnią klatkę, a nie przeskoczy na początek), kolejne tło jest dokładane
 * już na starcie podziału, więc ma pełny czas na zbuforowanie, a czekanie na
 * gotowość ma krótki limit.
 */

/** Odstęp po cięciu, zanim cykl ruszy dalej. Samo cięcie jest natychmiastowe. */
const CUT_SETTLE_MS = 120;

/**
 * Najdalsza dopuszczalna odległość barwna partnera podziału. Z pomiarów materiału:
 * pary poniżej 8 pasują, do 14 są znośne, powyżej gryzą się. Klip bez partnera
 * w tym zasięgu leci sam — lepiej pokazać jedno ujęcie niż zderzyć dwie palety.
 */
const MAX_PARTNER_DISTANCE = 14;

/** Najdłuższe czekanie na gotowość klipu; potem tniemy mimo wszystko. */
const READY_TIMEOUT_MS = 2500;

/** Zapas przed końcem pliku — żeby żaden klip nie zdążył się zapętlić. */
const CUT_LEAD_MS = 350;

/** Krótszy podział nie ma sensu — ledwo mrugnie. */
const MIN_SPLIT_MS = 1500;

/** Kiedy zaczynamy wprowadzać partnera, jako część budżetu klipu. */
const SOLO_SHARE = 0.35;

/** Pochylenie krawędzi: różnica między górą i dołem, w procentach szerokości. */
const SKEW = 20;

/**
 * Pozycje krawędzi: poza kadrem, podział, pełne zakrycie.
 * Przy podziale środek skosu wypada dokładnie na 50% szerokości, więc oba kadry
 * dostają równo pół ekranu — górny wierzchołek jest przesunięty o połowę pochylenia.
 */
const EDGE_OFFSCREEN = 130;
const EDGE_SPLIT = 50 + SKEW / 2;
const EDGE_COVER = -30;

type Layer = {
  key: string;
  clip: VideoAsset;
  /** Pozycja górnego wierzchołka ukośnej krawędzi, w procentach szerokości. */
  edge: number;
  /** Znak pochylenia — kolejne warstwy wchodzą raz w jedną, raz w drugą stronę. */
  skew: number;
};

type Phase = "solo" | "cue-partner" | "split" | "cue-next" | "settle";

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
 * Ile klip może być tłem, gdy nie ma podziału (telefon albo za krótki materiał).
 * Odejmujemy dwa przejazdy: ten, którym klip wjechał, i ten, który go zdejmie.
 */
function soloOnlyMs(clip: VideoAsset) {
  return Math.max(2000, clip.duration * 1000 - CUT_LEAD_MS - 2 * CUT_SETTLE_MS);
}

/**
 * Rozkład czasu dla klipu, który właśnie jest tłem. Wszystko musi zmieścić się
 * w jego długości, bo inaczej zapętli się na ekranie.
 *
 * `shortestMs` to długość najkrótszego klipu w zestawie: partner podziału jest
 * losowy, więc podział nie może trwać dłużej, niż wytrzyma najkrótszy materiał.
 */
function scheduleFor(clip: VideoAsset, shortestMs: number) {
  // Klip przegrał już jeden przejazd, kiedy sam wjeżdżał w kadr.
  const budget = Math.max(2000, clip.duration * 1000 - CUT_LEAD_MS - CUT_SETTLE_MS);
  // Ostatni przejazd zdejmuje ten klip z ekranu, więc musi zmieścić się w budżecie.
  const handoverAt = budget - CUT_SETTLE_MS;
  const partnerAt = budget * SOLO_SHARE;
  const partnerBudget = shortestMs - CUT_LEAD_MS - 2 * CUT_SETTLE_MS;
  const splitMs = Math.min(handoverAt - (partnerAt + CUT_SETTLE_MS), partnerBudget);

  return splitMs >= MIN_SPLIT_MS
    ? { withSplit: true as const, partnerAt, splitMs }
    : { withSplit: false as const, soloMs: handoverAt };
}

export function HomeHero({ videos }: { videos: VideoAsset[] }) {
  const playlist = useMemo(() => videos.filter((video) => video.src), [videos]);

  const [layers, setLayers] = useState<Layer[]>(() =>
    playlist[0]
      ? [{ key: `${playlist[0].id}#start`, clip: playlist[0], edge: EDGE_COVER, skew: SKEW }]
      : [],
  );
  const [phase, setPhase] = useState<Phase>("solo");

  /** Elementy wideo po kluczu warstwy — potrzebne, by przewinąć klip na start. */
  const elements = useRef(new Map<string, HTMLVideoElement>());

  /** Co zostało w bieżącej rundzie i co ostatnio poszło na ekran. */
  const queue = useRef<VideoAsset[]>([]);
  const lastShown = useRef<string | null>(playlist[0]?.id ?? null);

  /** Kilka ostatnio pokazanych ujęć, żeby ten sam klip nie wracał po chwili. */
  const recent = useRef<string[]>(playlist[0] ? [playlist[0].id] : []);
  const recentLimit = Math.max(0, Math.min(3, playlist.length - 2));

  /** Najkrótszy klip wyznacza, jak długo może trwać podział. */
  const shortestMs = useMemo(
    () => Math.min(...playlist.map((video) => video.duration * 1000)),
    [playlist],
  );

  /**
   * Losowanie dzieje się tutaj, a nie w renderze ani w efekcie: funkcję woła
   * dopiero zegar cyklu, więc serwer i klient renderują to samo.
   */
  const takeNext = useCallback(
    (naEkranie: Set<string>): VideoAsset | undefined => {
      const refill = () => {
        const fresh = shuffled(playlist);
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

      const zapas = queue.current.find((clip) => !naEkranie.has(clip.id)) ?? queue.current[0];
      if (!zapas) return undefined;
      queue.current = queue.current.filter((clip) => clip !== zapas);
      return zapamietaj(zapas);
    },
    [playlist, recentLimit],
  );

  /**
   * Partner do podziału ekranu.
   *
   * Najpierw **treść**: bierzemy tylko klipy z tej samej kategorii (wnętrze do
   * wnętrza, elewacja do elewacji). Sam kolor nie wystarczał — zestawiał salon
   * z widokiem z lotu ptaka i mimo zgodnej palety nie czytało się to jako jedna
   * kompozycja. Dopiero wśród zgodnych treściowo rozstrzyga kolor.
   *
   * `undefined` znaczy „nie ma z czym zestawić" i klip zostaje sam na pełnym kadrze —
   * tak jest z detalem blatu i z ujęciem z dystansu, bo są jedyne w swoich kategoriach.
   */
  const takePartner = useCallback(
    (base: VideoAsset, naEkranie: Set<string>): VideoAsset | undefined => {
      const scena = sceneOf(base.id);

      const najblizszy = playlist
        .filter((clip) => !naEkranie.has(clip.id) && sceneOf(clip.id) === scena)
        .map((clip) => ({ clip, dystans: colorDistance(base.color, clip.color) }))
        .sort((x, y) => x.dystans - y.dystans)[0];

      if (!najblizszy || najblizszy.dystans > MAX_PARTNER_DISTANCE) return undefined;

      // Partner nie wchodzi do kolejki głównej — ta pilnuje kolejności pełnych kadrów.
      return najblizszy.clip;
    },
    [playlist],
  );

  /** Klucze klipów, które zgłosiły gotowość. */
  const ready = useRef(new Set<string>());
  const [readySignal, setReadySignal] = useState(0);

  const markReady = useCallback((key: string) => {
    if (ready.current.has(key)) return;
    ready.current.add(key);
    setReadySignal((value) => value + 1);
  }, []);

  const [splitAllowed, setSplitAllowed] = useState(true);

  // Na telefonie dwa ujęcia obok siebie zajmują po ~190 px i robi się kasza.
  // Ukośny przejazd zostaje — tylko nie zatrzymuje się w połowie drogi.
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

    const base = layers[0];
    const top = layers[layers.length - 1];
    const plan = splitAllowed
      ? scheduleFor(base.clip, shortestMs)
      : { withSplit: false as const, soloMs: soloOnlyMs(base.clip) };
    const naEkranie = new Set(layers.map((layer) => layer.clip.id));

    /** Dokłada klip poza kadrem, żeby zdążył się wczytać przed cięciem. */
    const queueLayer = (clip: VideoAsset | undefined) => {
      if (!clip) return false;
      setLayers((current) => [
        ...current,
        {
          key: `${clip.id}#${layerSeq++}`,
          clip,
          edge: EDGE_OFFSCREEN,
          // Kolejne warstwy wchodzą z przeciwnym pochyleniem — kadr nie robi się monotonny.
          skew: (current[current.length - 1]?.skew ?? SKEW) > 0 ? -SKEW : SKEW,
        },
      ]);
      return true;
    };

    /** Puszcza klip od początku i wstawia jego krawędź na docelową pozycję — to jest cięcie. */
    const cutTopTo = (edge: number) => {
      const element = elements.current.get(top.key);
      if (element) {
        // Klip grał w ukryciu, żeby się zbuforować — w kadr ma wejść od pierwszej klatki.
        try {
          element.currentTime = 0;
        } catch {
          /* przewijanie bywa odrzucane, zanim metadane dojdą — nie blokuje wjazdu */
        }
        element.play().catch(() => {});
      }
      setLayers((current) =>
        current.map((layer, index) =>
          index === current.length - 1 ? { ...layer, edge } : layer,
        ),
      );
    };

    /** Gotowy klip też przechodzi przez zegar, żeby nie zmieniać stanu w trakcie efektu. */
    const whenTopReady = (step: () => void) =>
      after(ready.current.has(top.key) ? 0 : READY_TIMEOUT_MS, step);

    switch (phase) {
      case "solo": {
        // Partner tylko wtedy, gdy plan zostawia na niego czas i coś pasuje kolorystycznie.
        if (plan.withSplit) {
          const partner = takePartner(base.clip, naEkranie);
          if (partner) {
            return after(plan.partnerAt, () => {
              setPhase(queueLayer(partner) ? "cue-partner" : "solo");
            });
          }
        }
        // Bez partnera klip zostaje sam na pełny swój czas, nie tylko do momentu podziału.
        return after(soloOnlyMs(base.clip), () => {
          setPhase(queueLayer(takeNext(naEkranie)) ? "cue-next" : "solo");
        });
      }

      case "cue-partner":
        return whenTopReady(() => {
          cutTopTo(EDGE_SPLIT);
          setPhase("split");
        });

      case "split": {
        // Następne tło dokładamy od razu, a nie na koniec podziału: ma wtedy cały
        // czas trwania podziału na zbuforowanie. Bez tego przy zimnym cache czekanie
        // na gotowość przedłużało pobyt tła ponad długość pliku i klip się zapętlał.
        if (layers.length < 3 && queueLayer(takeNext(naEkranie))) return;

        return after(plan.withSplit ? plan.splitMs : CUT_SETTLE_MS, () => {
          setPhase("cue-next");
        });
      }

      case "cue-next":
        return whenTopReady(() => {
          cutTopTo(EDGE_COVER);
          setPhase("settle");
        });

      case "settle":
        // Przejazd musi się skończyć, zanim odrzucimy warstwy pod spodem.
        return after(CUT_SETTLE_MS, () => {
          setLayers((current) => {
            const ostatni = current[current.length - 1];
            ready.current = new Set([ostatni.key]);
            for (const [key] of elements.current) {
              if (key !== ostatni.key) elements.current.delete(key);
            }
            return [{ ...ostatni, edge: EDGE_COVER }];
          });
          setPhase("solo");
        });
    }
  }, [phase, layers, playlist.length, takeNext, takePartner, readySignal, shortestMs, splitAllowed]);

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
            // Czworokąt z ukośną prawą krawędzią; animujemy tylko jej położenie,
            // więc przeglądarka ma między czym interpolować.
            clipPath: `polygon(${layer.edge}% 0%, 140% 0%, 140% 100%, ${layer.edge - layer.skew}% 100%)`,
          }}
        >
          <AutoVideo
            video={layer.clip}
            ariaLabel="NOREST STUDIO"
            preload="auto"
            // Bez zapetlenia: opoznione ciecie przytrzyma ostatnia klatke, nie skoczy na pierwsza.
            loop={false}
            onReady={() => markReady(layer.key)}
            elementRef={(element) => {
              if (element) elements.current.set(layer.key, element);
              else elements.current.delete(layer.key);
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
