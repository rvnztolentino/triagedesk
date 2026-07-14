import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Session cookies are managed by hand (httpOnly, set in lib/auth.ts). The access
// token is a Supabase JWT that expires hourly, so on its own the week-long cookie
// would only keep users signed in for an hour. This proxy silently rotates the
// access token using the refresh token when it is about to expire, so an active or
// recently-active user stays signed in for the full cookie lifetime.
//
// Names/attributes are kept in sync with lib/auth.ts. This runs in the edge runtime
// and must not import lib/auth.ts (which pulls node:crypto and next/headers).

const ACCESS_COOKIE = "triagedesk_access_token";
const REFRESH_COOKIE = "triagedesk_refresh_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
// Refresh a bit before the token actually expires to avoid a race on the boundary.
const REFRESH_SKEW_SECONDS = 60;

function base64UrlDecode(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Reads the `exp` claim without verifying the signature — used only to decide
// whether a refresh is due. Actual validation still happens in getCurrentUser.
function decodeJwtExp(token: string): number | null {
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!accessToken || !refreshToken) return NextResponse.next();

  const exp = decodeJwtExp(accessToken);
  // Unknown expiry: leave it to getCurrentUser rather than refresh on every request.
  if (exp === null) return NextResponse.next();

  const now = Math.floor(Date.now() / 1000);
  if (exp - now > REFRESH_SKEW_SECONDS) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    // The refresh token is spent or revoked; clear the cookies so the app treats
    // the visitor as signed out instead of retrying a dead token every request.
    const response = NextResponse.next();
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  // Expose the new tokens to this request's server components, then persist them
  // to the browser on the response.
  request.cookies.set(ACCESS_COOKIE, data.session.access_token);
  request.cookies.set(REFRESH_COOKIE, data.session.refresh_token);
  const response = NextResponse.next({ request });
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
  response.cookies.set(ACCESS_COOKIE, data.session.access_token, options);
  response.cookies.set(REFRESH_COOKIE, data.session.refresh_token, options);
  return response;
}

export const config = {
  // Run on app pages only; skip API routes, Next internals, and static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|uploads|docs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|json|webmanifest)$).*)",
  ],
};
