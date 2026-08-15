import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Home, Timer } from "lucide-react";
import { endDemoSessionAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { TryDemoButton } from "@/components/try-demo-button";
import { DEMO_SIGNUP_HREF } from "@/lib/demo-ui";

export const dynamic = "force-dynamic";

// Reached only by a visitor holding a dead demo cookie, and it renders their own
// (now deleted) session state. Nothing here belongs in an index.
export const metadata: Metadata = {
  title: "Demo ended",
  robots: { index: false, follow: false },
};

/**
 * Where `requireUser()` sends a visitor whose demo cookie still verifies but whose
 * workspace the expiry sweep has already removed. Without this they would land on
 * /login and be asked to sign in to an account they never had.
 *
 * This page must not call requireUser itself, or a stale cookie would redirect to it
 * forever.
 */
export default function DemoExpiredPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[560px] items-center justify-center p-6">
      <div className="card card-pad w-full" style={{ padding: 28, textAlign: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            margin: "0 auto 16px",
            display: "grid",
            placeItems: "center",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            border: "1px solid var(--accent-border)",
          }}
        >
          <Timer size={24} strokeWidth={2.2} />
        </div>
        <div className="eyebrow">Demo ended</div>
        <h1 style={{ fontSize: 21, fontWeight: 650, letterSpacing: "-0.02em", marginTop: 8 }}>This demo has expired</h1>
        <p className="muted" style={{ marginTop: 10, fontSize: 13.5 }}>
          Demo workspaces are temporary and delete themselves automatically, so this one and
          everything in it is gone. A free account gives you a workspace that does not expire.
        </p>

        <div className="stack" style={{ gap: 10, marginTop: 22 }}>
          {/* Starting over replaces the dead cookie with a live one, so this needs no
              separate cleanup step. */}
          <TryDemoButton
            buttonClassName="btn--primary btn--block"
            label="Start a fresh demo"
            note="A new workspace, still no account needed."
          />
          <Link href={DEMO_SIGNUP_HREF} className="btn btn--neutral btn--block">
            Create a free account <ArrowRight size={15} />
          </Link>
          {/* A form rather than a link: the dead cookie has to be cleared server-side,
              or every guarded page keeps routing back here. */}
          <form action={endDemoSessionAction}>
            <SubmitButton pendingText="Returning..." className="btn--ghost btn--block">
              <Home size={15} /> Back to TriageDesk
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
