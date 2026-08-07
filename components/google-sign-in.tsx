"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useSignIn } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { clerkErrorMessage, safeInternalNext } from "@/lib/auth-client";

// Plain single-color Google "G" mark (inherits the button text color) so it
// reads clean in both themes instead of the multicolor brand logo.
function GoogleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 11v3.6h5.06c-.22 1.3-1.6 3.8-5.06 3.8a5.66 5.66 0 0 1 0-11.32c1.77 0 2.96.76 3.64 1.4l2.48-2.4C16.46 4.28 14.46 3.4 12 3.4a8.6 8.6 0 1 0 0 17.2c4.96 0 8.24-3.48 8.24-8.38 0-.56-.06-1-.14-1.42H12z" />
    </svg>
  );
}

export function GoogleSignIn({ next, label = "Continue with Google" }: { next?: string; label?: string }) {
  const { signIn } = useSignIn();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      // Hand the browser off to Google. Clerk returns to /auth/callback to finalize
      // the session, then forwards to redirectUrl (the post-auth destination).
      //
      // sso() RESOLVES with `{ error }` rather than throwing — the same Signals API
      // contract that login-form and signup-form already destructure. A bare `await`
      // here treated a failed SSO start as success, so the button stayed disabled on
      // "Redirecting to Google..." forever with nothing to explain why. Check the
      // returned error, not just thrown ones.
      const { error: ssoError } = await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: safeInternalNext(next) ?? "/onboarding",
        redirectCallbackUrl: "/auth/callback",
      });

      if (ssoError) {
        setError(clerkErrorMessage(ssoError) || "We couldn't start Google sign-in. Please try again.");
        setLoading(false);
      }
      // On success the browser navigates to Google, so `loading` stays set on purpose —
      // clearing it would flash the idle button during the redirect.
    } catch (err) {
      setError(clerkErrorMessage(err) || "We couldn't start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {error ? (
        <div className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm" role="alert">
          {error}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={cn("btn btn--neutral btn--block")}
      >
        {loading ? (
          <>
            <LoaderCircle size={16} className="animate-spin" /> Redirecting to Google...
          </>
        ) : (
          <>
            <GoogleIcon /> {label}
          </>
        )}
      </button>
    </div>
  );
}
