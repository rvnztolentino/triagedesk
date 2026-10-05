import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Baseline response headers for every route. Deliberately no script or connect policy
// here: Clerk, its bot challenge, and Sentry each load from their own origins, and a
// Content-Security-Policy that restricts those needs testing against a live sign-in
// before it ships. frame-ancestors is the one directive that cannot break a page load.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    reactComponentAnnotation: {
      enabled: false,
    },
  },
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
};

// Sentry's build-time instrumentation is only applied to production builds. In
// `next dev` (Turbopack) it inflated the .next cache and taxed every recompile,
// pinning the dev server at high idle CPU for no local benefit. Error tracking
// stays fully intact for `next build`/`next start` (NODE_ENV === "production").
const withSentryIfProd = (config: NextConfig): NextConfig =>
  process.env.NODE_ENV === "production" ? withSentryConfig(config, sentryOptions) : config;

export default withSentryIfProd(nextConfig);
