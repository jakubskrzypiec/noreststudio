import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { asset } from "@/lib/assets";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
};

/**
 * CONTACT — adres i kontakt na środku, dwie osoby na krzesłach po bokach.
 *
 * Zdjęcie jest wycięte z planszy klienta (`scripts/` nie bierze w tym udziału —
 * to jednorazowy eksport z PDF-a do `public/media/contact/team.jpg`). Środek kadru,
 * gdzie w makiecie stał opis innego studia, jest zamalowany na biało.
 *
 * Nakładamy je trybem `multiply`: zdjęcie jest czarno-białe na czystej bieli,
 * więc biel mnoży się do koloru papieru i tło znika bez żadnego maskowania,
 * a postacie i bruk zostają. Dlatego nie widać krawędzi pliku.
 *
 * Na telefonie zdjęcia nie ma — plansza też pokazuje tam sam tekst, a postacie
 * po bokach zeszłyby do kilkudziesięciu pikseli.
 */
export default function ContactPage() {
  const { city, street, postalCode, phone, email, instagram } = site.contact;

  return (
    <main className="relative flex min-h-dvh flex-col bg-paper">
      <Header />

      <div
        className="fade-in relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col items-center px-5 md:px-10"
        style={{ paddingTop: "calc(var(--header-h) + 6rem)" }}
      >
        <address className="flex flex-col items-center gap-6 not-italic">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="label text-ink">{city}</p>
            <p className="label text-ink">{street}</p>
            <p className="label text-ink">{postalCode}</p>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <a href={`tel:${phone}`} className="label text-ink transition-opacity hover:opacity-60">
              {phone}
            </a>
            <a
              href={`mailto:${email}`}
              className="label text-ink transition-opacity hover:opacity-60"
            >
              {email}
            </a>
            <a
              href={instagram}
              target="_blank"
              rel="noreferrer noopener"
              className="label text-ink transition-opacity hover:opacity-60"
            >
              Instagram
            </a>
          </div>
        </address>

        {site.about.length > 0 && (
          <div className="mt-16 flex max-w-prose flex-col gap-4">
            {site.about.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-ink">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Jeden gotowy plik o stałych proporcjach — next/image nie miałby tu czego zoptymalizować. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset("/media/contact/team.jpg")}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden w-full select-none mix-blend-multiply md:block"
      />
    </main>
  );
}
