"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useSignIn } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { safeInternalNext } from "@/lib/auth-client";

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

  async function handleClick() {
    if (!signIn) return;
    setLoading(true);
    try {
      // Hand the browser off to Google. Clerk returns to /auth/callback to finalize
      // the session, then forwards to redirectUrl (the post-auth destination).
      await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: safeInternalNext(next) ?? "/onboarding",
        redirectCallbackUrl: "/auth/callback",
      });
    } catch {
      setLoading(false);
    }
  }

  return (
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
  );
}
