/**
 * Ścieżki do plików z public/.
 *
 * Next dokleja basePath sam tylko do własnych zasobów i do <Link>. Zwykłe
 * `<img src>`, `<video src>` i maski CSS musimy poprzedzić ręcznie — inaczej na
 * GitHub Pages (gdzie strona stoi pod /noreststudio) wszystkie media dają 404.
 */

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${basePath}${path}`;
}
