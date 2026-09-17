"use client";

import { useEffect, useRef } from "react";

/**
 * Poziomy pas galerii.
 *
 * Na planszy jest dopisek "slider przesuwa sie gdy scrolujemy rolka w myszce",
 * więc pionowy ruch kółka zamieniamy na przesuw w bok. Gest touchpada w poziomie
 * (deltaX) zostawiamy przeglądarce — inaczej przewijanie dwoma palcami przestaje działać.
 *
 * Na telefonie nie ma czego przechwytywać: tam układ jest pionowy i pas w ogóle
 * nie przewija się w bok, więc obsługa sama się wycofuje.
 *
 * Pas nie ma `scroll-snap`. Z włączonym `mandatory` przeglądarka po każdym drobnym
 * ruchu kółka przyciągała widok z powrotem do tego samego kafla i galeria sprawiała
 * wrażenie zablokowanej na trzeciej realizacji.
 */

/** Ile razy mocniej pas reaguje na kółko niż wynosi surowa wartość zdarzenia. */
const WHEEL_BOOST = 2.5;

export function HorizontalRail({ children }: { children: React.ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    function onWheel(event: WheelEvent) {
      const element = railRef.current;
      if (!element) return;

      // W układzie pionowym (telefon) nie ma czego przewijać w bok — oddajemy stronie.
      // To pewniejszy warunek niż pytanie o rodzaj wskaźnika: laptop z ekranem dotykowym
      // zgłasza `pointer: coarse` mimo podłączonej myszy i pas przestawał reagować na kółko.
      if (element.scrollWidth <= element.clientWidth) return;

      // Ruch w bok obsługuje przeglądarka; przejmujemy tylko klasyczne kółko.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const atStart = element.scrollLeft <= 0;
      const atEnd = element.scrollLeft >= element.scrollWidth - element.clientWidth - 1;

      // Na krańcach oddajemy zdarzenie stronie, żeby dało się wyjść ze slidera.
      if ((atStart && event.deltaY < 0) || (atEnd && event.deltaY > 0)) return;

      event.preventDefault();
      // Jedno kliknięcie kółka to zwykle ~100 px. Bez wzmocnienia przejście przez
      // 29 kafli wymagałoby kilkudziesięciu obrotów, a pas sprawiałby wrażenie ciężkiego.
      element.scrollLeft += event.deltaY * WHEEL_BOOST;
    }

    rail.addEventListener("wheel", onWheel, { passive: false });
    return () => rail.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={railRef}
      className="no-scrollbar flex h-full w-full flex-col gap-16 overflow-y-auto px-5 pb-16 md:flex-row md:items-center md:gap-10 md:overflow-x-auto md:overflow-y-hidden md:px-10"
    >
      {children}
    </div>
  );
}
