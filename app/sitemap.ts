import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/auth";

// Only the publicly reachable, indexable routes belong here. The rest of the
// app is auth-gated and excluded via robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();
  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
