"use client";

import { useEffect, useMemo, useState } from "react";
import type { VideoAsset } from "@/lib/media";
import { AutoVideo } from "./AutoVideo";

/**
 * Pełnoekranowe tło strony głównej.
 *
 * Strona referencyjna ma jeden film, w którym kadr raz jest pełny, a raz podzielony
 * na pół — u nas klipy są osobnymi plikami, więc ten sam efekt robi układ: sceny
 * pojedyncze i dzielone występują na zmianę.
 *
 * Każdy klip jest zapętlony, a o zmianie sceny decyduje zegar, nie zdarzenie `ended`.
 * Wcześniej było odwrotnie i karuzela zatrzymywała się na dobre: podgląd następnego
 * klipu startował od razu, kończył się jeszcze poza ekranem i wchodził zamrożony
 * na ostatniej klatce, a jego `ended` nigdy już nie padało.
 */

type Scene = {
  id: string;
  clips: VideoAsset[];
};

/** Przenikanie między scenami. */
const FADE_MS = 900;

/** Awaryjny czas sceny, gdy nie znamy długości klipu. */
const FALLBACK_SCENE_MS = 7000;

/**
 * Układa klipy w sceny: pojedyncza, dzielona, pojedyncza, dzielona...
 * Dzielona bierze dwa klipy, więc rytm zależy od tego, ile ich zostało.
 */
function buildScenes(videos: VideoAsset[]): Scene[] {
  const scenes: Scene[] = [];
  let index = 0;
  let wantsSplit = false;

  while (index < videos.length) {
    if (wantsSplit && index + 1 < videos.length) {
      scenes.push({
        id: `${videos[index].id}+${videos[index + 1].id}`,
        clips: [videos[index], videos[index + 1]],
      });
      index += 2;
    } else {
      scenes.push({ id: videos[index].id, clips: [videos[index]] });
      index += 1;
    }
    wantsSplit = !wantsSplit;
  }

  return scenes;
}

/** Scena trwa tyle, ile jej najdłuższy klip — żeby żaden nie został ucięty w połowie ruchu. */
function sceneDuration(scene: Scene): number {
  const longest = Math.max(...scene.clips.map((clip) => clip.duration || 0));
  return longest > 0 ? longest * 1000 : FALLBACK_SCENE_MS;
}

export function HomeHero({ videos }: { videos: VideoAsset[] }) {
  const scenes = useMemo(() => buildScenes(videos), [videos]);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  const hasSeveral = scenes.length > 1;
  const current = scenes[index];
  const next = hasSeveral ? scenes[(index + 1) % scenes.length] : undefined;

  // Zegar sceny: najpierw pełny czas odtwarzania, potem samo przenikanie.
  useEffect(() => {
    if (!hasSeveral || !current) return;

    if (!fading) {
      const timer = window.setTimeout(() => setFading(true), sceneDuration(current));
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % scenes.length);
      setFading(false);
    }, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [fading, hasSeveral, current, scenes.length]);

  if (!current) {
    return <div className="absolute inset-0 bg-paper" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <SceneLayer scene={current} visible={!fading} />
      {next && <SceneLayer scene={next} visible={fading} />}

      {/* Delikatne przyciemnienie u góry, żeby logo i menu były czytelne na jasnym renderze. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/25 to-transparent" />
    </div>
  );
}

/**
 * Jedna scena. Przy dwóch klipach ekran dzieli się pionowo na pół — ale dopiero
 * od szerokości tabletu; na telefonie dwa pionowe pasy byłyby nieczytelne.
 */
function SceneLayer({ scene, visible }: { scene: Scene; visible: boolean }) {
  const isSplit = scene.clips.length > 1;

  return (
    <div
      aria-hidden={!visible}
      className={`absolute inset-0 flex transition-opacity duration-[900ms] ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {scene.clips.map((clip, position) => (
        <div
          key={clip.id}
          className={
            isSplit
              ? // Na telefonie widać tylko pierwszy klip sceny dzielonej.
                position === 0
                ? "h-full w-full md:w-1/2"
                : "hidden h-full md:block md:w-1/2"
              : "h-full w-full"
          }
        >
          <HeroClip clip={clip} active={visible} />
        </div>
      ))}
    </div>
  );
}

function HeroClip({ clip, active }: { clip: VideoAsset; active: boolean }) {
  return (
    <AutoVideo
      video={clip}
      ariaLabel="NOREST STUDIO"
      // Scena czekająca w kolejce ma być gotowa, zanim wejdzie na ekran.
      preload={active ? "auto" : "metadata"}
      className="h-full w-full object-cover"
    />
  );
}
