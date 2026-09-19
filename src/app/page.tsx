import { Header } from "@/components/Header";
import { HomeHero } from "@/components/HomeHero";
import { getHomeMedia } from "@/lib/media";
import { site } from "@/lib/site";

/**
 * HOME — pełnoekranowa animacja pod interfejsem, lista usług po prawej.
 * Strona nie przewija się; wszystko mieści się w jednym ekranie.
 */
export default function HomePage() {
  const { videos } = getHomeMedia();

  return (
    <main className="relative h-[100svh] overflow-hidden">
      <HomeHero videos={videos} />

      <Header tone="light" />

      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <div
          className="on-image absolute right-10 flex flex-col gap-3 text-white/90"
          style={{ top: "calc(var(--header-h) + 5rem)" }}
        >
          <p className="label text-white/70">Our services</p>
          <ul className="flex flex-col gap-2">
            {site.services.map((service) => (
              <li key={service} className="text-sm font-light tracking-[0.1em]">
                {service}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
