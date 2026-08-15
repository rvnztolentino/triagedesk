"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useSignUp } from "@clerk/nextjs";
import { SubmitButton } from "@/components/submit-button";
import { assertCleanDisplayName } from "@/lib/display-name";
import { PublicError } from "@/lib/errors";
import { clerkErrorCode, clerkErrorMessage, safeInternalNext } from "@/lib/auth-client";

// Unmapped codes fall back to Clerk's own specific message rather than a generic
// "Create account failed".
function signUpErrorMessage(error: unknown) {
  switch (clerkErrorCode(error)) {
    case "form_identifier_exists":
      return "An account with this email already exists. Sign in instead.";
    case "form_password_pwned":
      return "Choose a stronger password. This one has appeared in a data breach.";
    case "form_password_length_too_short":
      return "Password must be at least 8 characters.";
    case "form_param_format_invalid":
      return "Enter a valid email address.";
    default:
      return clerkErrorMessage(error) || "Create account failed. Please try again.";
  }
}

export function SignupForm({ next }: { next?: string }) {
  const { signUp } = useSignUp();
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signUp) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const rawName = String(form.get("displayName") || "").trim();

    setError("");

    // Run the chosen name through the same filter as the account editor so a
    // profane/link-bearing/malformed name can't be seeded into the profile. Empty
    // is allowed and later falls back to the email prefix.
    let displayName = "";
    if (rawName) {
      try {
        displayName = assertCleanDisplayName(rawName);
      } catch (err) {
        setError(err instanceof PublicError ? err.message : "That name can't be used.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { error: createError } = await signUp.password({
        emailAddress: email,
        password,
        unsafeMetadata: displayName ? { display_name: displayName } : {},
      });
      if (createError) {
        setError(signUpErrorMessage(createError));
        setSubmitting(false);
        return;
      }

      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError("We couldn't send a verification code. Please try again.");
        setSubmitting(false);
        return;
      }

      const params = new URLSearchParams({ email });
      const safeNext = safeInternalNext(next);
      if (safeNext) params.set("next", safeNext);
      router.push(`/signup/check-email?${params.toString()}`);
    } catch (err) {
      setSubmitting(false);
      setError(signUpErrorMessage(err));
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
        <label htmlFor="displayName" className="label">Full name</label>
        <input id="displayName" name="displayName" type="text" maxLength={80} className="input" placeholder="Emma Wells" />
      </div>
      <div className="field">
        <label htmlFor="email" className="label">Work email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@company.com" />
      </div>
      <div className="field">
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="Create a password" />
      </div>
      {/* Clerk renders an invisible CAPTCHA/bot-protection widget into this node. */}
      <div id="clerk-captcha" />
      <SubmitButton pending={submitting} pendingText="Creating account..." className="btn--primary btn--block btn--lg" style={{ marginTop: 4 }}>
        Create account <ArrowRight size={16} />
      </SubmitButton>
    </form>
  );
}
