import { getRuntimeSetupStatus } from "@/lib/supabase";
import { verifyHealthcheckToken } from "@/lib/security";

export function GET(request: Request) {
  const setup = getRuntimeSetupStatus();
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  const queryToken = new URL(request.url).searchParams.get("token");
  const canViewDetails = process.env.NODE_ENV !== "production" || verifyHealthcheckToken(bearerToken || queryToken);

  if (!canViewDetails) {
    return Response.json({
      ok: setup.missing.length === 0,
      app: "triagedesk",
    });
  }

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
