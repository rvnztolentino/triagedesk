import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { signUpAction } from "@/app/actions";
import { BrandIcon } from "@/components/brand-icon";
import { SubmitButton } from "@/components/submit-button";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandIcon size={48} className="mx-auto mb-4 rounded-xl" />
          <h1 className="text-3xl font-bold tracking-tight text-white font-space">Create your account</h1>
          <p className="text-sm text-neutral-500 mt-2">Verify your email to finish setting up your account.</p>
        </div>

        <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-8 shadow-xl">
          {params.error ? (
            <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{params.error}</div>
          ) : null}

          <form action={signUpAction} className="space-y-5">
            {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-semibold text-neutral-300">Name</label>
              <input id="displayName" name="displayName" type="text" className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-neutral-300">Email</label>
              <input id="email" name="email" type="email" required className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-neutral-300">Password</label>
              <input id="password" name="password" type="password" required minLength={8} className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <SubmitButton pendingText="Creating account...">
              <UserPlus size={16} /> Create account
            </SubmitButton>
          </form>
          <p className="text-sm text-neutral-500 mt-6 text-center">
            Already have an account? <Link href={params.next ? `/login?next=${encodeURIComponent(params.next)}` : "/login"} className="text-emerald-400 hover:text-emerald-300 font-medium">Sign in</Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-white transition-colors">
            <ArrowLeft size={13} /> Back to landing page
          </Link>
        </div>
      </div>
    </main>
  );
}
