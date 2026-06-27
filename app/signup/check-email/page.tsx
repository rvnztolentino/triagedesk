import Link from "next/link";
import { MailCheck } from "lucide-react";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;
  const email = params.email || "your email";

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-[var(--radius-card)] p-8 text-center">
          <div className="mx-auto mb-5 w-12 h-12 bg-accent-soft text-accent border border-accent-border rounded-[var(--radius-control)] flex items-center justify-center">
            <MailCheck size={24} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">Check your email</h1>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            If no account exists for <span className="text-fg">{email}</span>, we&apos;ve sent a verification link. It can take a minute to arrive — check your spam folder too. Confirm that email before signing in.
          </p>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            Already have an account? <Link href="/login" className="text-accent hover:opacity-90 font-medium">Sign in</Link>
          </p>
          <Link href="/login" className="mt-6 inline-flex h-10 px-5 bg-accent hover:opacity-90 text-accent-fg rounded-[var(--radius-control)] text-sm font-medium items-center justify-center transition-opacity">
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
