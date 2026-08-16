import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashRateLimitKey, verifyHealthcheckToken } from "./security";

const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("security hardening", () => {
  it("hashes rate-limit keys with a server-side salt", () => {
    vi.stubEnv("RATE_LIMIT_SALT", "salt-one");
    const first = hashRateLimitKey(["User@Example.com", " 127.0.0.1 "]);
    const second = hashRateLimitKey(["user@example.com", "127.0.0.1"]);

    expect(first).toBe(second);
    expect(first).not.toContain("user@example.com");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("falls back to the service-role key before the development salt", () => {
    vi.stubEnv("RATE_LIMIT_SALT", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    const withServiceKey = hashRateLimitKey(["127.0.0.1"]);

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const withDevSalt = hashRateLimitKey(["127.0.0.1"]);

    expect(withServiceKey).not.toBe(withDevSalt);
  });

  it("refuses the published development salt in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_SALT", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => hashRateLimitKey(["127.0.0.1"])).toThrow(/RATE_LIMIT_SALT is required in production/);

    vi.stubEnv("RATE_LIMIT_SALT", "production-salt");
    expect(hashRateLimitKey(["127.0.0.1"])).toMatch(/^[a-f0-9]{64}$/);
  });

  it("defines service-role-only Supabase rate-limit storage", () => {
    expect(schemaSql).toContain("create table if not exists security_rate_limits");
    expect(schemaSql).toContain("alter table security_rate_limits enable row level security");
    expect(schemaSql).toContain("grant select, insert, update, delete on table security_rate_limits to service_role");
    expect(schemaSql).toContain("create or replace function check_rate_limit");
    expect(schemaSql).toContain("grant execute on function check_rate_limit(text, text, integer, integer, bigint) to service_role");
  });

  it("verifies healthcheck tokens with exact matches only", () => {
    vi.stubEnv("HEALTHCHECK_TOKEN", "expected-token");

    expect(verifyHealthcheckToken("expected-token")).toBe(true);
    expect(verifyHealthcheckToken("wrong-token")).toBe(false);
    expect(verifyHealthcheckToken(null)).toBe(false);
  });
});
