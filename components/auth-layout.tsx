import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, LockKeyhole, Sparkles, X } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";

// Single centered frame holding the auth form (left) beside a live "console"
// preview (right).
export function AuthLayout({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-shell">
      <div className="auth-frame card">
        {/* Same destination as the wordmark below: leaving the form means going
            back to the landing page. */}
        <Link href="/" className="auth-close" aria-label="Close and return to TriageDesk home">
          <X size={17} />
        </Link>

        <div className="auth-form-col">
          <Link href="/" className="cluster" style={{ gap: 10, alignSelf: "flex-start" }} aria-label="TriageDesk home">
            <BrandIcon size={28} className="rounded-md" />
            <span className="text-[15px] font-semibold tracking-tight text-fg">TriageDesk</span>
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none tracking-wide text-muted">
              Beta
            </span>
          </Link>

          <div style={{ marginTop: 22 }}>
            <span className="eyebrow">{eyebrow}</span>
            <h1 style={{ fontSize: 24, marginTop: 10, letterSpacing: "-0.03em", fontWeight: 650 }} className="text-fg">
              {title}
            </h1>
            <p className="muted" style={{ marginTop: 7, fontSize: 13.5 }}>
              {sub}
            </p>
            <div style={{ marginTop: 20 }}>{children}</div>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 22 }}>
            <LockKeyhole size={13} style={{ verticalAlign: "-2px", marginRight: 6, display: "inline" }} />
            Secure sign-in. We never share your workspace data.
          </div>
        </div>

        <AuthAside />
      </div>
    </main>
  );
}

function AuthAside() {
  const steps: [string, string][] = [
    ["Submit", "Anyone drops a free-text request."],
    ["Review", "Admins approve, edit, or reject the AI triage."],
    ["Resolve", "Approved requests become tickets to close out."],
  ];

  return (
    <div className="auth-aside">
      <div style={{ width: "100%" }}>
        <span className="eyebrow">Live triage</span>
        <h2 style={{ fontSize: 17, marginTop: 10, letterSpacing: "-0.02em", fontWeight: 650, lineHeight: 1.3 }} className="text-fg">
          AI reads every request the moment it lands.
        </h2>

        <div className="card card-pad" style={{ marginTop: 16, boxShadow: "var(--shadow-md)" }}>
          <div className="between">
            <span className="badge" data-hue="accent">
              <Sparkles size={12} /> AI suggestion
            </span>
            <span className="badge" data-hue="warn">
              <span className="dot" /> High
            </span>
          </div>
          <div style={{ fontWeight: 650, marginTop: 12, fontSize: 15 }} className="text-fg">
            AC leaking in Room 204
          </div>
          <div className="ai-reason" style={{ marginTop: 12 }}>
            Matched &ldquo;ac, leak, water&rdquo; and routed to Facilities. Urgency term &ldquo;leaking&rdquo; pushes this to high.
          </div>

          <div className="stack" style={{ gap: 7, marginTop: 16 }}>
            <div className="between">
              <span className="mono muted" style={{ fontSize: 11.5 }}>Routing confidence</span>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--accent-text)" }}>91%</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: "91%", background: "var(--accent)" }} />
            </div>
          </div>

          <div className="divider" style={{ margin: "16px 0 0" }} />
          <div className="between" style={{ marginTop: 14 }}>
            <span className="chip">
              <Building2 size={13} /> Facilities
            </span>
            <span className="mono muted" style={{ fontSize: 11.5 }}>#REQ-2048</span>
          </div>
        </div>

        <div className="stack" style={{ gap: 11, marginTop: 20 }}>
          {steps.map(([t, d], i) => (
            <div key={t} className="cluster" style={{ gap: 12, alignItems: "flex-start" }}>
              <span className="flow-num" style={{ margin: 0 }}>
                {i + 1}
              </span>
              <div>
                <div style={{ fontWeight: 600 }} className="text-fg">
                  {t}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {d}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
