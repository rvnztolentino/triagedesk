import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { requireSupabaseAdminClient } from "@/lib/supabase";
import { captureOperationalError } from "@/lib/monitoring";

export class RateLimitError extends Error {
  resetAt?: string;

  constructor(message: string, resetAt?: string) {
    super(message);
    this.name = "RateLimitError";
    this.resetAt = resetAt;
  }
}

type RateLimitInput = {
  scope: string;
  keyParts: string[];
  limit: number;
  windowSeconds: number;
  incrementBy?: number;
  message?: string;
};

// Development-only salt. Publishing this repo publishes this constant, so it must
// never be reachable in production, where a known salt is equivalent to no salt.
const DEV_RATE_LIMIT_SALT = "triagedesk-dev-rate-limit";

// Rate-limit keys are hashed before storage so the table never holds raw IPs or
// emails. The salt is the only thing making that hash irreversible: the inputs are
// low-entropy (the whole IPv4 space is 2^32, and emails are guessable), so a known
// salt would let anyone who reads the table recover the identities it exists to
// protect. A dedicated RATE_LIMIT_SALT is preferred; the service-role key is an
// acceptable fallback because a deployment without it cannot serve traffic at all.
function rateLimitSalt() {
  const configured = process.env.RATE_LIMIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_SALT is required in production so stored rate-limit hashes stay unguessable.");
  }

  return DEV_RATE_LIMIT_SALT;
}

export function hashRateLimitKey(parts: string[]) {
  return createHash("sha256")
    .update(rateLimitSalt())
    .update("\0")
    .update(parts.map((part) => part.trim().toLowerCase()).join("\0"))
    .digest("hex");
}

export async function requestIdentity() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || "unknown-ip";

  return {
    ip,
    host: headerStore.get("x-forwarded-host") || headerStore.get("host") || "",
    proto: headerStore.get("x-forwarded-proto") || "https",
    origin: headerStore.get("origin") || "",
  };
}

export async function assertSameOriginRequest() {
  const { host, proto, origin } = await requestIdentity();
  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Request origin is required.");
    }
    return;
  }

  const allowedOrigins = new Set<string>();
  if (host) allowedOrigins.add(`${proto}://${host}`);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) allowedOrigins.add(siteUrl.replace(/\/$/, ""));

  if (!allowedOrigins.has(origin.replace(/\/$/, ""))) {
    throw new Error("Request origin is not allowed.");
  }
}

export async function enforceRateLimit(input: RateLimitInput) {
  const incrementBy = input.incrementBy ?? 1;
  if (incrementBy <= 0) return;

  const client = requireSupabaseAdminClient();
  const { data, error } = await client.rpc("check_rate_limit", {
    target_scope: input.scope,
    target_key_hash: hashRateLimitKey(input.keyParts),
    target_limit: input.limit,
    target_window_seconds: input.windowSeconds,
    target_increment: incrementBy,
  });

  if (error) {
    captureOperationalError(error, { area: "rate_limit", scope: input.scope });
    throw new Error("Rate limit check failed.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    throw new RateLimitError(input.message || "Too many attempts. Try again later.", row?.reset_at);
  }
}

export function verifyHealthcheckToken(provided: string | null) {
  const expected = process.env.HEALTHCHECK_TOKEN;
  if (!expected || !provided) return false;

  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}
