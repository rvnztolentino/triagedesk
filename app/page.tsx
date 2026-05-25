import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  Inbox,
  RefreshCcw,
  Sparkles,
  Ticket,
} from "lucide-react";
import { resetWorkspaceDataAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getDashboardData } from "@/lib/store";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function metricLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function barWidth(count: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.max(8, Math.round((count / total) * 100))}%`;
}

function setupRequirementLabel(value: string) {
  const labels: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "database URL",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "browser auth key",
    SUPABASE_SERVICE_ROLE_KEY: "server database key",
    SEED_ADMIN_EMAIL: "seed admin email",
    GROQ_API_KEY: "AI service key",
    "AI_PROVIDER=groq": "AI triage provider",
  };
  return labels[value] ?? value;
}

export default async function Dashboard() {
  await requireAdmin();
  const data = await getDashboardData();
  const { counts, recentActivity, featuredReview, priorityDistribution, departmentWorkload, resolutionTrend } = data;
  const featured = featuredReview;
  const setupMissing = data.setupRequired ?? [];
  const isSetupRequired = setupMissing.length > 0;
  const setupMissingLabels = setupMissing.map(setupRequirementLabel);
  const priorityTotal = priorityDistribution.reduce((sum, item) => sum + item.count, 0);
  const departmentMax = Math.max(1, ...departmentWorkload.map((item) => item.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-space">TriageDesk</h1>
          <p className="text-neutral-500 mt-1">AI operations triage with review workflows, ticket tracking, and resolution analytics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isSetupRequired ? (
            <button disabled className="h-10 px-4 border border-neutral-800 rounded-lg text-sm font-medium text-neutral-600 inline-flex items-center justify-center gap-2 cursor-not-allowed">
              <RefreshCcw size={15} /> Reset Workspace
            </button>
          ) : (
            <form action={resetWorkspaceDataAction} className="flex">
              <button className="h-10 px-4 border border-neutral-800 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors inline-flex items-center justify-center gap-2">
                <RefreshCcw size={15} /> Reset Workspace
              </button>
            </form>
          )}
          <Link href="/submit" className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-sm font-bold transition-colors inline-flex items-center justify-center">
            + New Request
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 overflow-hidden">
        {isSetupRequired ? (
          <div className="col-span-12 bg-[#111111] border border-amber-500/30 rounded-2xl p-6 flex flex-col lg:flex-row gap-5 lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-400" />
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Manual Setup Required</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Complete system setup to use TriageDesk.</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Missing configuration: <span className="text-neutral-200">{setupMissingLabels.join(", ")}</span>. Requests, uploads,
                activity, and AI triage require the setup in <span className="font-mono text-neutral-200">.codex/setup.md</span>.
              </p>
            </div>
            <Link href="/api/health" className="px-4 py-2 bg-[#0a0a0a] border border-neutral-800 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors text-center">
              Check Health
            </Link>
          </div>
        ) : null}

        <div className="col-span-12 bg-[#111111] border border-emerald-500/30 rounded-2xl p-6 flex flex-col lg:flex-row gap-6 justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Workflow Overview</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Manage the full request-to-resolution loop from one workspace.</h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Start with a pending high-risk request, review the AI triage, approve it into a ticket, update status and notes,
              then return here to see workload and SLA metrics recalculate from workspace data.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-full lg:min-w-[320px]">
            <Link href="/review" className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 hover:border-emerald-500/40 transition-colors">
              <Inbox size={18} className="text-emerald-400 mb-3" />
              <div className="text-sm font-semibold text-white">1. Review Queue</div>
              <div className="text-xs text-neutral-500 mt-1">Approve triage</div>
            </Link>
            <Link href="/tickets" className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 hover:border-emerald-500/40 transition-colors">
              <Ticket size={18} className="text-emerald-400 mb-3" />
              <div className="text-sm font-semibold text-white">2. Track Tickets</div>
              <div className="text-xs text-neutral-500 mt-1">Update status</div>
            </Link>
          </div>
        </div>

        <div className="col-span-12 grid grid-cols-2 md:grid-cols-7 gap-4">
          {[
            ["Pending Triage", counts.newRequests, "text-white"],
            ["Open Tickets", counts.openTickets, "text-white"],
            ["High Priority", counts.highPriority, "text-rose-500"],
            ["SLA Risk", counts.slaRisk, "text-amber-400"],
            ["Aging", counts.agingTickets, "text-orange-400"],
            ["Assigned", counts.assigned, "text-emerald-400"],
            ["Resolved", counts.resolved, "text-white"],
          ].map(([label, value, color]) => (
            <div key={label} className="bg-[#111111] border border-neutral-800 rounded-xl p-5 flex flex-col justify-center">
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-bold mb-2">{label}</span>
              <span className={cn("text-3xl font-bold", color as string)}>{value}</span>
            </div>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-7 bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden self-start">
          <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-[#151515]">
            <h3 className="font-bold text-neutral-300 flex items-center gap-2">
              <Clock size={16} className="text-neutral-500" /> Recent Activity
            </h3>
            <Link href="/tickets" className="text-xs text-emerald-400">
              View Tickets &rarr;
            </Link>
          </div>
          <div className="overflow-y-auto max-h-[430px]">
            {recentActivity.length === 0 ? (
              <div className="p-10 text-center">
                <h4 className="font-semibold text-white text-sm">No activity yet</h4>
                <p className="text-xs text-neutral-500 mt-1">Request and ticket updates will appear here.</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="p-5 border-b border-neutral-800 flex items-center justify-between hover:bg-[#151515] transition-colors">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 bg-neutral-800 text-neutral-400 font-bold rounded uppercase">
                        {activity.ticketId ?? activity.requestId}
                      </span>
                      <h4 className="font-semibold text-white text-sm truncate">{activity.action}</h4>
                    </div>
                    <p className="text-xs text-neutral-500 truncate max-w-xl">
                      {activity.actor} &middot; {activity.details}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Date(activity.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          <div className="bg-neutral-900 border border-emerald-500/30 rounded-2xl p-8 flex-1 shadow-[0_0_40px_-15px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">AI Triage Result</span>
            </div>

            {featured ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">{featured.triage.title}</h2>
                  <p className="text-xs text-neutral-500">
                    Request #{featured.request.id} &middot; Submitted by {featured.request.contactName || "Anonymous"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/30 p-4 rounded-xl border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Department</span>
                    <span className="text-sm text-neutral-200 capitalize">{featured.triage.department}</span>
                  </div>
                  <div className="bg-black/30 p-4 rounded-xl border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Priority</span>
                    <span className="text-sm text-rose-400 font-medium uppercase">{featured.triage.priority}</span>
                  </div>
                </div>

                <div className="bg-black/30 p-5 rounded-xl border border-neutral-800">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-2">Suggested Action</span>
                  <p className="text-sm text-neutral-300 leading-relaxed">{featured.triage.priorityReasoning}</p>
                </div>

                <div className="flex gap-3 pt-2 mt-auto">
                  <Link href={`/review/${featured.request.id}`} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs transition-colors text-center">
                    APPROVE & ASSIGN
                  </Link>
                  <Link href={`/review/${featured.request.id}`} className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors border border-neutral-700">
                    Edit
                  </Link>
                </div>
              </div>
            ) : isSetupRequired ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <AlertTriangle className="text-amber-400 mb-4" size={34} />
                <h2 className="text-lg font-bold text-white">Setup required</h2>
                <p className="text-sm text-neutral-500 mt-1">Database and AI triage configuration must be completed before review items appear.</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <CheckCircle2 className="text-emerald-400 mb-4" size={34} />
                <h2 className="text-lg font-bold text-white">Queue clear</h2>
                <p className="text-sm text-neutral-500 mt-1">No requests are waiting for review.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111111] border border-neutral-800 rounded-xl p-5">
              <Database className="text-emerald-400 mb-4" size={20} />
              <div className="text-xs uppercase tracking-wider text-neutral-500 font-bold">Data Store</div>
              <div className="text-2xl font-bold text-white mt-1">{isSetupRequired ? "Setup" : "Live"}</div>
            </div>
            <div className="bg-[#111111] border border-neutral-800 rounded-xl p-5">
              <BarChart3 className="text-emerald-400 mb-4" size={20} />
              <div className="text-xs uppercase tracking-wider text-neutral-500 font-bold">Avg Resolution</div>
              <div className="text-2xl font-bold text-white mt-1">{metricLabel(counts.averageResolutionHours)}h</div>
            </div>
          </div>
        </div>

        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
            <h3 className="font-bold text-white mb-5 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400" /> Priority Distribution
            </h3>
            <div className="space-y-4">
              {priorityDistribution.map((item) => (
                <div key={item.priority}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-neutral-400 capitalize">{item.priority}</span>
                    <span className="text-neutral-500">{item.count}</span>
                  </div>
                  <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden border border-neutral-800">
                    <div className="h-full bg-emerald-500" style={{ width: barWidth(item.count, priorityTotal) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
            <h3 className="font-bold text-white mb-5">Department Workload</h3>
            <div className="space-y-4">
              {departmentWorkload.filter((item) => item.count > 0).map((item) => (
                <div key={item.department}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-neutral-400 capitalize">{item.department}</span>
                    <span className="text-neutral-500">{item.count}</span>
                  </div>
                  <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden border border-neutral-800">
                    <div className="h-full bg-neutral-400" style={{ width: barWidth(item.count, departmentMax) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
            <h3 className="font-bold text-white mb-5">Resolution Trend</h3>
            <div className="flex items-end gap-3 h-36">
              {resolutionTrend.map((item) => (
                <div key={item.label} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-t-lg flex items-end h-24 overflow-hidden">
                    <div className="w-full bg-emerald-500/80" style={{ height: `${Math.max(10, item.resolved * 34)}%` }} />
                  </div>
                  <span className="text-[10px] text-neutral-500">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link href="/review" className="col-span-12 bg-[#111111] border border-neutral-800 rounded-xl p-5 flex items-center justify-between hover:bg-[#151515] transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="font-semibold text-white">Review AI triage suggestions</div>
              <div className="text-sm text-neutral-500">Approve, edit, reject, or mark a request as duplicate.</div>
            </div>
          </div>
          <ArrowRight className="text-neutral-500" size={18} />
        </Link>
      </div>
    </div>
  );
}
