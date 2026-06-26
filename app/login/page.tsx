import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { signInAction } from "@/app/actions";
import { BrandIcon } from "@/components/brand-icon";
import { SubmitButton } from "@/components/submit-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandIcon size={44} className="mx-auto mb-4 rounded-[var(--radius-control)]" />
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Sign in to TriageDesk</h1>
          <p className="text-sm text-muted mt-2">Access your requests or manage operations work.</p>
        </div>

        <div className="bg-surface border border-border rounded-[var(--radius-card)] p-8">
          {params.error ? (
            <div className="st-danger mb-5 rounded-[var(--radius-control)] border px-4 py-3 text-sm">{params.error}</div>
          ) : null}

          <form action={signInAction} className="space-y-5">
            {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-fg">Email</label>
              <input id="email" name="email" type="email" required className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm text-fg focus:outline-none focus:border-accent-border" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-fg">Password</label>
              <input id="password" name="password" type="password" required minLength={8} className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm text-fg focus:outline-none focus:border-accent-border" />
            </div>
            <SubmitButton pendingText="Signing in...">
              <LockKeyhole size={16} /> Sign in
            </SubmitButton>
          </form>
          <p className="text-sm text-muted mt-6 text-center">
            Need an account? <Link href={params.next ? `/signup?next=${encodeURIComponent(params.next)}` : "/signup"} className="text-accent hover:opacity-90 font-medium">Create one</Link>
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
