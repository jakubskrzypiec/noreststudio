import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
};

/**
 * CONTACT — adres i kontakt na środku, tekst "o nas" pod spodem.
 *
 * Na planszy po bokach stoją dwa wycięte zdjęcia osób na krzesłach (czarno-białe).
 * Takich zdjęć nie ma w materiałach — te z makiety należą do innego studia — więc
 * miejsca na nie są przygotowane, ale puste, i kolumna z treścią jest wyśrodkowana.
 */
export default function ContactPage() {
  const { city, street, postalCode, phone, email, instagram } = site.contact;

  return (
    <main className="min-h-dvh bg-paper">
      <Header />

      <div
        className="fade-in mx-auto flex max-w-[1600px] flex-col items-center px-5 pb-24 md:px-10"
        style={{ paddingTop: "calc(var(--header-h) + 6rem)" }}
      >
        <address className="flex flex-col items-center gap-6 not-italic">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="label text-ink">{city}</p>
            <p className="label text-muted">{street}</p>
            <p className="label text-muted">{postalCode}</p>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <a href={`tel:${phone}`} className="label text-muted hover:text-ink">
              {phone}
            </a>
            <a href={`mailto:${email}`} className="label text-muted hover:text-ink">
              {email}
            </a>
            <a
              href={instagram}
              target="_blank"
              rel="noreferrer noopener"
              className="label text-muted hover:text-ink"
            >
              Instagram
            </a>
          </div>
        </address>

        {site.about.length > 0 && (
          <div className="mt-16 flex max-w-prose flex-col gap-4">
            {site.about.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
