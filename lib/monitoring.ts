import * as Sentry from "@sentry/nextjs";

const SENSITIVE_KEYS = ["authorization", "cookie", "token", "password", "email", "prompt", "description", "file", "name"];

function hasSentryDsn() {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN);
}

function scrubRecord(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitiveKey) => lowerKey.includes(sensitiveKey))) {
        return [key, "[redacted]"];
      }
      return [key, value];
    })
  );
}

export function captureOperationalError(error: unknown, context: Record<string, unknown> = {}) {
  const scrubbed = scrubRecord(context);

  // Without a DSN there is no other record of the failure. Dropping it here is
  // what made AI triage look healthy while every request fell back to rules,
  // so the scrubbed context goes to the server log instead.
  if (!hasSentryDsn()) {
    console.warn("[triagedesk] operational error", scrubbed, error);
    return;
  }

  Sentry.withScope((scope) => {
    scope.setContext("triagedesk", scrubbed);
    // Live-demo traffic is anonymous and self-service, so its failures are both more
    // frequent and less urgent than a paying workspace's. Promoting it to a tag makes
    // it filterable in Sentry instead of drowning real signal in the same stream.
    if ("demo" in scrubbed) {
      scope.setTag("demo", String(scrubbed.demo === true));
    }
    Sentry.captureException(error);
  });
}
