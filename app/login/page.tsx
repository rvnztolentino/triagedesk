import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signInAction } from "@/app/actions";
import { AuthLayout } from "@/components/auth-layout";
import { GoogleSignIn } from "@/components/google-sign-in";
import { SubmitButton } from "@/components/submit-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const signupHref = params.next ? `/signup?next=${encodeURIComponent(params.next)}` : "/signup";

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back"
      sub="Access your requests or manage operations work."
    >
      {params.error ? (
        <div className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm" style={{ marginBottom: 16 }}>
          {params.error}
        </div>
      ) : null}

      <div className="stack" style={{ gap: 12 }}>
        <GoogleSignIn next={params.next} label="Continue with Google" />

        <div className="cluster" style={{ gap: 12, margin: "4px 0" }}>
          <div className="divider grow" />
          <span className="eyebrow">or</span>
          <div className="divider grow" />
        </div>

        <form action={signInAction} className="stack" style={{ gap: 12 }}>
          {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
          <div className="field">
            <label htmlFor="email" className="label">Email</label>
            <input id="email" name="email" type="email" required className="input" placeholder="you@company.com" />
          </div>
          <div className="field">
            <label htmlFor="password" className="label">Password</label>
            <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="••••••••" />
          </div>
          <SubmitButton pendingText="Signing in..." className="btn--primary btn--block btn--lg" style={{ marginTop: 4 }}>
            Sign in <ArrowRight size={16} />
          </SubmitButton>
        </form>
      </div>

      <p className="muted" style={{ marginTop: 20, fontSize: 13.5, textAlign: "center" }}>
        No account?{" "}
        <Link href={signupHref} className="link">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
