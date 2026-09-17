import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

/**
 * Klient wskazał Helvetica Neue Thin. To krój licencjonowany i nie wolno go
 * hostować bez wykupionej licencji webowej, więc do czasu jej dostarczenia
 * używamy Intera w lekkich odmianach — kształtem i rytmem jest najbliższy,
 * a na macOS i tak pierwszeństwo ma prawdziwa Helvetica Neue z listy w globals.css.
 */
const inter = Inter({
  variable: "--font-neue",
  subsets: ["latin", "latin-ext"],
  weight: ["200", "300", "400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description:
    "Architectural visualisation studio. 3d visualizations, 3d animations and 360 tours.",
  metadataBase: new URL(site.url),
  openGraph: {
    title: `${site.name} — ${site.tagline}`,
    siteName: site.name,
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
