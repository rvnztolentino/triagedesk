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
            We sent a verification link to <span className="text-fg">{email}</span>. Confirm that email before signing in or using TriageDesk.
          </p>
          <Link href="/login" className="mt-6 inline-flex h-10 px-5 bg-accent hover:opacity-90 text-accent-fg rounded-[var(--radius-control)] text-sm font-medium items-center justify-center transition-opacity">
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
