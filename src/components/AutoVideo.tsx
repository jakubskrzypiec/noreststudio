"use client";

import { useEffect, useRef } from "react";
import type { VideoAsset } from "@/lib/media";
import { asset } from "@/lib/assets";

/**
 * Film, który zachowuje się jak animowana grafika: sam startuje, chodzi w kółko
 * i nie pokazuje żadnych przycisków. Tak opisuje to plansza klienta — w galerii
 * animacja stoi na miejscu zdjęcia, a nie jako odtwarzacz do klikania.
 *
 * Odtwarzanie jest wstrzymywane, kiedy kadr wyjdzie poza ekran. Bez tego strona
 * projektu z trzema animacjami mieliłaby je wszystkie naraz przez cały czas.
 *
 * Samo `autoplay` nie wystarcza: przeglądarka pauzuje filmy w ukrytej karcie,
 * a część odrzuca pierwszy start do czasu interakcji. Dlatego próbę odtworzenia
 * ponawiamy po powrocie na kartę i po pierwszym kliknięciu czy dotknięciu strony.
 */
export function AutoVideo({
  video,
  className,
  ariaLabel,
  style,
  preload = "metadata",
  loop = true,
  onReady,
  elementRef,
}: {
  video: VideoAsset;
  className?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
  preload?: "none" | "metadata" | "auto";
  /**
   * Zapętlenie. Strona główna wyłącza je świadomie: klip jest tam zdejmowany
   * przed końcem, a gdy coś się opóźni, lepiej, żeby przytrzymał ostatnią klatkę
   * niż przeskoczył na pierwszą.
   */
  loop?: boolean;
  /** Woływane, gdy klip ma dość danych, żeby grać płynnie. */
  onReady?: () => void;
  /**
   * Udostępnia sam element wideo. Strona główna potrzebuje go, żeby przewinąć
   * klip na początek dokładnie w chwili, gdy wchodzi w kadr.
   */
  elementRef?: (element: HTMLVideoElement | null) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  /**
   * Trzymamy w refie, żeby podmiana funkcji nie przepinała nasłuchów.
   * Aktualizujemy w efekcie zadeklarowanym wyżej niż główny, więc wskazuje
   * na świeżą funkcję, zanim ten zdąży ją wywołać.
   */
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  /** Czy kadr jest w polu widzenia — decyduje, czy w ogóle próbować grać. */
  const visibleRef = useRef(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const tryPlay = () => {
      if (!visibleRef.current || document.hidden) return;
      // Zakonczony klip odtworzylby sie od pierwszej klatki - na hero to widoczny skok.
      if (element.ended) return;
      element.play().catch(() => {});
    };

    let observer: IntersectionObserver | undefined;

    if (typeof IntersectionObserver === "undefined") {
      tryPlay();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          visibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) tryPlay();
          else element.pause();
        },
        { rootMargin: "200px" },
      );
      observer.observe(element);
    }

    const announceReady = () => onReadyRef.current?.();
    // Gdy plik siedzi już w cache, `canplay` zdążyło paść przed podpięciem nasłuchu.
    if (element.readyState >= 3) announceReady();
    element.addEventListener("canplay", announceReady);

    document.addEventListener("visibilitychange", tryPlay);
    // `once` wystarczy — po pierwszej interakcji polityka autoplay już nie blokuje.
    window.addEventListener("pointerdown", tryPlay, { once: true });

    return () => {
      observer?.disconnect();
      element.removeEventListener("canplay", announceReady);
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("pointerdown", tryPlay);
    };
  }, []);

  return (
    <video
      ref={(element) => {
        ref.current = element;
        elementRef?.(element);
      }}
      src={asset(video.src)}
      poster={asset(video.poster)}
      aria-label={ariaLabel}
      autoPlay
      muted
      loop={loop}
      playsInline
      preload={preload}
      className={className}
      style={style}
    />
  );
}
