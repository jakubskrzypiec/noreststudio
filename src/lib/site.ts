/**
 * Dane firmy i teksty interfejsu w jednym miejscu.
 *
 * UWAGA: opis studia w sekcji CONTACT na planszy klienta to placeholder przepisany
 * z innej agencji ("Third Aesthetic", Sydney) — nie da się go użyć. Do czasu
 * dostarczenia własnego tekstu trzymamy tu pustkę i sekcja się nie renderuje.
 */

export const site = {
  name: "NOREST STUDIO",
  tagline: "Architecture & Graphics",
  // Nadpisywane w buildzie deployu; lokalnie zostaje docelowa domena klienta.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://noreststudio.com",

  contact: {
    city: "CRACOW",
    street: "SLOMNICKA 4/30 street",
    postalCode: "30-003",
    phone: "+48604618830",
    email: "office@noreststudio.com",
    instagram: "https://www.instagram.com/noreststudio/",
  },

  /** Lista z prawej strony ekranu HOME. */
  services: ["3d Visualizations", "3d Animations", "360 Tours"],

  /** Kolejność pozycji menu — taka jak na planszy. */
  nav: [
    { label: "Instagram", href: "https://www.instagram.com/noreststudio/", external: true },
    { label: "Projects", href: "/projects", external: false },
    { label: "Contact", href: "/contact", external: false },
  ],

  /** Tekst "o nas" do sekcji CONTACT — czeka na treść od klienta. */
  about: [] as string[],
} as const;

export type Site = typeof site;
