import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  History,
  Inbox,
  Layers,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { DashboardView } from "@/components/dashboard-view";
import { HomeHeader } from "@/components/home-header";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// TODO: point this at the actual X post.
const X_POST_URL = "https://x.com/";

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

// Re-exported so `@/app/page` importers (workspace-scoped dashboard route) keep working.
export { DashboardView };

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
    <Link href="/signup?next=/onboarding" className={cn("btn btn--primary btn--lg", className)}>
      Start now
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function SecondaryLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("btn btn--neutral btn--lg", className)}>
      {children}
    </Link>
  );
}

function SectionHead({ eyebrow, title, sub, center = false }: { eyebrow: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl" style={{ letterSpacing: "-0.03em" }}>
        {title}
      </h2>
      {sub ? <p className="muted mx-auto mt-4 max-w-xl" style={{ fontSize: 15 }}>{sub}</p> : null}
    </div>
  );
}

function MacWindow({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface", className)} style={{ boxShadow: "var(--shadow-lg)" }}>
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-3 font-mono text-xs text-muted">{title}</span>
      </div>
      {children}
    </div>
  );
}

// The request → AI suggestion → review-outcome flow shown beside the hero copy.
function HeroTriageFlow() {
  return (
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
  );
}

// A small, realistic mac-window preview for each "How it works" step. Every
// window shares the same title-bar chrome and a fixed body height so the four
// stack up perfectly aligned.
const stepWindows: Record<string, { title: string; body: React.ReactNode }> = {
  "01": {
    title: "triagedesk / new request",
    body: (
      <>
        <div className="mb-2 font-mono text-[11px] text-muted">Describe the issue</div>
        <div className="rounded-[var(--radius-control)] border border-border bg-bg p-3 text-sm text-fg">
          &ldquo;The AC in room 204 is leaking water all over the floor.&rdquo;
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip">Room 204</span>
          <span className="chip">Mira H.</span>
        </div>
      </>
    ),
  },
  "02": {
    title: "triagedesk / ai triage",
    body: (
      <>
        <div className="mb-2 flex items-center gap-2 text-xs text-accent">
          <Sparkles className="h-3.5 w-3.5" /> AI triage · confidence 0.91
        </div>
        <div className="text-sm font-medium text-fg">AC leaking — Room 204</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="badge" data-hue="warn"><span className="dot" /> High</span>
          <span className="chip">Facilities</span>
        </div>
        <div className="ai-reason mt-3" style={{ fontSize: 12 }}>
          Matched &ldquo;ac, leak, water&rdquo; → Facilities. &ldquo;leaking&rdquo; raises priority to high.
        </div>
      </>
    ),
  },
  "03": {
    title: "triagedesk / review",
    body: (
      <>
        <div className="mb-2 font-mono text-[11px] text-muted">Admin review</div>
        <div className="rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-sm text-fg">
          AC leaking — Room 204
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="btn btn--primary btn--sm"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</span>
          <span className="btn btn--sm">Edit</span>
          <span className="btn btn--sm">Reject</span>
        </div>
      </>
    ),
  },
  "04": {
    title: "triagedesk / ticket",
    body: (
      <>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs text-muted">TRG-1041</span>
          <span className="badge" data-hue="active">In progress</span>
        </div>
        <div className="text-sm font-medium text-fg">AC leaking — Room 204</div>
        <div className="mt-3 space-y-1.5 text-xs text-muted">
          <div className="flex items-center justify-between"><span>Facilities</span><span>High priority</span></div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Updated 2m ago</span>
            <span>Note added</span>
          </div>
        </div>
      </>
    ),
  },
};

function StepWindow({ step }: { step: string }) {
  const win = stepWindows[step];
  return (
    <MacWindow title={win.title}>
      <div className="p-4" style={{ minHeight: 156 }}>{win.body}</div>
    </MacWindow>
  );
}

function SignedOutLandingPage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <HomeHeader />

      <main>
        <section className="atmos border-b border-border">
          <div className="mx-auto flex min-h-screen max-w-6xl items-center px-5 pt-28 pb-16">
            <div className="grid w-full grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div>
                <a
                  href={X_POST_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip transition-opacity hover:opacity-80"
                  aria-label="Read the announcement on X"
                >
                  <XIcon className="h-3.5 w-3.5 text-fg" />
                  Read the launch post
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
                  Turn messy internal requests into <span className="text-accent">review-ready tickets</span>
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
                  TriageDesk uses AI to read internal requests from staff, suggest a category, priority, and next action, then keeps
                  an admin in the loop before anything becomes a tracked ticket.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <StartNowLink className="w-full sm:w-auto" />
                  <SecondaryLink href="/login" className="w-full sm:w-auto">
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </SecondaryLink>
                </div>

                <div className="mt-10 flex flex-wrap gap-x-10 gap-y-6">
                  {[
                    ["4", "priority levels"],
                    ["6", "default departments"],
                    ["0", "setup, all in-browser"],
                  ].map(([n, l]) => (
                    <div key={l}>
                      <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent-text)" }}>{n}</div>
                      <div className="eyebrow" style={{ marginTop: 4 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <HeroTriageFlow />
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <SectionHead
              center
              eyebrow="How it works"
              title="From inbox chaos to tracked resolution"
              sub="Every request follows the same four steps. A plain text message becomes a triaged, tracked, and resolved ticket."
            />

            <div className="mt-14 space-y-12">
              {workflowSteps.map(({ icon: Icon, step, title, desc }) => (
                <div
                  key={step}
                  className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-10"
                >
                  <div className="mono" style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: "var(--faint)" }}>
                    {step}
                  </div>
                  <div className="lg:pr-12">
                    <span className="metric-icon">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="text-fg" style={{ fontSize: 18, marginTop: 14, fontWeight: 600 }}>{title}</h3>
                    <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>{desc}</p>
                  </div>
                  <StepWindow step={step} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="highlights" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <SectionHead eyebrow="Product highlights" title="Everything an operations team needs" />

            <div className="cols-3 mt-10">
              {highlights.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="card card-pad card-hover">
                  <span className="metric-icon">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <h3 className="text-fg" style={{ fontSize: 15.5, marginTop: 14, fontWeight: 600 }}>{title}</h3>
                  <p className="muted" style={{ marginTop: 7, fontSize: 13.5 }}>{desc}</p>
                </div>
              ))}
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

export default async function Dashboard() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return <SignedOutLandingPage />;
  return <DashboardView />;
}
