"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { useSignUp } from "@clerk/nextjs";
import { SubmitButton } from "@/components/submit-button";
import { clerkErrorCode, safeInternalNext } from "@/lib/auth-client";

function verifyErrorMessage(code: string) {
  switch (code) {
    case "form_code_incorrect":
    case "verification_failed":
      return "That code is incorrect or has expired. Check the code and try again.";
    default:
      return "We couldn't verify that code. Request a new one and try again.";
  }
}

export default function CheckEmailPage() {
  const { signUp } = useSignUp();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your email";
  const next = searchParams.get("next") || undefined;

  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signUp) return;

    const code = String(new FormData(event.currentTarget).get("code") || "").trim();
    setError("");
    setResent(false);
    setSubmitting(true);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyError) {
        setError(verifyErrorMessage(clerkErrorCode(verifyError)));
        setSubmitting(false);
        return;
      }

      if (signUp.status === "complete") {
        // Full navigation so the server sees the new Clerk session cookie and
        // getCurrentUser JIT-creates the profile from the Clerk account.
        await signUp.finalize({
          navigate: ({ decorateUrl }) => {
            window.location.href = decorateUrl(safeInternalNext(next) ?? "/onboarding");
          },
        });
        return;
      }

      setSubmitting(false);
      setError("Verification isn't complete yet. Please try again.");
    } catch {
      setSubmitting(false);
      setError("We couldn't verify that code. Request a new one and try again.");
    }
  }

  async function handleResend() {
    if (!signUp) return;
    setError("");
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) {
      setError("We couldn't send a new code. Please try again.");
      return;
    }
    setResent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-[var(--radius-card)] p-8 text-center">
          <div className="mx-auto mb-5 w-12 h-12 bg-accent-soft text-accent border border-accent-border rounded-[var(--radius-control)] flex items-center justify-center">
            <MailCheck size={24} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">Check your email</h1>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            We sent a verification code to <span className="text-fg">{email}</span>. Enter it below to finish
            creating your account. It can take a minute to arrive, so check your spam folder too.
          </p>

          <form onSubmit={handleVerify} className="stack" style={{ gap: 12, marginTop: 20, textAlign: "left" }}>
            {error ? (
              <div className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm" role="alert">
                {error}
              </div>
            ) : null}
            {resent ? (
              <div className="rounded-[var(--radius-control)] border border-accent-border bg-accent-soft px-4 py-3 text-sm text-accent" role="status">
                A new code is on its way.
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="code" className="label">Verification code</label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                className="input"
                placeholder="123456"
              />
            </div>
            <SubmitButton pending={submitting} pendingText="Verifying..." className="btn--primary btn--block btn--lg">
              Verify and continue
            </SubmitButton>
          </form>

          <button type="button" onClick={handleResend} className="mt-4 text-sm text-accent hover:opacity-90 font-medium">
            Resend code
          </button>

          <p className="text-sm text-muted mt-4 leading-relaxed">
            Wrong email? <Link href="/signup" className="text-accent hover:opacity-90 font-medium">Start over</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
