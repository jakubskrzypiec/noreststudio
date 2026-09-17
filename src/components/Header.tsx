"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { Wordmark, Mark } from "./Logo";

/**
 * Pasek obecny na każdej podstronie.
 *
 * Na desktopie: logo po lewej (prowadzi do galerii — na planszy "po kliknieciu w logo"),
 * pozycje menu po prawej.
 * Na telefonie: logo po lewej, a po prawej obracający się znak, który otwiera
 * pełnoekranowe menu.
 */
export function Header({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Wejście na inną podstronę zawsze zamyka menu — inaczej zostaje otwarte nad nową treścią.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Menu jest pełnoekranowe, więc tło pod nim nie powinno się przewijać.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Na zdjęciu pełnoekranowym logo musi być białe, na papierze — czarne.
  const colorClass = tone === "light" ? "text-white" : "text-ink";

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 md:px-10"
        style={{ height: "var(--header-h)" }}
      >
        <Link
          href="/work"
          aria-label={`${site.name} — przejdź do galerii`}
          className={`${colorClass} transition-opacity hover:opacity-60`}
        >
          <Wordmark className="h-4 w-auto md:h-[1.1rem]" />
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {site.nav.map((item) =>
            item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className={`label ${colorClass} opacity-70 transition-opacity hover:opacity-100`}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className={`label ${colorClass} opacity-70 transition-opacity hover:opacity-100`}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Zamknij menu" : "Otwórz menu"}
          className={`md:hidden ${menuOpen ? "text-ink" : colorClass}`}
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
          {site.nav.map((item) =>
            item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-ink text-lg tracking-[0.18em] uppercase"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className="text-ink text-lg tracking-[0.18em] uppercase"
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      )}
    </>
  );
}
