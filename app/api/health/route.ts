import { getRuntimeSetupStatus } from "@/lib/supabase";

export function GET() {
  const setup = getRuntimeSetupStatus();

  return Response.json({
    ok: setup.missing.length === 0,
    app: "triagedesk",
    aiProvider: setup.aiProvider,
    supabaseConfigured: setup.supabaseConfigured,
    groqConfigured: setup.groqConfigured,
    storageBucket: setup.storageBucket,
    missing: setup.missing,
  });
}
