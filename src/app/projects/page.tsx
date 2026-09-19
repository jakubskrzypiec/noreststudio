import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { projects } from "@/lib/media";

export const metadata: Metadata = {
  title: "Projects",
};

/**
 * PROJECTS — sama lista, bez zdjęć, tak jak na planszy: numer i nazwa,
 * pogrupowane pod nagłówkiem kategorii.
 *
 * Na planszy widnieje jedna grupa "CGI". Kolejne kategorie wystarczy dopisać
 * do `category` w data/projects.json — grupowanie poniżej zrobi się samo.
 */
const DEFAULT_CATEGORY = "CGI";

export default function ProjectsPage() {
  const groups = new Map<string, typeof projects>();

  for (const project of projects) {
    const category = DEFAULT_CATEGORY;
    const bucket = groups.get(category) ?? [];
    bucket.push(project);
    groups.set(category, bucket);
  }

  return (
    <main className="min-h-[100svh] bg-paper">
      <Header />

      <div
        className="fade-in mx-auto max-w-[1600px] px-5 pb-24 md:px-10"
        style={{ paddingTop: "calc(var(--header-h) + 4rem)" }}
      >
        {[...groups].map(([category, items]) => (
          <section key={category} className="mb-16 md:mx-auto md:w-1/2">
            <h2 className="label mb-4 w-fit border-b border-ink pb-1 text-ink">{category}</h2>

            <ul>
              {items.map((project, index) => (
                <li key={project.slug}>
                  <Link
                    href={`/work/${project.slug}`}
                    className="label flex items-baseline gap-4 py-[0.2rem] text-ink transition-opacity hover:opacity-60"
                  >
                    <span className="tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                    <span>{project.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
