/**
 * Zdjęcie z wariantami wygenerowanymi przez `npm run media`.
 *
 * Nie używamy next/image, bo wszystkie rozmiary są już policzone na dysku —
 * optymalizacja w locie tylko dublowałaby pracę i wiązała projekt z hostingiem.
 * Placeholder jest wstawiony jako tło, więc kadr ma właściwą wysokość od pierwszej klatki.
 */

import type { ImageAsset } from "@/lib/media";
import { largestSrc, toSrcSet } from "@/lib/media";

type Props = {
  image: ImageAsset;
  alt: string;
  /** Wartość atrybutu `sizes` — ile miejsca zdjęcie zajmuje w danym układzie. */
  sizes: string;
  className?: string;
  priority?: boolean;
};

export function ProjectImage({ image, alt, sizes, className, priority = false }: Props) {
  return (
    // Warianty i wymiary są policzone przez `npm run media`, więc next/image nie ma tu
    // czego optymalizować — dodałby tylko zależność od hostingu i drugi przebieg kodowania.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={largestSrc(image)}
      srcSet={toSrcSet(image)}
      sizes={sizes}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      style={{
        backgroundImage: `url(${image.blurDataURL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}
