/**
 * Logo jako maska CSS zamiast <img>.
 *
 * Dzięki temu ten sam plik jest czarny na papierze i biały na pełnoekranowym
 * renderze — wystarczy ustawić `color` na rodzicu (np. klasą `text-white`).
 * Proporcje pochodzą z plików wygenerowanych przez `scripts/make-logo.mjs`.
 */

import { asset } from "@/lib/assets";

const WORDMARK_RATIO = 644 / 128;
const MARK_RATIO = 614 / 461;

type LogoProps = {
  className?: string;
  title?: string;
};

function MaskedLogo({
  src,
  ratio,
  className,
  title,
}: LogoProps & { src: string; ratio: number }) {
  return (
    <span
      role="img"
      aria-label={title}
      className={className}
      style={{
        display: "inline-block",
        aspectRatio: String(ratio),
        backgroundColor: "currentColor",
        maskImage: `url(${asset(src)})`,
        WebkitMaskImage: `url(${asset(src)})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

/** Pełny napis "NORESTSTUDIO". */
export function Wordmark({ className, title = "NOREST STUDIO" }: LogoProps) {
  return (
    <MaskedLogo src="/logo/wordmark.png" ratio={WORDMARK_RATIO} className={className} title={title} />
  );
}

/** Sam znak graficzny — używany jako przycisk menu na telefonie. */
export function Mark({ className, title = "NOREST STUDIO" }: LogoProps) {
  return <MaskedLogo src="/logo/mark.png" ratio={MARK_RATIO} className={className} title={title} />;
}
