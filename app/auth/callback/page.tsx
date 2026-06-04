import { redirect } from "next/navigation";
import { AuthHashCallback } from "@/app/auth/callback/hash-callback";
import { completeEmailOtpVerification, completeEmailVerification, getPostVerificationRedirect } from "@/lib/auth";

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; next?: string; error?: string; error_description?: string }>;
}) {
  const params = await searchParams;

  if (params.code) {
    let redirectTo = "/login";
    try {
      await completeEmailVerification(params.code);
      redirectTo = getPostVerificationRedirect(params.next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email verification failed.";
      redirectTo = `/login?error=${encodeURIComponent(message)}`;
    }
    redirect(redirectTo);
  }

  if (params.token_hash && params.type) {
    let redirectTo = "/login";
    try {
      await completeEmailOtpVerification(params.token_hash, params.type);
      redirectTo = getPostVerificationRedirect(params.next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email verification failed.";
      redirectTo = `/login?error=${encodeURIComponent(message)}`;
    }
    redirect(redirectTo);
  }

  return <AuthHashCallback />;
}
