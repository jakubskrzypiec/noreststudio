"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoAsset } from "@/lib/media";
import { asset } from "@/lib/assets";

/**
 * Pełnoekranowe tło strony głównej.
 *
 * Plansza klienta opisuje to jako "animacja zmieniajaca sie co kilka sekund na inna",
 * więc zamiast sztywnego licznika przełączamy klip, kiedy dobiegnie końca — klipy
 * mają po 5–9 s, a przejście wypada wtedy w naturalnym miejscu, nie w połowie ruchu kamery.
 *
 * W DOM-ie trzymamy tylko dwa elementy <video>: bieżący i następny. Następny jest
 * już załadowany i wystartowany pod spodem, dzięki czemu zmiana to samo przenikanie,
 * bez czarnej klatki.
 */
export function HomeHero({ videos }: { videos: VideoAsset[] }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const currentRef = useRef<HTMLVideoElement>(null);
  const nextRef = useRef<HTMLVideoElement>(null);

  const hasSeveral = videos.length > 1;
  const current = videos[index];
  const next = hasSeveral ? videos[(index + 1) % videos.length] : undefined;

  const advance = useCallback(() => {
    if (!hasSeveral) return;
    setFading(true);
  }, [hasSeveral]);

  // Po zakończeniu przenikania następny klip staje się bieżącym.
  useEffect(() => {
    if (!fading) return;
    const timer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % videos.length);
      setFading(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [fading, videos.length]);

  // Autoplay bywa odrzucany do czasu pierwszej interakcji; wtedy zostaje plakat.
  useEffect(() => {
    currentRef.current?.play().catch(() => {});
    nextRef.current?.play().catch(() => {});
  }, [index]);

  if (!current) {
    return <div className="absolute inset-0 bg-paper" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <video
        key={`current-${current.id}`}
        ref={currentRef}
        src={asset(current.src)}
        poster={asset(current.poster)}
        autoPlay
        muted
        playsInline
        loop={!hasSeveral}
        onEnded={advance}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ${
          fading ? "opacity-0" : "opacity-100"
        }`}
      />

      {next && (
        <video
          key={`next-${next.id}`}
          ref={nextRef}
          src={asset(next.src)}
          poster={asset(next.poster)}
          autoPlay
          muted
          playsInline
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ${
            fading ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Delikatne przyciemnienie u góry, żeby logo i menu były czytelne na jasnym renderze. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/25 to-transparent" />
    </div>
  );
}
