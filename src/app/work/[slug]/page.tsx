import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AutoVideo } from "@/components/AutoVideo";
import { Header } from "@/components/Header";
import { ProjectImage } from "@/components/ProjectImage";
import { placeMedia } from "@/lib/layout";
import {
  getNextProject,
  getProject,
  getProjectMedia,
  projects,
} from "@/lib/media";

/** Wszystkie projekty są znane w czasie builda, więc generujemy je statycznie. */
export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  return { title: project?.title ?? "Work" };
}

export default async function ProjectPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const { images, videos } = getProjectMedia(slug);
  const next = getNextProject(slug);

  const placed = placeMedia([
    ...videos.map((asset) => ({ kind: "video" as const, asset })),
    ...images.map((asset, position) => ({ kind: "image" as const, asset, position })),
  ]);

  return (
    <main className="min-h-dvh bg-paper">
      <Header />

      <div
        className="fade-in mx-auto max-w-[1600px] px-5 pb-24 md:px-10"
        style={{ paddingTop: "calc(var(--header-h) + 2rem)" }}
      >
        <div className="mb-4 flex items-baseline justify-between gap-6">
          <h1 className="label text-ink">{project.title}</h1>

          {next && (
            <Link
              href={`/work/${next.slug}`}
              className="label text-ink transition-opacity hover:opacity-60"
            >
              Next project &rarr;
            </Link>
          )}
        </div>

        {/*
         * Opis projektu pod tytułem, nad zdjęciami - jak na poprawkach klienta
         * (INFO / CLIENT / DATE). Treści dostarcza klient do projects.json; puste pola
         * się nie pokazują.
         */}
        {(project.info || project.client || project.date) && (
          <dl className="mb-6 grid max-w-xl grid-cols-[5rem_1fr] gap-x-6 gap-y-1.5 md:grid-cols-[6rem_1fr]">
            {project.info && (
              <>
                <dt className="label text-muted">Info</dt>
                <dd className="text-sm leading-relaxed text-ink">{project.info}</dd>
              </>
            )}
            {project.client && (
              <>
                <dt className="label text-muted">Client</dt>
                <dd className="label text-ink">{project.client}</dd>
              </>
            )}
            {project.date && (
              <>
                <dt className="label text-muted">Date</dt>
                <dd className="label text-ink">{project.date}</dd>
              </>
            )}
          </dl>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {placed.map((item) => (
            /*
             * Proporcje niesie pojemnik, nie samo zdjęcie. W parze są wspólne, więc
             * oba kadry mają tę samą wysokość i pod niższym nie zostaje pusta połowa
             * wiersza. Na telefonie każdy kadr wraca do własnych proporcji — tam
             * wszystko i tak jest jednokolumnowe, więc nie ma czego wyrównywać.
             */
            <div
              key={item.asset.id}
              // Kadr na pełnej szerokości zajmuje cały wiersz, tak samo jak para obok
              // siebie. Wcześniejsze limity (wysokość ekranu, rozdzielczość pliku)
              // zwężały pojedyncze kadry i wystawały spod nich pary - klient prosił,
              // żeby wszystkie obrazy pod sobą miały równą szerokość.
              className={`w-full overflow-hidden aspect-[var(--own)] md:aspect-[var(--row)] ${
                item.full ? "md:col-span-2" : ""
              }`}
              style={
                {
                  "--own": String(item.asset.aspectRatio),
                  "--row": String(item.rowRatio),
                } as React.CSSProperties
              }
            >
              {item.kind === "video" ? (
                <AutoVideo
                  video={item.asset}
                  ariaLabel={`${project.title} — animacja`}
                  className="h-full w-full bg-black object-cover"
                />
              ) : (
                <ProjectImage
                  image={item.asset}
                  alt={`${project.title} — ${item.position + 1}`}
                  sizes={item.full ? "(max-width: 768px) 100vw, 1520px" : "(max-width: 768px) 100vw, 760px"}
                  priority={item.position === 0}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
