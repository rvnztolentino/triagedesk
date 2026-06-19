import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

const beforeSend: NonNullable<Parameters<typeof Sentry.init>[0]["beforeSend"]> = (event) => {
  delete event.user;
  delete event.request?.cookies;
  delete event.request?.headers;
  return event;
};

export async function register() {
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.02 : 0,
      beforeSend,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
