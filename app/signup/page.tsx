import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signUpAction } from "@/app/actions";
import { AuthLayout } from "@/components/auth-layout";
import { GoogleSignIn } from "@/components/google-sign-in";
import { SubmitButton } from "@/components/submit-button";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const loginHref = params.next ? `/login?next=${encodeURIComponent(params.next)}` : "/login";

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      sub="Spin up a workspace and start triaging requests in minutes."
    >
      {params.error ? (
        <div className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm" style={{ marginBottom: 16 }}>
          {params.error}
        </div>
      ) : null}

      <div className="stack" style={{ gap: 12 }}>
        <GoogleSignIn next={params.next} label="Sign up with Google" />

        <div className="cluster" style={{ gap: 12, margin: "4px 0" }}>
          <div className="divider grow" />
          <span className="eyebrow">or</span>
          <div className="divider grow" />
        </div>

        <form action={signUpAction} className="stack" style={{ gap: 12 }}>
          {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
          <div className="field">
            <label htmlFor="displayName" className="label">Full name</label>
            <input id="displayName" name="displayName" type="text" className="input" placeholder="Vic Marlowe" />
          </div>
          <div className="field">
            <label htmlFor="email" className="label">Work email</label>
            <input id="email" name="email" type="email" required className="input" placeholder="you@company.com" />
          </div>
          <div className="field">
            <label htmlFor="password" className="label">Password</label>
            <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="Create a password" />
          </div>
          <SubmitButton pendingText="Creating account..." className="btn--primary btn--block btn--lg" style={{ marginTop: 4 }}>
            Create account <ArrowRight size={16} />
          </SubmitButton>
        </form>
      </div>

      <p className="muted" style={{ marginTop: 20, fontSize: 13.5, textAlign: "center" }}>
        Already have an account?{" "}
        <Link href={loginHref} className="link">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
