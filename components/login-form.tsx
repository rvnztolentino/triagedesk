"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useSignIn } from "@clerk/nextjs";
import { SubmitButton } from "@/components/submit-button";
import {
  clerkErrorCode,
  clerkErrorMessage,
  formatResendCountdown,
  RESEND_COOLDOWN_SECONDS,
  safeInternalNext,
} from "@/lib/auth-client";

// Maps Clerk's sign-in error codes to the actionable copy the app showed before.
// `form_identifier_not_found` intentionally reveals that no account exists so the
// user is steered to sign up, matching the prior behavior. Unmapped codes fall back
// to Clerk's own specific message rather than a generic "Sign in failed".
function signInErrorMessage(error: unknown) {
  switch (clerkErrorCode(error)) {
    case "form_identifier_not_found":
      return "No account found with this email. Create one to get started.";
    case "form_password_incorrect":
    case "form_password_pwned":
      return "Incorrect email or password.";
    case "form_param_format_invalid":
      return "Enter a valid email address.";
    default:
      return clerkErrorMessage(error) || "Sign in failed. Please try again.";
  }
}

// Copy for the device-verification (Client Trust) code step. Falls back to Clerk's
// own message so an unexpected code isn't hidden behind generic text.
function verifyErrorMessage(error: unknown) {
  switch (clerkErrorCode(error)) {
    case "form_code_incorrect":
    case "verification_failed":
      return "That code is incorrect or has expired. Check the code and try again.";
    default:
      return clerkErrorMessage(error) || "We couldn't verify that code. Request a new one and try again.";
  }
}

export function LoginForm({ next }: { next?: string }) {
  const { signIn } = useSignIn();
  // "password" collects credentials; "code" verifies this device with an emailed
  // code when Clerk's Client Trust requires it (see handleSubmit).
  const [step, setStep] = useState<"password" | "code">("password");
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Tick the resend cooldown down once per second while it's active.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // A full navigation (window.location) rather than a client push guarantees the
  // server sees the freshly set Clerk session cookie on the next render, where
  // getCurrentUser JIT-creates the profile.
  async function finalizeSignIn() {
    if (!signIn) return;
    await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        window.location.href = decorateUrl(safeInternalNext(next) ?? "/onboarding");
      },
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signIn) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    setError("");
    setSubmitting(true);
    try {
      const { error: signInError } = await signIn.password({ identifier: email, password });
      if (signInError) {
        setError(signInErrorMessage(signInError));
        setSubmitting(false);
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      // Client Trust: after a correct password on an untrusted device, Clerk returns
      // `needs_client_trust` (or a `needs_second_factor` email-code step) and expects
      // us to verify the device with an emailed code before completing sign-in. Send
      // the code and switch to the code-entry step. Without this, sign-in stalls.
      if (signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor") {
        const emailCodeFactor = signIn.supportedSecondFactors?.find(
          (factor) => factor.strategy === "email_code"
        );
        if (emailCodeFactor) {
          const { error: sendError } = await signIn.mfa.sendEmailCode();
          if (sendError) {
            setError("We couldn't send a verification code. Please try again.");
            setSubmitting(false);
            return;
          }
          setStep("code");
          setSubmitting(false);
          setCooldown(RESEND_COOLDOWN_SECONDS);
          return;
        }
      }

      // Any other incomplete status needs a step this app doesn't configure. Surface
      // a safe, generic message.
      setError("Additional verification is required to sign in.");
      setSubmitting(false);
    } catch (err) {
      setSubmitting(false);
      setError(signInErrorMessage(err));
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signIn) return;

    const code = String(new FormData(event.currentTarget).get("code") || "").trim();
    setError("");
    setResent(false);
    setSubmitting(true);
    try {
      const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code });
      if (verifyError) {
        setError(verifyErrorMessage(verifyError));
        setSubmitting(false);
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      setSubmitting(false);
      setError("Verification isn't complete yet. Please try again.");
    } catch (err) {
      setSubmitting(false);
      setError(verifyErrorMessage(err));
    }
  }

  async function handleResend() {
    if (!signIn || cooldown > 0 || resending) return;
    setError("");
    setResent(false);
    setResending(true);
    try {
      const { error: sendError } = await signIn.mfa.sendEmailCode();
      if (sendError) {
        // Clerk rate-limits the send server-side too; surface a wait message rather
        // than a generic failure when that's what happened.
        const code = clerkErrorCode(sendError);
        setError(
          code === "too_many_requests" || code === "rate_limit_exceeded"
            ? "You're requesting codes too quickly. Wait a moment and try again."
            : "We couldn't send a new code. Please try again."
        );
        return;
      }
      setResent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("We couldn't send a new code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={handleVerify} className="stack" style={{ gap: 12 }}>
        <p className="text-sm text-muted leading-relaxed">
          For your security, we sent a verification code to your email to confirm this device. Enter it
          below to finish signing in.
        </p>
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
        <SubmitButton pending={submitting} pendingText="Verifying..." className="btn--primary btn--block btn--lg" style={{ marginTop: 4 }}>
          Verify and continue <ArrowRight size={16} />
        </SubmitButton>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="text-sm text-accent hover:opacity-90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cooldown > 0
            ? `Resend code in ${formatResendCountdown(cooldown)}`
            : resending
              ? "Sending..."
              : "Resend code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stack" style={{ gap: 12 }}>
      {error ? (
        <div className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm" role="alert">
          {error}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@company.com" />
      </div>
      <div className="field">
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="••••••••" />
      </div>
      <SubmitButton pending={submitting} pendingText="Signing in..." className="btn--primary btn--block btn--lg" style={{ marginTop: 4 }}>
        Sign in <ArrowRight size={16} />
      </SubmitButton>
    </form>
  );
}
