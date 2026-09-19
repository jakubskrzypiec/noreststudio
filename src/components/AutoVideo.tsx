"use client";

import { useCallback, useEffect, useRef } from "react";
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

  /**
   * Stabilne podpięcie elementu. Gdyby callback powstawał na nowo przy każdym
   * renderze, React odpinałby i podpinał referencję za każdym razem — a strona
   * główna trzyma po niej uchwyt, którym przewija klip na pierwszą klatkę
   * w chwili cięcia. Przy odpięciu ten uchwyt przepadał i nowy kadr wchodził
   * bez wystartowania.
   */
  const elementRefFn = useRef(elementRef);
  useEffect(() => {
    elementRefFn.current = elementRef;
  }, [elementRef]);

  const setNode = useCallback((element: HTMLVideoElement | null) => {
    ref.current = element;
    elementRefFn.current?.(element);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let ponowienie = 0;

    const tryPlay = () => {
      if (!visibleRef.current || document.hidden) return;
      // Zakonczony klip odtworzylby sie od pierwszej klatki - na hero to widoczny skok.
      if (element.ended) return;
      // `muted` ustawiamy jeszcze raz z kodu: bez tego telefony traktuja film jak
      // dzwiekowy i odrzucaja autoodtwarzanie, pokazujac plakat z przyciskiem play.
      element.muted = true;
      element.play().catch(() => {
        // Telefon potrafi odrzucic pierwsze `play()` (dane jeszcze nie doszly, ekran
        // dopiero sie budzi). Sama polityka autoodtwarzania nie zmienia sie w kilkaset
        // milisekund, wiec probujemy tylko kilka razy - reszte zalatwiaja zdarzenia
        // mediow i pierwszy gest.
        if (ponowienie >= 4) return;
        ponowienie += 1;
        window.setTimeout(tryPlay, 250 * ponowienie);
      });
    };

    let observer: IntersectionObserver | undefined;

    // Pierwsza proba od razu, nie czekajac na obserwatora.
    tryPlay();

    if (typeof IntersectionObserver !== "undefined") {
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

    /*
     * Ponawianie. Jedna proba nie wystarcza: na telefonie `play()` wolane przed
     * pojawieniem sie pierwszych danych jest odrzucane, a polityka autoodtwarzania
     * (np. tryb oszczedzania energii w iOS) blokuje start do pierwszego dotkniecia.
     * Dlatego probujemy przy kazdym zdarzeniu, ktore moze to odblokowac, i dopiero
     * gdy film naprawde gra, odpinamy nasluchy gestow.
     */
    const zdarzeniaMediow = ["loadeddata", "canplay", "canplaythrough"] as const;
    const gesty = ["pointerdown", "touchend", "keydown"] as const;

    const odepnijGesty = () => {
      for (const nazwa of gesty) window.removeEventListener(nazwa, tryPlay);
    };

    for (const nazwa of zdarzeniaMediow) element.addEventListener(nazwa, tryPlay);
    for (const nazwa of gesty) window.addEventListener(nazwa, tryPlay);
    element.addEventListener("playing", odepnijGesty);
    document.addEventListener("visibilitychange", tryPlay);

    return () => {
      observer?.disconnect();
      element.removeEventListener("canplay", announceReady);
      element.removeEventListener("playing", odepnijGesty);
      for (const nazwa of zdarzeniaMediow) element.removeEventListener(nazwa, tryPlay);
      odepnijGesty();
      document.removeEventListener("visibilitychange", tryPlay);
    };
  }, []);

  return (
    <video
      ref={setNode}
      poster={asset(video.poster)}
      aria-label={ariaLabel}
      autoPlay
      muted
      loop={loop}
      playsInline
      preload={preload}
      className={className}
      style={style}
    >
      {/*
       * Telefon dostaje wariant 900 px: mniej do pobrania i dużo mniej do dekodowania.
       * Wybór robi przeglądarka przy starcie ładowania — dlatego źródła są tutaj,
       * a nie w atrybucie `src`, który miałby nad nimi pierwszeństwo.
       */}
      {video.srcMobile && video.srcMobile !== video.src && (
        <source src={asset(video.srcMobile)} type="video/mp4" media="(max-width: 768px)" />
      )}
      <source src={asset(video.src)} type="video/mp4" />
    </video>
  );
}
