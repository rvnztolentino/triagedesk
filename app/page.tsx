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
    desc: "AI drafts category, priority, department, summary, and reasoning for admin review.",
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
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className
      )}
    >
      Start now
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function SecondaryLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-5 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-surface-hover hover:border-border-strong",
        className
      )}
    >
      {children}
    </Link>
  );
}

function SignedOutLandingPage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <HomeHeader />

      <main>
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 pt-32 pb-16 sm:pt-36 sm:pb-24">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl md:text-6xl">
                Turn messy internal requests into <span className="text-accent">review-ready tickets</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
                TriageDesk uses AI to read internal requests from staff, suggest a category, priority, and next action, then keeps
                an admin in the loop before anything becomes a tracked ticket.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <StartNowLink className="w-full sm:w-auto" />
                <SecondaryLink href="/login" className="w-full sm:w-auto">Sign in</SecondaryLink>
              </div>
            </div>

            <div className="mx-auto mt-16 max-w-5xl">
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
                <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="ml-3 font-mono text-xs text-muted">triagedesk.app — Demo Clinic review queue</span>
                </div>

                <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
                  <div className="bg-surface p-5">
                    <div className="mb-3 flex items-center gap-2 font-mono text-xs text-muted">
                      <Inbox className="h-3.5 w-3.5" /> REQ-1003 — needs review
                    </div>
                    <div className="rounded-[var(--radius-control)] border border-border bg-bg p-4">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="h-5 w-5 rounded-full bg-surface-hover text-center text-[10px] leading-5 text-muted">N</span>
                        Nurse Station — Recovery Wing, Room 304
                      </div>
                      <p className="mt-3 text-sm text-fg">
                        Aircon in Recovery Room 304 is leaking again. Floor is wet near the outlet.
                      </p>
                      <div className="mt-3 flex gap-1.5">
                        <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-muted">Urgency: wet floor near patients and staff</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface p-5">
                    <div className="mb-3 flex items-center gap-2 text-xs text-accent">
                      <Sparkles className="h-3.5 w-3.5" /> AI triage result
                    </div>
                    <div className="rounded-[var(--radius-control)] border border-accent-border bg-accent-soft p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">Maintenance</span>
                        <span className="st-warn rounded-md border px-2 py-0.5 text-[11px] font-medium">High priority</span>
                      </div>
                      <ul className="mt-3 space-y-1.5 text-xs text-fg">
                        {[
                          "Suggested title: HVAC issue at Recovery Wing, Room 304",
                          "Summary: recurring AC leak creates a wet floor hazard",
                          "Similar ticket found: TRG-1038",
                        ].map((item) => (
                          <li key={item} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-accent" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-surface p-5">
                    <div className="mb-3 flex items-center gap-2 font-mono text-xs text-muted">
                      <ShieldCheck className="h-3.5 w-3.5" /> Admin review
                    </div>
                    <div className="rounded-[var(--radius-control)] border border-border bg-bg p-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Editable review form</span>
                        <span className="st-warn inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium">
                          <AlertTriangle className="h-3 w-3" /> Human decision
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-fg">Approve &amp; Dispatch, Mark duplicate, or Reject</p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Wrench className="h-3.5 w-3.5" /> If approved: new TRG ticket
                        </span>
                        <span>Duplicate option: TRG-1038</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-[11px] text-muted">
                      <History className="h-3.5 w-3.5" />
                      Activity records request saved and AI triage completed before review.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-accent">How it works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">From inbox chaos to tracked resolution</h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map(({ icon: Icon, step, title, desc }) => (
                <div
                  key={step}
                  className="rounded-[var(--radius-card)] border border-border bg-surface p-5 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft">
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <span className="font-mono text-xs text-faint">{step}</span>
                  </div>
                  <h3 className="mt-4 text-base font-medium text-fg">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="highlights" className="border-b border-border bg-surface-2">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-accent">Product highlights</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Everything an operations team needs</h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-[var(--radius-card)] border border-border bg-surface p-5 transition-colors hover:border-border-strong">
                  <Icon className="h-4 w-4 text-accent" />
                  <h3 className="mt-3 text-sm font-medium text-fg">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="preview" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-accent">A real example</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">One request, fully triaged in seconds</h2>
                <p className="mt-4 text-muted">
                  See how a vague staff message becomes a needs-review item with editable triage fields before any ticket is created.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <SecondaryLink href="/join/demo-clinic?code=DEMO-CLINIC-2026">
                    View live demo
                    <ArrowRight className="h-4 w-4" />
                  </SecondaryLink>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 font-mono text-xs text-muted">
                    <Inbox className="h-3.5 w-3.5" /> REQ-1003 — Nurse Station
                  </div>
                  <p className="mt-2 text-sm text-fg">&quot;Aircon in Recovery Room 304 is leaking again. Floor is wet near the outlet.&quot;</p>
                </div>

                <div className="flex justify-center text-faint">
                  <ArrowRight className="h-4 w-4 rotate-90" />
                </div>

                <div className="rounded-[var(--radius-card)] border border-accent-border bg-accent-soft p-4">
                  <div className="flex items-center gap-2 text-xs text-accent">
                    <Sparkles className="h-3.5 w-3.5" /> AI suggestion
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">Maintenance</span>
                    <span className="st-warn rounded-md border px-2 py-0.5 text-[11px] font-medium">
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                      High priority
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-fg">
                    Summary: inspect Recovery Room 304 because the AC leak is recurring and creating a wet floor hazard.
                  </p>
                </div>

                <div className="flex justify-center text-faint">
                  <ArrowRight className="h-4 w-4 rotate-90" />
                </div>

                <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-mono text-xs text-muted">
                      <Ticket className="h-3.5 w-3.5" /> Review outcome
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                      <CheckCircle2 className="h-3 w-3" /> Admin controlled
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-fg">Approve into a new TRG ticket, reject, or mark duplicate of TRG-1038.</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
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

        <section className="border-b border-border">
          <div className="mx-auto max-w-4xl px-5 py-24 text-center">
            <Layers className="mx-auto h-6 w-6 text-accent" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Bring order to your internal requests</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Start triaging in minutes. Keep your team in control with human review on every AI suggestion.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <StartNowLink className="w-full sm:w-auto" />
              <SecondaryLink href="/login" className="w-full sm:w-auto">Sign in</SecondaryLink>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-muted sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandIcon size={26} className="rounded-md" />
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
          <h1 className="text-2xl font-semibold tracking-tight text-fg">TriageDesk</h1>
          <p className="text-muted mt-1">AI operations triage with review workflows, ticket tracking, and resolution analytics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={href("/submit")} className="h-10 px-4 bg-accent hover:opacity-90 text-accent-fg rounded-[var(--radius-control)] text-sm font-medium transition-opacity inline-flex items-center justify-center gap-2">
            <span aria-hidden>+</span> New Request
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 overflow-hidden">
        {isSetupRequired ? (
          <div className="col-span-12 st-warn bg-surface border rounded-[var(--radius-card)] p-6 flex flex-col lg:flex-row gap-5 lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} />
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em]">Manual Setup Required</span>
              </div>
              <h2 className="text-lg font-semibold text-fg mb-2">Complete system setup to use TriageDesk.</h2>
              <p className="text-sm text-muted leading-relaxed">
                Missing configuration: <span className="text-fg">{setupMissingLabels.join(", ")}</span>. Requests, uploads,
                activity, and AI triage require the setup in <span className="font-mono text-fg">.codex/setup.md</span>.
              </p>
            </div>
            <Link href="/api/health" className="px-4 py-2 bg-bg border border-border rounded-[var(--radius-control)] text-sm font-medium text-fg hover:bg-surface-hover transition-colors text-center">
              Check Health
            </Link>
          </div>
        ) : null}

        <div className="col-span-12 bg-surface border border-accent-border rounded-[var(--radius-card)] p-6 flex flex-col lg:flex-row gap-6 justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-accent" />
              <span className="font-mono text-[10px] font-medium text-accent uppercase tracking-[0.14em]">Workflow Overview</span>
            </div>
            <h2 className="text-lg font-semibold text-fg mb-2">Manage the full request-to-resolution loop from one workspace.</h2>
            <p className="text-sm text-muted leading-relaxed">
              Start with a pending high-risk request, review the AI triage, approve it into a ticket, update status and notes,
              then return here to see workload and SLA metrics recalculate from workspace data.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-full lg:min-w-[320px]">
            <Link href={href("/review")} className="bg-bg border border-border rounded-[var(--radius-control)] p-4 hover:border-accent-border transition-colors">
              <Inbox size={18} className="text-accent mb-3" />
              <div className="text-sm font-medium text-fg">1. Review Queue</div>
              <div className="text-xs text-muted mt-1">Approve triage</div>
            </Link>
            <Link href={href("/tickets")} className="bg-bg border border-border rounded-[var(--radius-control)] p-4 hover:border-accent-border transition-colors">
              <Ticket size={18} className="text-accent mb-3" />
              <div className="text-sm font-medium text-fg">2. Track Tickets</div>
              <div className="text-xs text-muted mt-1">Update status</div>
            </Link>
          </div>
        </div>

        <div className="col-span-12 grid grid-cols-2 md:grid-cols-7 gap-4">
          {[
            ["Pending Triage", counts.newRequests, "text-fg"],
            ["Open Tickets", counts.openTickets, "text-fg"],
            ["High Priority", counts.highPriority, "text-[var(--st-danger)]"],
            ["SLA Risk", counts.slaRisk, "text-[var(--st-warn)]"],
            ["Aging", counts.agingTickets, "text-[var(--st-warn)]"],
            ["Assigned", counts.assigned, "text-accent"],
            ["Resolved", counts.resolved, "text-fg"],
          ].map(([label, value, color]) => (
            <div key={label} className="bg-surface border border-border rounded-[var(--radius-card)] p-5 flex flex-col justify-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-2">{label}</span>
              <span className={cn("font-mono text-3xl font-semibold", color as string)}>{value}</span>
            </div>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-7 bg-surface border border-border rounded-[var(--radius-card)] overflow-hidden flex h-[520px] min-h-0 flex-col lg:h-auto lg:[contain:size]">
          <div className="p-5 border-b border-border flex justify-between items-center bg-surface-2">
            <h3 className="font-medium text-fg flex items-center gap-2">
              <Clock size={16} className="text-muted" /> Recent Activity
            </h3>
            <Link href={href("/tickets")} className="text-xs text-accent hover:opacity-90">
              View Tickets &rarr;
            </Link>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="p-10 text-center">
                <h4 className="font-medium text-fg text-sm">No activity yet</h4>
                <p className="text-xs text-muted mt-1">Request and ticket updates will appear here.</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="p-5 border-b border-border flex items-center justify-between hover:bg-surface-hover transition-colors">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-surface-hover text-muted font-medium rounded uppercase">
                        {activity.ticketId ?? activity.requestId}
                      </span>
                      <h4 className="font-medium text-fg text-sm truncate">{activity.action}</h4>
                    </div>
                    <p className="text-xs text-muted truncate max-w-xl">
                      {activity.actor} &middot; {activity.details}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-muted whitespace-nowrap">
                    {new Date(activity.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          <div className="bg-surface border border-accent-border rounded-[var(--radius-card)] p-8 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="font-mono text-[10px] font-medium text-accent uppercase tracking-[0.14em]">AI Triage Result</span>
            </div>

            {featured ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-fg mb-1">{featured.triage.title}</h2>
                  <p className="font-mono text-xs text-muted">
                    Request #{featured.request.id} &middot; Submitted by {featured.request.contactName || "Anonymous"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bg p-4 rounded-[var(--radius-control)] border border-border">
                    <span className="font-mono text-[10px] text-muted uppercase font-medium block mb-1">Department</span>
                    <span className="text-sm text-fg capitalize">{featured.triage.department}</span>
                  </div>
                  <div className="bg-bg p-4 rounded-[var(--radius-control)] border border-border">
                    <span className="font-mono text-[10px] text-muted uppercase font-medium block mb-1">Priority</span>
                    <span className="text-sm text-[var(--st-danger)] font-medium uppercase">{featured.triage.priority}</span>
                  </div>
                </div>

                <div className="bg-bg p-5 rounded-[var(--radius-control)] border border-border">
                  <span className="font-mono text-[10px] text-accent uppercase font-medium block mb-2">Suggested Action</span>
                  <p className="text-sm text-fg leading-relaxed">{featured.triage.priorityReasoning}</p>
                </div>

                <div className="flex gap-3 pt-2 mt-auto">
                  <Link href={href(`/review/${featured.request.id}`)} className="flex-1 py-3 bg-accent hover:opacity-90 text-accent-fg font-medium rounded-[var(--radius-control)] text-xs transition-opacity text-center">
                    APPROVE &amp; ASSIGN
                  </Link>
                  <Link href={href(`/review/${featured.request.id}`)} className="px-6 py-3 bg-surface hover:bg-surface-hover text-fg font-medium rounded-[var(--radius-control)] text-xs transition-colors border border-border">
                    Edit
                  </Link>
                </div>
              </div>
            ) : isSetupRequired ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <AlertTriangle className="text-[var(--st-warn)] mb-4" size={32} />
                <h2 className="text-base font-semibold text-fg">Setup required</h2>
                <p className="text-sm text-muted mt-1">Database and AI triage configuration must be completed before review items appear.</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <CheckCircle2 className="text-accent mb-4" size={32} />
                <h2 className="text-base font-semibold text-fg">Queue clear</h2>
                <p className="text-sm text-muted mt-1">No requests are waiting for review.</p>
              </div>
            )}
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-[var(--radius-card)] p-5">
              <Database className="text-accent mb-4" size={20} />
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted font-medium">Data Store</div>
              <div className="text-2xl font-semibold text-fg mt-1">{isSetupRequired ? "Setup" : "Live"}</div>
            </div>
            <div className="bg-surface border border-border rounded-[var(--radius-card)] p-5">
              <BarChart3 className="text-accent mb-4" size={20} />
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted font-medium">Avg Resolution</div>
              <div className="font-mono text-2xl font-semibold text-fg mt-1">{metricLabel(counts.averageResolutionHours)}h</div>
            </div>
          </div>
        </div>

        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
            <h3 className="font-medium text-fg mb-5 flex items-center gap-2">
              <AlertTriangle size={16} className="text-[var(--st-warn)]" /> Priority Distribution
            </h3>
            <div className="space-y-4">
              {priorityDistribution.map((item) => (
                <div key={item.priority}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted capitalize">{item.priority}</span>
                    <span className="font-mono text-muted">{item.count}</span>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden border border-border">
                    <div className="app-grow-x h-full bg-accent" style={{ width: barWidth(item.count, priorityTotal) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
            <h3 className="font-medium text-fg mb-5">Department Workload</h3>
            <div className="space-y-4">
              {departmentWorkload.filter((item) => item.count > 0).map((item) => (
                <div key={item.department}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted capitalize">{item.department}</span>
                    <span className="font-mono text-muted">{item.count}</span>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden border border-border">
                    <div className="app-grow-x h-full bg-muted" style={{ width: barWidth(item.count, departmentMax) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
            <h3 className="font-medium text-fg mb-5">Resolution Trend</h3>
            <div className="flex items-end gap-3 h-36">
              {resolutionTrend.map((item) => (
                <div key={item.label} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-bg border border-border rounded-t-md flex items-end h-24 overflow-hidden">
                    <div className="app-grow-y w-full bg-accent" style={{ height: `${Math.max(10, item.resolved * 34)}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-muted">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link href={href("/review")} className="col-span-12 bg-surface border border-border rounded-[var(--radius-card)] p-5 flex items-center justify-between hover:bg-surface-hover transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[var(--radius-control)] bg-accent-soft text-accent flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="font-medium text-fg">Review AI triage suggestions</div>
              <div className="text-sm text-muted">Approve, edit, reject, or mark a request as duplicate.</div>
            </div>
          </div>
          <ArrowRight className="text-muted" size={18} />
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
