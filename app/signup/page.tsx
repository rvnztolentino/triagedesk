import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { signUpAction } from "@/app/actions";
import { BrandIcon } from "@/components/brand-icon";
import { GoogleSignIn } from "@/components/google-sign-in";
import { SubmitButton } from "@/components/submit-button";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandIcon size={44} className="mx-auto mb-4 rounded-[var(--radius-control)]" />
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Create your account</h1>
          <p className="text-sm text-muted mt-2">Verify your email to finish setting up your account.</p>
        </div>

        <div className="bg-surface border border-border rounded-[var(--radius-card)] p-8">
          {params.error ? (
            <div className="st-danger mb-5 rounded-[var(--radius-control)] border px-4 py-3 text-sm">{params.error}</div>
          ) : null}

          <form action={signUpAction} className="space-y-5">
            {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium text-fg">Name</label>
              <input id="displayName" name="displayName" type="text" className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm text-fg focus:outline-none focus:border-accent-border" />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-fg">Email</label>
              <input id="email" name="email" type="email" required className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm text-fg focus:outline-none focus:border-accent-border" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-fg">Password</label>
              <input id="password" name="password" type="password" required minLength={8} className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm text-fg focus:outline-none focus:border-accent-border" />
            </div>
            <SubmitButton pendingText="Creating account...">
              <UserPlus size={16} /> Create account
            </SubmitButton>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <GoogleSignIn next={params.next} label="Sign up with Google" />

          <p className="text-sm text-muted mt-6 text-center">
            Already have an account? <Link href={params.next ? `/login?next=${encodeURIComponent(params.next)}` : "/login"} className="text-accent hover:opacity-90 font-medium">Sign in</Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg transition-colors">
            <ArrowLeft size={13} /> Back to landing page
          </Link>
        </div>
      </div>
    </main>
  );
}
