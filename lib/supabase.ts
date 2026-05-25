import { createClient } from "@supabase/supabase-js";

export class SetupRequiredError extends Error {
  missing: string[];

  constructor(message: string, missing: string[]) {
    super(message);
    this.name = "SetupRequiredError";
    this.missing = missing;
  }
}

export function getRuntimeSetupStatus() {
  const missing: string[] = [];
  const aiProvider = process.env.AI_PROVIDER || "groq";

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!process.env.SEED_ADMIN_EMAIL) {
    missing.push("SEED_ADMIN_EMAIL");
  }

  if (aiProvider !== "groq") {
    missing.push("AI_PROVIDER=groq");
  }

  if (!process.env.GROQ_API_KEY) {
    missing.push("GROQ_API_KEY");
  }

  return {
    aiProvider,
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
    groqConfigured: aiProvider === "groq" && Boolean(process.env.GROQ_API_KEY),
    storageBucket: process.env.SUPABASE_REQUEST_IMAGES_BUCKET || "request-images",
    missing,
  };
}

export function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function requireSupabaseAuthClient() {
  const client = getSupabaseAuthClient();

  if (!client) {
    const status = getRuntimeSetupStatus();
    const missing = status.missing.filter((item) => item.startsWith("NEXT_PUBLIC_SUPABASE"));
    throw new SetupRequiredError("Authentication setup is required before using this workflow.", missing);
  }

  return client;
}

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function requireSupabaseAdminClient() {
  const client = getSupabaseAdminClient();

  if (!client) {
    const status = getRuntimeSetupStatus();
    const missing = status.missing.filter((item) => item.startsWith("NEXT_PUBLIC_SUPABASE") || item.startsWith("SUPABASE_"));
    throw new SetupRequiredError("Database setup is required before using this workflow.", missing);
  }

  return client;
}
