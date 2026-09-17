"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VideoAsset } from "@/lib/media";
import { AutoVideo } from "./AutoVideo";

/**
 * Pełnoekranowe tło strony głównej.
 *
 * Tak to działa na stronie referencyjnej: leci jeden film na całym ekranie,
 * po czym drugi **wcina się w prawą połowę kadru** — nie jest tak, że oba
 * pojawiają się razem. Po chwili ten drugi zabiera całą szerokość i staje się
 * nowym tłem, a cykl zaczyna się od nowa z kolejnym klipem.
 *
 * Zmiana jest twardym cięciem, bez animowanego wjazdu — dokładnie jak na stronie
 * referencyjnej, gdzie podział jest cięciem montażowym wewnątrz materiału.
 * Odsłanianie robi `clip-path`, więc film stoi nieruchomo w pełnym kadrze zamiast
 * być przeskalowywany; gdyby zmieniać szerokość, `object-cover` przeliczałby
 * kadrowanie i obraz skakałby w środku w momencie cięcia.
 *
 * Dwie rzeczy, przez które tło wcześniej migało i potrafiło stanąć na dobre:
 * klipy nie były zapętlone i cykl czekał na `ended`, które dla wstępnie
 * uruchomionego klipu padało jeszcze poza ekranem; oraz kolejny klip trafiał
 * do tego samego elementu `<video>`, więc podmiana `src` pokazywała na moment
 * czarne tło albo plakat. Teraz każdy klip ma własny element o stałym kluczu,
 * jest zamontowany i wczytany, zanim zacznie się odsłanianie, a po przejęciu
 * ekranu React przenosi ten sam węzeł na spód — bez przeładowania.
 */

/** Odstęp po cięciu, zanim cykl przejdzie dalej. Samo cięcie jest natychmiastowe. */
const CUT_SETTLE_MS = 120;

/** Jak długo widać pojedynczy kadr, zanim wetnie się następny. */
const HOLD_SINGLE_MS = 4500;

/** Jak długo ekran zostaje podzielony. */
const HOLD_SPLIT_MS = 3500;

/** Chwila na zamontowanie i wczytanie klipu, zanim wetnie się w kadr. */
const ARM_MS = 400;

/** Gdzie zatrzymuje się krawędź wcinającego się filmu. */
const SPLIT_AT = 50;

type Panel = {
  key: string;
  clip: VideoAsset;
};

type Phase = "single" | "arming" | "entering" | "split" | "takeover";

export function HomeHero({ videos }: { videos: VideoAsset[] }) {
  /** Kolejka klipów; pusty zestaw oznacza, że media nie zostały jeszcze przerobione. */
  const playlist = useMemo(() => videos.filter((video) => video.src), [videos]);

  /**
   * panels[0] to tło, panels[1] to klip wcinający się w kadr.
   * Klucze są stałe, więc po przejęciu ekranu React przenosi ten sam element
   * `<video>` na spód zamiast montować go od nowa.
   */
  const [panels, setPanels] = useState<Panel[]>(() =>
    playlist.length > 0 ? [{ key: `${playlist[0].id}#0`, clip: playlist[0] }] : [],
  );
  const [phase, setPhase] = useState<Phase>("single");
  /** Pozycja krawędzi wcinającego się filmu, w procentach szerokości. */
  const [edge, setEdge] = useState(100);

  /** Który klip z kolejki pójdzie następny. */
  const cursor = useRef(1);
  const [splitAllowed, setSplitAllowed] = useState(true);

  // Na telefonie podział na dwa pionowe pasy jest nieczytelny — tam drugi klip
  // od razu przejmuje cały ekran, więc zostaje samo wycięcie w poprzek kadru.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setSplitAllowed(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (playlist.length < 2 || panels.length === 0) return;

    const stopAt = SPLIT_AT;

    const schedule = (delay: number, step: () => void) => {
      const timer = window.setTimeout(step, delay);
      return () => window.clearTimeout(timer);
    };

    switch (phase) {
      case "single":
        return schedule(HOLD_SINGLE_MS, () => {
          const clip = playlist[cursor.current];
          cursor.current = (cursor.current + 1) % playlist.length;
          // Montujemy poza kadrem (krawędź na 100%), żeby zdążył się wczytać.
          setEdge(100);
          setPanels((current) => [current[0], { key: `${clip.id}#${Date.now()}`, clip }]);
          setPhase("arming");
        });

      case "arming":
        return schedule(ARM_MS, () => {
          setEdge(splitAllowed ? stopAt : 0);
          setPhase("entering");
        });

      case "entering":
        return schedule(CUT_SETTLE_MS, () => setPhase(splitAllowed ? "split" : "takeover"));

      case "split":
        return schedule(HOLD_SPLIT_MS, () => {
          setEdge(0);
          setPhase("takeover");
        });

      case "takeover":
        return schedule(CUT_SETTLE_MS, () => {
          // Wcinający się klip zakrywa już cały ekran, więc zejście na spód
          // jest niewidoczne — a dzięki stałemu kluczowi nie przeładowuje się.
          setPanels((current) => (current[1] ? [current[1]] : current));
          setEdge(100);
          setPhase("single");
        });
    }
  }, [phase, panels.length, playlist, splitAllowed]);

  if (panels.length === 0) {
    return <div className="absolute inset-0 bg-paper" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {panels.map((panel, layer) => (
        <div
          key={panel.key}
          className="absolute inset-0"
          style={
            layer === 0
              ? { zIndex: 10 }
              : {
                  zIndex: 20,
                  clipPath: `inset(0 0 0 ${edge}%)`,
                }
          }
        >
          <AutoVideo
            video={panel.clip}
            ariaLabel="NOREST STUDIO"
            preload="auto"
            className="h-full w-full object-cover"
          />
        </div>
      ))}

      {/* Delikatne przyciemnienie u góry, żeby logo i menu były czytelne na jasnym renderze. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-40 bg-gradient-to-b from-black/25 to-transparent" />
    </div>
  );
}
