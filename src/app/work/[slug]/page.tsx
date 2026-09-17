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
          {placed.map((item) =>
            item.kind === "video" ? (
              <AutoVideo
                key={item.asset.id}
                video={item.asset}
                ariaLabel={`${project.title} — animacja`}
                className={`w-full bg-black ${item.full ? "md:col-span-2" : ""}`}
              />
            ) : (
              <ProjectImage
                key={item.asset.id}
                image={item.asset}
                alt={`${project.title} — ${item.position + 1}`}
                sizes={item.full ? "100vw" : "(max-width: 768px) 100vw, 50vw"}
                priority={item.position === 0}
                className={`w-full ${item.full ? "md:col-span-2" : ""}`}
              />
            ),
          )}
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
