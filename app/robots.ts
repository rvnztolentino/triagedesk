import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/auth";

// Crawlers may index the public marketing surface (landing page + auth entry
// points) but not the workspace app, admin, API, or upload routes, which are
// auth-gated and carry no value in search.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/account",
        "/settings",
        "/notifications",
        "/onboarding",
        "/submit",
        "/attachments/",
        "/join/",
        "/auth/",
        "/demo/",
        "/w/",
        "/tickets",
        "/requests",
        "/review",
        "/users",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
