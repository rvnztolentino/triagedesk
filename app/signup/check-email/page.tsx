import Link from "next/link";
import { MailCheck } from "lucide-react";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;
  const email = params.email || "your email";

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-8 shadow-xl text-center">
          <div className="mx-auto mb-5 w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center">
            <MailCheck size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-space">Check your email</h1>
          <p className="text-sm text-neutral-500 mt-3 leading-relaxed">
            We sent a verification link to <span className="text-neutral-300">{email}</span>. Confirm that email before signing in or using TriageDesk.
          </p>
          <Link href="/login" className="mt-6 inline-flex h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl text-sm font-bold items-center justify-center">
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
