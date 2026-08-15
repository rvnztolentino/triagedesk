import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Production only, see instrumentation.ts. Keeps the Sentry SDK out of the dev
// client bundle so it isn't recompiled on every change.
if (process.env.NODE_ENV === "production" && dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.01 : 0,
    beforeSend(event) {
      delete event.user;
      delete event.request?.cookies;
      delete event.request?.headers;
      return event;
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
