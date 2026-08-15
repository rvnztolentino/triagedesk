import { createClient } from "@supabase/supabase-js";

export class SetupRequiredError extends Error {
  missing: string[];

  constructor(message: string, missing: string[]) {
    super(message);
    this.name = "SetupRequiredError";
    this.missing = missing;
  }
}

// Single source of truth for the attachments bucket. Upload, signed-download, and
// workspace-delete all have to resolve the same name from the same fallback chain:
// if one copy of this expression ever drifts, deletes start missing the objects
// uploads created and the files outlive the workspace that owned them.
export function requestAttachmentBucket() {
  return process.env.SUPABASE_REQUEST_ATTACHMENTS_BUCKET || process.env.SUPABASE_REQUEST_IMAGES_BUCKET || "request-attachments";
}

export function getRuntimeSetupStatus() {
  const missing: string[] = [];
  const aiProvider = process.env.AI_PROVIDER || "groq";

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  if (!process.env.CLERK_SECRET_KEY) {
    missing.push("CLERK_SECRET_KEY");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
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
    clerkConfigured: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY),
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    groqConfigured: aiProvider === "groq" && Boolean(process.env.GROQ_API_KEY),
    storageBucket: requestAttachmentBucket(),
    missing,
  };
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
