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
 * Galeria spod logo — kafle jadące w poziomie, o różnej wysokości.
 *
 * Wysokości są zapętlone według stałego wzoru, żeby pas miał rytm taki jak na
 * planszy (niższy kafel, wysoki, niższy), a nie równy ciąg prostokątów.
 * Wartości w vh, bo wysokość i wyliczona z niej szerokość idą do CSS-owych zmiennych.
 */
const HEIGHT_PATTERN_VH = [56, 74, 48];

export default function WorkPage() {
  return (
    <main className="flex h-dvh flex-col bg-paper">
      <Header />

      <div className="flex-1 overflow-hidden" style={{ paddingTop: "var(--header-h)" }}>
        <HorizontalRail>
          {projects.map((project, index) => {
            const cover = getCover(project.slug);
            const heightVh = HEIGHT_PATTERN_VH[index % HEIGHT_PATTERN_VH.length];

            // "Czasem zamiast zdjecia moze tez byc animacja" — plansza klienta.
            // Kafel projektu, który ma film, pokazuje film; reszta zostaje na okładce.
            const tileVideo = getProjectMedia(project.slug).videos[0];
            const media = tileVideo ?? cover;

            return (
              <Link
                key={project.slug}
                href={`/work/${project.slug}`}
                className="group block shrink-0 snap-center"
              >
                <figure
                  className="flex flex-col gap-3"
                  style={
                    {
                      "--tile-h": `${heightVh}vh`,
                      "--tile-ratio": String(media?.aspectRatio ?? 1.5),
                    } as React.CSSProperties
                  }
                >
                  {/*
                   * Rozmiar kafla liczymy z wysokości i proporcji kadru, a nie zostawiamy
                   * go zawartości. <video> — inaczej niż <img> — narzuca szerokość
                   * rozdzielczością pliku, więc kafel z animacją rozpychał pas na 1920 px.
                   */}
                  {/*
                   * Szerokość jest ograniczona do 34vw, żeby w kadrze mieściły się trzy
                   * kafle naraz — tak jak na planszy. Panoramy są wtedy przycinane
                   * przez object-cover zamiast rozpychać pas na całą szerokość ekranu.
                   */}
                  <div className="w-full overflow-hidden bg-hairline transition-opacity duration-500 group-hover:opacity-85 aspect-[var(--tile-ratio)] md:aspect-auto md:h-[var(--tile-h)] md:w-[min(calc(var(--tile-h)*var(--tile-ratio)),34vw)]">
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
                          sizes="(max-width: 768px) 90vw, 40vw"
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
