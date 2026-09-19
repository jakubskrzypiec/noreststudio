"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { Wordmark, Mark } from "./Logo";

/**
 * Pasek obecny na każdej podstronie.
 *
 * Logo po lewej prowadzi na stronę główną (poprawki klienta: "niech to będzie nasze
 * home"). Na desktopie po prawej obracający się znak prowadzi do slidera z projektami,
 * a obok są pozycje menu.
 * Na telefonie po prawej ten sam znak otwiera pełnoekranowe menu; slidera tam nie ma.
 */
export function Header({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Menu jest pełnoekranowe, więc tło pod nim nie powinno się przewijać.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Na zdjęciu pełnoekranowym logo musi być białe, na papierze — czarne.
  // Otwarte menu zakrywa zdjęcie papierowym tłem, więc jasny wariant przestaje być czytelny.
  const colorClass = tone === "light" && !menuOpen ? "text-white on-image" : "text-ink";

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 md:px-10"
        style={{ height: "var(--header-h)" }}
      >
        <Link
          href="/"
          aria-label={`${site.name} — strona główna`}
          className={`${colorClass} transition-opacity hover:opacity-60`}
        >
          <Wordmark className="h-5 w-auto md:h-6" />
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          <Link
            href="/work"
            aria-label="Slider z projektami"
            className={`group ${colorClass} opacity-80 transition-opacity hover:opacity-100`}
          >
            <Mark className="h-6 w-auto transition-transform duration-500 group-hover:rotate-[135deg]" />
          </Link>
          {site.nav.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              className={`label ${colorClass} opacity-70 transition-opacity hover:opacity-100`}
            />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Zamknij menu" : "Otwórz menu"}
          className={`md:hidden ${colorClass}`}
        >
          <Mark
            className={`h-5 w-auto transition-transform duration-500 ${
              menuOpen ? "rotate-[135deg]" : "rotate-0"
            }`}
          />
        </button>
      </header>

      {menuOpen && (
        <div className="fade-in fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-paper md:hidden">
          {site.nav.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              // Zamykamy przy wyborze pozycji, żeby menu nie zostało nad nową podstroną.
              onNavigate={() => setMenuOpen(false)}
              className="text-ink text-lg tracking-[0.18em] uppercase"
            />
          ))}
        </div>
      )}
    </>
  );
}

type NavItem = (typeof site.nav)[number];

/** Pozycja menu — zewnętrzne linki wychodzą w nowej karcie, wewnętrzne idą routerem. */
function NavLink({
  item,
  className,
  onNavigate,
}: {
  item: NavItem;
  className: string;
  onNavigate?: () => void;
}) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={onNavigate}
        className={className}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} onClick={onNavigate} className={className}>
      {item.label}
    </Link>
  );
}
