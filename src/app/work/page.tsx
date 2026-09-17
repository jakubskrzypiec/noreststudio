import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { HorizontalRail } from "@/components/HorizontalRail";
import { ProjectImage } from "@/components/ProjectImage";
import { getCover, projects } from "@/lib/media";

export const metadata: Metadata = {
  title: "Work",
};

/**
 * Galeria spod logo — kafle jadące w poziomie, o różnej wysokości.
 *
 * Wysokości są zapętlone według stałego wzoru, żeby pas miał rytm taki jak na
 * planszy (niższy kafel, wysoki, niższy), a nie równy ciąg prostokątów.
 */
const HEIGHT_PATTERN = ["md:h-[56vh]", "md:h-[74vh]", "md:h-[48vh]"];

export default function WorkPage() {
  return (
    <main className="flex h-dvh flex-col bg-paper">
      <Header />

      <div className="flex-1 overflow-hidden" style={{ paddingTop: "var(--header-h)" }}>
        <HorizontalRail>
          {projects.map((project, index) => {
            const cover = getCover(project.slug);
            const height = HEIGHT_PATTERN[index % HEIGHT_PATTERN.length];

            return (
              <Link
                key={project.slug}
                href={`/work/${project.slug}`}
                className="group block shrink-0 snap-center"
              >
                <figure className={`flex h-full flex-col gap-3 ${height}`}>
                  {cover ? (
                    <ProjectImage
                      image={cover}
                      alt={project.title}
                      sizes="(max-width: 768px) 90vw, 40vw"
                      priority={index < 3}
                      className="min-h-0 w-auto max-w-none flex-1 object-cover transition-opacity duration-500 group-hover:opacity-85"
                    />
                  ) : (
                    <div className="min-h-0 w-[60vw] flex-1 bg-hairline md:w-[32vw]" />
                  )}

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
