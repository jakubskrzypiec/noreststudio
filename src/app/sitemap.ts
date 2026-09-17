import type { MetadataRoute } from "next";
import { projects } from "@/lib/media";
import { site } from "@/lib/site";

/** Przy `output: export` trasy metadanych muszą być jawnie statyczne. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/work", "/projects", "/contact"].map((route) => ({
    url: `${site.url}${route}`,
    lastModified: new Date(),
  }));

  const projectRoutes = projects.map((project) => ({
    url: `${site.url}/work/${project.slug}`,
    lastModified: new Date(),
  }));

  return [...staticRoutes, ...projectRoutes];
}
