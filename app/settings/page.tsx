import { CheckCircle2, Settings } from "lucide-react";
import { requireUser, getSeedAdminEmail } from "@/lib/auth";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { ThemeSettingsPanel } from "@/components/theme-controls";

export const dynamic = "force-dynamic";

function setupLabel(value: string) {
  const labels: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "database URL",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "browser auth key",
    SUPABASE_SERVICE_ROLE_KEY: "server database key",
    SEED_ADMIN_EMAIL: "seed owner email",
    GROQ_API_KEY: "AI service key",
    "AI_PROVIDER=groq": "AI triage provider",
  };
  return labels[value] ?? value;
}

function maskEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!name || !domain) return "Not configured";
  return `${name.slice(0, 2)}***@${domain}`;
}

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin" || user.role === "owner";
  const setup = isAdmin ? getRuntimeSetupStatus() : null;
  const missing = setup ? setup.missing.map(setupLabel) : [];
  const seedAdminEmail = isAdmin ? getSeedAdminEmail() : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-space">Settings</h1>
          <p className="text-neutral-500 mt-1">
            {isAdmin ? "Review workspace configuration and access policy." : "Manage your personal appearance preferences."}
          </p>
        </div>
      </div>

      {isAdmin && setup ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Settings size={17} className="text-emerald-400" />
              <h2 className="font-semibold text-white">System Health</h2>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-neutral-500">Database</span>
                <span className="text-neutral-200">{setup.supabaseConfigured ? "Configured" : "Missing setup"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-neutral-500">AI triage</span>
                <span className="text-neutral-200">{setup.groqConfigured ? "Configured" : "Missing setup"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Image bucket</span>
                <span className="text-neutral-200">{setup.storageBucket}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 size={17} className="text-emerald-400" />
              <h2 className="font-semibold text-white">Access Policy</h2>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-neutral-500">Signup default role</span>
                <span className="text-neutral-200">Requester</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-neutral-500">Seed owner email</span>
                <span className="text-neutral-200">{maskEmail(seedAdminEmail)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Role changes</span>
                <span className="text-neutral-200">Owner only</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ThemeSettingsPanel />

      {missing.length > 0 ? (
        <div className="bg-[#111111] border border-amber-500/30 rounded-2xl p-6">
          <h2 className="font-semibold text-amber-300">Missing configuration</h2>
          <p className="text-sm text-neutral-500 mt-1">{missing.join(", ")}</p>
        </div>
      ) : null}
    </div>
  );
}
