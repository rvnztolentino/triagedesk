import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { AuthLayout } from "@/components/auth-layout";
import { GoogleSignIn } from "@/components/google-sign-in";
import { redirectSignedInAwayFromAuth } from "@/lib/auth";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  await redirectSignedInAwayFromAuth(params.next);
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

        <SignupForm next={params.next} />
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
