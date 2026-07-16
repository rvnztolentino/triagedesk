"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// OAuth (Google) return point. Clerk parses the provider response, finalizes the
// session, and then navigates to the destination passed to authenticateWithRedirect
// (redirectUrlComplete). On failure it falls back to the sign-in page.
export default function AuthCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/onboarding"
      signUpFallbackRedirectUrl="/onboarding"
    />
  );
}
