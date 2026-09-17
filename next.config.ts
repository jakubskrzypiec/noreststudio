import type { NextConfig } from "next";

/**
 * Strona jest w całości statyczna — nie ma API ani renderowania po stronie serwera,
 * więc eksportujemy ją do plików i wystawiamy na GitHub Pages.
 *
 * Pages serwuje projekt pod /noreststudio, a nie pod domeną główną, stąd basePath.
 * Trzyma go zmienna środowiskowa, żeby przy przenosinach na własną domenę wystarczyło
 * ją wyczyścić — bez zmian w kodzie.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Pages nie obsłuży /work bez indeksu, więc każda trasa dostaje własny katalog.
  trailingSlash: true,
  images: {
    // Nie używamy next/image — warianty powstają w `npm run media`.
    unoptimized: true,
  },
};

export default nextConfig;
