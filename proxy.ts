import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk manages the auth session cookie and refreshes it automatically, so this
// middleware just wires Clerk into every request (making `auth()` available in
// server components, route handlers, and server actions). Route protection itself
// is enforced in app code via requireUser / requireWorkspace* in lib/auth.ts.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next internals and static assets, but run on everything else so `auth()`
    // is populated; always run on API routes and Clerk's frontend API routes.
    "/((?!_next/static|_next/image|favicon.ico|icons|uploads|docs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|json|webmanifest)$).*)",
    "/(api|trpc)(.*)",
  ],
};
