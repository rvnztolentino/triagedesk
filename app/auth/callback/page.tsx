"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth-layout";

// How long to wait for Clerk to finalize the OAuth session before offering a way out.
// Deliberately generous: the development-instance handshake adds several redirects, and
// bouncing a slow-but-healthy sign-in would be worse than making the user wait. This
// only reveals an escape hatch. The callback stays mounted and still completes if it
// eventually resolves.
const STALLED_AFTER_MS = 20_000;

// OAuth (Google) return point. Clerk parses the provider response, finalizes the
// session, and then navigates to the destination passed to signIn.sso (redirectUrl).
//
// This used to render nothing at all, so a slow or failed return left the user staring
// at a blank page with no indication anything was happening and no way to recover.
export default function AuthCallbackPage() {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStalled(true), STALLED_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AuthLayout
      eyebrow="Signing in"
      title={stalled ? "This is taking longer than usual" : "Finishing sign-in"}
      sub={
        stalled
          ? "We haven't heard back from Google. You can keep waiting, or head back and try again."
          : "Hang tight while we finish setting up your session."
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="cluster" style={{ gap: 10 }}>
          <LoaderCircle size={16} className="animate-spin text-muted" />
          <span className="muted" style={{ fontSize: 13.5 }}>
            Completing Google sign-in...
          </span>
        </div>

        {stalled ? (
          <Link href="/login" className="btn btn--neutral btn--block">
            Back to sign in
          </Link>
        ) : null}
      </div>

      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/onboarding"
        signUpFallbackRedirectUrl="/onboarding"
      />
    </AuthLayout>
  );
}
