import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { AuthLayout } from "@/components/auth-layout";
import { GoogleSignIn } from "@/components/google-sign-in";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; deleted?: string }> }) {
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

      {params.deleted ? (
        <div className="rounded-[var(--radius-control)] border border-accent-border bg-accent-soft px-4 py-3 text-sm text-accent" style={{ marginBottom: 16 }}>
          Your account has been deleted.
        </div>
      ) : null}

      <div className="stack" style={{ gap: 12 }}>
        <GoogleSignIn next={params.next} label="Continue with Google" />

        <div className="cluster" style={{ gap: 12, margin: "4px 0" }}>
          <div className="divider grow" />
          <span className="eyebrow">or</span>
          <div className="divider grow" />
        </div>

        <LoginForm next={params.next} />
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
