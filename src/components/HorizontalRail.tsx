"use client";

import { useEffect, useRef } from "react";

/**
 * Poziomy pas galerii.
 *
 * Na planszy jest dopisek "slider przesuwa sie gdy scrolujemy rolka w myszce",
 * więc pionowy ruch kółka zamieniamy na przesuw w bok. Gest touchpada w poziomie
 * (deltaX) zostawiamy przeglądarce — inaczej przewijanie dwoma palcami przestaje działać.
 *
 * Na telefonie nie ma czego przechwytywać: tam układ i tak jest pionowy,
 * więc zachowanie włącza się dopiero od szerokości desktopowej.
 */
export function HorizontalRail({ children }: { children: React.ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarsePointer) return;

    function onWheel(event: WheelEvent) {
      const element = railRef.current;
      if (!element) return;

      // Ruch w bok obsługuje przeglądarka; przejmujemy tylko klasyczne kółko.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const atStart = element.scrollLeft <= 0;
      const atEnd = element.scrollLeft >= element.scrollWidth - element.clientWidth - 1;

      // Na krańcach oddajemy zdarzenie stronie, żeby dało się wyjść ze slidera.
      if ((atStart && event.deltaY < 0) || (atEnd && event.deltaY > 0)) return;

      event.preventDefault();
      element.scrollLeft += event.deltaY;
    }

    rail.addEventListener("wheel", onWheel, { passive: false });
    return () => rail.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={railRef}
      className="no-scrollbar flex h-full w-full snap-x snap-mandatory flex-col gap-16 overflow-y-auto px-5 pb-16 md:flex-row md:items-center md:gap-10 md:overflow-x-auto md:overflow-y-hidden md:px-10"
    >
      {children}
    </div>
  );
}
