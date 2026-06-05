import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  History,
  Inbox,
  Layers,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wrench,
} from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { HomeHeader } from "@/components/home-header";
import { getCurrentUser, requireWorkspaceAdminContext } from "@/lib/auth";
import { getDashboardData } from "@/lib/store";
import { cn } from "@/lib/utils";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

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
    SEED_ADMIN_EMAIL: "seed owner email",
    GROQ_API_KEY: "AI service key",
    "AI_PROVIDER=groq": "AI triage provider",
  };
  return labels[value] ?? value;
}

const workflowSteps = [
  {
    icon: Inbox,
    step: "01",
    title: "Submit request",
    desc: "A requester describes the issue, location, contact, urgency, and optional attachments.",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "AI triages",
    desc: "The app saves a needs-review request and stores the Groq triage result.",
  },
  {
    icon: ShieldCheck,
    step: "03",
    title: "Admin reviews",
    desc: "An admin edits title, priority, department, and summary, then approves, rejects, or marks duplicate.",
  },
  {
    icon: Ticket,
    step: "04",
    title: "Track resolution",
    desc: "Approval creates a TRG ticket with status new; later updates add notes and activity.",
  },
];

const highlights = [
  { icon: Sparkles, title: "AI-assisted triage", desc: "Suggested category, priority, and action notes on every request." },
  { icon: Building2, title: "Workspace-scoped data", desc: "Strict isolation per workspace so staff only see what they should." },
  { icon: Users, title: "Requester & admin roles", desc: "Requester, admin, and owner roles with clean permission boundaries." },
  { icon: ListChecks, title: "Review queue", desc: "A focused queue for admins to approve, edit, or reject AI suggestions." },
  { icon: Ticket, title: "Ticket lifecycle", desc: "Open, in-progress, blocked, resolved, with assignees and timestamps." },
  { icon: History, title: "Activity history", desc: "An audit-friendly trail of who did what, when, and why." },
];

function StartNowLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/signup?next=/onboarding"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-emerald-600",
        className
      )}
    >
      Start now
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function SignedOutLandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 antialiased selection:bg-emerald-500/30">
      <HomeHeader />

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_60%)]"
          />
          <div className="relative mx-auto max-w-6xl px-5 pt-28 pb-16 sm:pt-32 sm:pb-24">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-[#111111] px-3 py-1 text-xs text-neutral-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Built for operations teams
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
                Turn messy internal requests into <span className="text-emerald-400">review-ready tickets</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
                TriageDesk uses AI to read internal requests from staff, suggest a category, priority, and next action, then keeps
                an admin in the loop before anything becomes a tracked ticket.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <StartNowLink className="w-full sm:w-auto" />
                <Link
                  href="/join/demo-clinic?code=DEMO-CLINIC-2026"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-neutral-800 bg-[#111111] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800 sm:w-auto"
                >
                  View demo
                </Link>
              </div>
            </div>

            <div className="relative mx-auto mt-16 max-w-5xl">
              <div
                aria-hidden
                className="absolute -inset-x-6 -inset-y-4 rounded-3xl bg-gradient-to-b from-emerald-500/10 to-transparent blur-2xl"
              />
              <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[#0d0d0d] shadow-2xl shadow-black/40">
                <div className="flex items-center gap-2 border-b border-neutral-800 bg-[#111111] px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                  </div>
                  <span className="ml-3 text-xs text-neutral-500">triagedesk.app - Demo Clinic review queue</span>
                </div>

                <div className="grid grid-cols-1 gap-px bg-neutral-800 md:grid-cols-3">
                  <div className="bg-[#0d0d0d] p-5">
                    <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
                      <Inbox className="h-3.5 w-3.5" /> REQ-1003 - needs-review
                    </div>
                    <div className="rounded-lg border border-neutral-800 bg-[#111111] p-4">
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span className="h-5 w-5 rounded-full bg-neutral-800 text-center text-[10px] leading-5 text-neutral-400">N</span>
                        Nurse Station - Recovery Wing, Room 304
                      </div>
                      <p className="mt-3 text-sm text-neutral-200">
                        Aircon in Recovery Room 304 is leaking again. Floor is wet near the outlet.
                      </p>
                      <div className="mt-3 flex gap-1.5">
                        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">Urgency: wet floor near patients and staff</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0d0d0d] p-5">
                    <div className="mb-3 flex items-center gap-2 text-xs text-emerald-400">
                      <Sparkles className="h-3.5 w-3.5" /> TRI-1003 - Groq triage
                    </div>
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">Maintenance</span>
                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">High priority</span>
                      </div>
                      <ul className="mt-3 space-y-1.5 text-xs text-neutral-300">
                        {[
                          "Suggested title: HVAC issue at Recovery Wing, Room 304",
                          "Summary: recurring AC leak creates a wet floor hazard",
                          "Similar ticket found: TRG-1038",
                        ].map((item) => (
                          <li key={item} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-[#0d0d0d] p-5">
                    <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
                      <ShieldCheck className="h-3.5 w-3.5" /> Admin review
                    </div>
                    <div className="rounded-lg border border-neutral-800 bg-[#111111] p-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Editable review form</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-bold text-amber-300">
                          <AlertTriangle className="h-3 w-3" /> Human decision
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white">Approve & Dispatch, Mark duplicate, or Reject</p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <Wrench className="h-3.5 w-3.5" /> If approved: new TRG ticket
                        </span>
                        <span>Duplicate option: TRG-1038</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-neutral-800 bg-[#0a0a0a] px-3 py-2 text-[11px] text-neutral-500">
                      <History className="h-3.5 w-3.5" />
                      Activity records request saved and AI triage completed before review.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-neutral-800">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">From inbox chaos to tracked resolution</h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map(({ icon: Icon, step, title, desc }) => (
                <div
                  key={step}
                  className="group rounded-xl border border-neutral-800 bg-[#111111] p-5 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/20">
                      <Icon className="h-4 w-4 text-emerald-400" />
                    </div>
                    <span className="font-mono text-xs text-neutral-600">{step}</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 text-sm text-neutral-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="highlights" className="border-t border-neutral-800 bg-[#111111]">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Product highlights</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Everything an operations team needs</h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-neutral-800 bg-[#0d0d0d] p-5 transition-colors hover:border-neutral-700 hover:bg-neutral-800">
                  <Icon className="h-4 w-4 text-emerald-400" />
                  <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 text-sm text-neutral-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="preview" className="border-t border-neutral-800">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">A real example</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">One request, fully triaged in seconds</h2>
                <p className="mt-4 text-neutral-400">
                  See how a vague staff message becomes a needs-review item with editable triage fields before any ticket is created.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/join/demo-clinic?code=DEMO-CLINIC-2026"
                    className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-[#111111] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-neutral-800"
                  >
                    View live demo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-neutral-800 bg-[#111111] p-4">
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Inbox className="h-3.5 w-3.5" /> REQ-1003 - Nurse Station
                  </div>
                  <p className="mt-2 text-sm text-neutral-200">&quot;Aircon in Recovery Room 304 is leaking again. Floor is wet near the outlet.&quot;</p>
                </div>

                <div className="flex justify-center text-neutral-700">
                  <ArrowRight className="h-4 w-4 rotate-90" />
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <Sparkles className="h-3.5 w-3.5" /> AI suggestion
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">Maintenance</span>
                    <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                      High priority
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-300">
                    Summary: inspect Recovery Room 304 because the AC leak is recurring and creating a wet floor hazard.
                  </p>
                </div>

                <div className="flex justify-center text-neutral-700">
                  <ArrowRight className="h-4 w-4 rotate-90" />
                </div>

                <div className="rounded-xl border border-neutral-800 bg-[#111111] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Ticket className="h-3.5 w-3.5" /> Review outcome
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Admin controlled
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white">Approve into a new TRG ticket, reject, or mark duplicate of TRG-1038.</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Activity history
                    </span>
                    <span>Ticket updates add notes and status changes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-neutral-800">
          <div className="mx-auto max-w-4xl px-5 py-24 text-center">
            <Layers className="mx-auto h-6 w-6 text-emerald-400" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Bring order to your internal requests</h2>
            <p className="mx-auto mt-3 max-w-xl text-neutral-400">
              Start triaging in minutes. Keep your team in control with human review on every AI suggestion.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <StartNowLink className="w-full sm:w-auto" />
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-neutral-800 bg-[#111111] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800 sm:w-auto"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-neutral-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandIcon size={28} className="rounded-md" />
            <span>TriageDesk</span>
          </div>
          <span>© {new Date().getFullYear()} TriageDesk. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

export async function DashboardView({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const { workspace } = await requireWorkspaceAdminContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const data = await getDashboardData(workspace.id);
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
          <Link href={href("/submit")} className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-sm font-bold transition-colors inline-flex items-center justify-center">
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
            <Link href={href("/review")} className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 hover:border-emerald-500/40 transition-colors">
              <Inbox size={18} className="text-emerald-400 mb-3" />
              <div className="text-sm font-semibold text-white">1. Review Queue</div>
              <div className="text-xs text-neutral-500 mt-1">Approve triage</div>
            </Link>
            <Link href={href("/tickets")} className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 hover:border-emerald-500/40 transition-colors">
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

        <div className="col-span-12 lg:col-span-7 bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden flex h-[520px] min-h-0 flex-col lg:h-auto lg:[contain:size]">
          <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-[#151515]">
            <h3 className="font-bold text-neutral-300 flex items-center gap-2">
              <Clock size={16} className="text-neutral-500" /> Recent Activity
            </h3>
            <Link href={href("/tickets")} className="text-xs text-emerald-400">
              View Tickets &rarr;
            </Link>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
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
          <div className="bg-neutral-900 border border-emerald-500/30 rounded-2xl p-8 shadow-accent-glow relative overflow-hidden">
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
                  <Link href={href(`/review/${featured.request.id}`)} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs transition-colors text-center">
                    APPROVE & ASSIGN
                  </Link>
                  <Link href={href(`/review/${featured.request.id}`)} className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors border border-neutral-700">
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

          <div className="grid shrink-0 grid-cols-2 gap-4">
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

        <Link href={href("/review")} className="col-span-12 bg-[#111111] border border-neutral-800 rounded-xl p-5 flex items-center justify-between hover:bg-[#151515] transition-colors">
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

export default async function Dashboard() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return <SignedOutLandingPage />;
  return <DashboardView />;
}
