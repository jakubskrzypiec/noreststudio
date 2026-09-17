import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AutoVideo } from "@/components/AutoVideo";
import { Header } from "@/components/Header";
import { ProjectImage } from "@/components/ProjectImage";
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

  /*
   * Kadry z renderów mają bardzo różne proporcje. Poziome dostają pełną szerokość,
   * pionowe i kwadratowe układają się po dwa w rzędzie — dzięki temu siatka nie ma dziur,
   * a wysokie wnętrza nie zjadają całego ekranu.
   */
  const isWide = (ratio: number) => ratio >= 1.6;

  return (
    <main className="min-h-dvh bg-paper">
      <Header />

      <div
        className="fade-in mx-auto max-w-[1600px] px-5 pb-24 md:px-10"
        style={{ paddingTop: "calc(var(--header-h) + 2rem)" }}
      >
        <div className="mb-8 flex items-baseline justify-between gap-6">
          <h1 className="label text-ink">{project.title}</h1>

          <div className="flex items-center gap-6">
            {project.info && <span className="label text-muted">Info</span>}
            {next && (
              <Link
                href={`/work/${next.slug}`}
                className="label text-ink transition-opacity hover:opacity-60"
              >
                Next project &rarr;
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {videos.map((video) => (
            <AutoVideo
              key={video.id}
              video={video}
              ariaLabel={`${project.title} — animacja`}
              className={`w-full bg-black ${isWide(video.aspectRatio) ? "md:col-span-2" : ""}`}
            />
          ))}

          {images.map((image, index) => (
            <ProjectImage
              key={image.id}
              image={image}
              alt={`${project.title} — ${index + 1}`}
              sizes={isWide(image.aspectRatio) ? "100vw" : "(max-width: 768px) 100vw, 50vw"}
              priority={index === 0}
              className={`w-full ${isWide(image.aspectRatio) ? "md:col-span-2" : ""}`}
            />
          ))}
        </div>

        <dl className="mt-16 grid grid-cols-[6rem_1fr] gap-y-2 md:grid-cols-[8rem_1fr]">
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

        {project.info && (
          <p className="mt-8 max-w-prose text-sm leading-relaxed text-muted">{project.info}</p>
        )}
      </div>
    </main>
  );
}
