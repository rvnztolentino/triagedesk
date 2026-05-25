import Link from "next/link";
import { AlertCircle, ChevronRight, Clock, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listReviewItems } from "@/lib/store";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getPriorityColor(priority: string) {
  switch (priority) {
    case "critical":
      return "bg-rose-500/20 text-rose-500";
    case "high":
      return "bg-amber-500/20 text-amber-500";
    case "medium":
      return "bg-neutral-800 text-neutral-400";
    default:
      return "bg-neutral-800/50 text-neutral-500";
  }
}

export default async function ReviewQueue() {
  await requireAdmin();
  const queue = await listReviewItems();
  const setup = getRuntimeSetupStatus();
  const isSetupRequired = setup.missing.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-space">Review Queue</h1>
          <p className="text-neutral-500 mt-1">AI-triaged requests waiting for human approval.</p>
        </div>
      </div>

      <div className="bg-[#111111] rounded-2xl shadow-xl border border-neutral-800 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-[#151515]">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-500" /> Auto-triage Pending ({queue.length})
          </h2>
        </div>

        <div className="divide-y divide-neutral-800">
          {queue.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="font-semibold text-white">{isSetupRequired ? "Setup required" : "No requests waiting"}</h3>
              <p className="text-sm text-neutral-500 mt-1">
                {isSetupRequired ? "Database and AI triage configuration must be completed." : "New submissions will appear here after AI triage."}
              </p>
              {isSetupRequired ? (
                <Link href="/api/health" className="mt-5 inline-flex bg-neutral-800 text-white border border-neutral-700 rounded-xl px-5 py-2 text-sm font-bold">
                  Check Health
                </Link>
              ) : (
                <Link href="/submit" className="mt-5 inline-flex bg-emerald-500 text-black rounded-xl px-5 py-2 text-sm font-bold">
                  Submit Request
                </Link>
              )}
            </div>
          ) : (
            queue.map(({ request, triage }) => (
              <Link key={request.id} href={`/review/${request.id}`} className="block hover:bg-[#151515] transition-colors group">
                <div className="p-6 flex items-center gap-6">
                  <div className="flex-shrink-0 flex flex-col items-center gap-2 w-16">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", getPriorityColor(triage.priority))}>
                      <AlertCircle size={18} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{triage.priority}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">{triage.title}</h3>
                      <span className="bg-neutral-800 text-neutral-400 text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wide uppercase">
                        {triage.department}
                      </span>
                      <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wide ml-auto uppercase">
                        {request.status}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 truncate mb-2">{request.description}</p>
                    <div className="flex items-center gap-4 text-xs font-medium text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {new Date(request.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>{request.location}</span>
                      <span>{request.contactName || "Anonymous"}</span>
                    </div>
                  </div>

                  <div className="hidden lg:block w-64 bg-neutral-900 rounded-xl p-3 border border-neutral-800">
                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Sparkles size={10} /> AI Summary
                    </div>
                    <div className="text-xs text-neutral-400 line-clamp-2">{triage.summary}</div>
                  </div>

                  <div className="flex-shrink-0 ml-4 text-neutral-600 group-hover:text-white transition-colors">
                    <ChevronRight size={20} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
