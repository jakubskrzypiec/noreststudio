import Link from "next/link";
import type { Metadata } from "next";
import { AutoVideo } from "@/components/AutoVideo";
import { Header } from "@/components/Header";
import { HorizontalRail } from "@/components/HorizontalRail";
import { ProjectImage } from "@/components/ProjectImage";
import { getCover, getProjectMedia, projects } from "@/lib/media";

export const metadata: Metadata = {
  title: "Work",
};

/**
 * Galeria spod logo — kafle jadące w poziomie, o różnych rozmiarach.
 *
 * Rytm daje zapętlony wzór **szerokości**; wysokość wychodzi z proporcji kadru,
 * więc nic nie jest przycinane. Odwrotnie niż wcześniej: sztywna wysokość plus
 * limit szerokości kadrowały ujęcie i 28 z 29 kafli traciło część obrazu.
 *
 * Suma wzoru to ~112vw, czyli w kadrze widać około trzech kafli naraz — tak jak
 * na planszy klienta.
 */
const WIDTH_PATTERN_VW = [32, 44, 36];

export default function WorkPage() {
  return (
    <main className="flex h-dvh flex-col bg-paper">
      <Header />

      <div className="flex-1 overflow-hidden" style={{ paddingTop: "var(--header-h)" }}>
        <HorizontalRail>
          {projects.map((project, index) => {
            const cover = getCover(project.slug);
            const widthVw = WIDTH_PATTERN_VW[index % WIDTH_PATTERN_VW.length];

            // "Czasem zamiast zdjecia moze tez byc animacja" — plansza klienta.
            // Kafel projektu, który ma film, pokazuje film; reszta zostaje na okładce.
            const tileVideo = getProjectMedia(project.slug).videos[0];
            const media = tileVideo ?? cover;

            return (
              <Link
                key={project.slug}
                href={`/work/${project.slug}`}
                className="group block shrink-0"
              >
                <figure
                  className="flex flex-col gap-3"
                  style={
                    {
                      "--tile-w": `${widthVw}vw`,
                      "--tile-ratio": String(media?.aspectRatio ?? 1.5),
                    } as React.CSSProperties
                  }
                >
                  {/*
                   * Rozmiar bierze się ze wzoru szerokości, a wysokość wylicza
                   * `aspect-ratio` — dzięki temu nic nie jest kadrowane. Rozmiar musi
                   * narzucić kontener, bo <video> — inaczej niż <img> — rozpycha się
                   * do rozdzielczości pliku i jeden kafel potrafił zająć 1920 px.
                   *
                   * Drugie ograniczenie pilnuje, żeby pionowy kadr nie wyszedł poza
                   * ekran na niskim oknie: tam o szerokości decyduje dostępna wysokość.
                   */}
                  <div className="w-full overflow-hidden bg-hairline transition-opacity duration-500 group-hover:opacity-85 aspect-[var(--tile-ratio)] md:w-[min(var(--tile-w),calc(62vh*var(--tile-ratio)))]">
                    {tileVideo ? (
                      <AutoVideo
                        video={tileVideo}
                        ariaLabel={project.title}
                        className="h-full w-full bg-black object-cover"
                      />
                    ) : (
                      cover && (
                        <ProjectImage
                          image={cover}
                          alt={project.title}
                          // Dokładnie tyle, ile kafel zajmuje — zadeklarowane 40vw było
                          // węższe od rzeczywistych 44vw i przeglądarka brała za mały plik.
                          sizes={`(max-width: 768px) 100vw, ${widthVw}vw`}
                          priority={index < 3}
                          className="h-full w-full object-cover"
                        />
                      )
                    )}
                  </div>

                  <figcaption className="label flex items-baseline gap-4 text-muted">
                    <span className="tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ink">{project.title}</span>
                    <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
                      Click for more
                    </span>
                  </figcaption>
                </figure>
              </Link>
            );
          })}
        </HorizontalRail>
      </div>
    </main>
  );
}
