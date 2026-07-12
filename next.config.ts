import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
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
