"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useSignIn } from "@clerk/nextjs";
import { SubmitButton } from "@/components/submit-button";
import { clerkErrorCode, clerkErrorMessage, safeInternalNext } from "@/lib/auth-client";

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

export function LoginForm({ next }: { next?: string }) {
  const { signIn } = useSignIn();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        // A full navigation (window.location) rather than a client push guarantees
        // the server sees the freshly set Clerk session cookie on the next render,
        // where getCurrentUser JIT-creates the profile.
        await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            window.location.href = decorateUrl(safeInternalNext(next) ?? "/onboarding");
          },
        });
        return;
      }

      // Password sign-in that isn't immediately complete needs a step (e.g. MFA)
      // this app doesn't configure. Surface a safe, generic message.
      setError("Additional verification is required to sign in.");
      setSubmitting(false);
    } catch (err) {
      setSubmitting(false);
      setError(signInErrorMessage(err));
    }
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
