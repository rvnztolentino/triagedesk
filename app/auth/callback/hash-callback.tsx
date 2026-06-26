"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { LoaderCircle, MailWarning } from "lucide-react";
import { completeEmailVerificationFromTokensAction } from "@/app/actions";

function errorFromParams(params: URLSearchParams) {
  return params.get("error_description") || params.get("error") || "";
}

export function AuthHashCallback() {
  const startedRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const providerError = errorFromParams(hashParams) || errorFromParams(queryParams);

    if (providerError) {
      startTransition(() => setError(providerError));
      return;
    }

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      startTransition(() => setError("Verification link is missing a session token."));
      return;
    }

    const formData = new FormData();
    formData.set("accessToken", accessToken);
    formData.set("refreshToken", refreshToken);
    const next = queryParams.get("next");
    if (next) formData.set("next", next);

    startTransition(async () => {
      const timeout = new Promise<{ redirectTo?: string; error: string }>((resolve) => {
        window.setTimeout(() => resolve({ error: "Email confirmation timed out. Please open the verification link again." }), 15000);
      });
      const result = await Promise.race([completeEmailVerificationFromTokensAction(formData), timeout]);

      if (result.redirectTo) {
        window.location.replace(result.redirectTo);
        return;
      }

      window.history.replaceState(null, "", window.location.pathname);
      setError(result.error || "Email verification failed.");
    });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-[var(--radius-card)] p-8 text-center">
          {error ? (
            <>
              <div className="st-danger mx-auto mb-5 w-12 h-12 border rounded-[var(--radius-control)] flex items-center justify-center">
                <MailWarning size={24} />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-fg">Email confirmation failed</h1>
              <p className="text-sm text-muted mt-3 leading-relaxed">{error}</p>
              <Link href="/login" className="mt-6 inline-flex h-10 px-5 bg-accent hover:opacity-90 text-accent-fg rounded-[var(--radius-control)] text-sm font-medium items-center justify-center transition-opacity">
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <div className="mx-auto mb-5 w-12 h-12 bg-accent-soft text-accent border border-accent-border rounded-[var(--radius-control)] flex items-center justify-center">
                <LoaderCircle size={24} className="animate-spin" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-fg">Confirming your email</h1>
              <p className="text-sm text-muted mt-3 leading-relaxed">
                {isPending ? "Finishing your account setup." : "Reading your verification link."}
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
