import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk manages the auth session cookie and refreshes it automatically, so this
// middleware just wires Clerk into every request (making `auth()` available in
// server components, route handlers, and server actions). Route protection itself
// is enforced in app code via requireUser / requireWorkspace* in lib/auth.ts.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Clerk's maintained matcher: skip Next internals and static assets, but run on
    // everything else so `auth()` is populated. The previous hand-rolled pattern also
    // excluded whole directories (icons, uploads, docs), which meant a request under
    // one of them that did NOT resolve to a real file fell through to the app and
    // rendered the root layout with no Clerk context, throwing instead of 404ing.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Clerk's frontend API proxy path, so enabling `frontendApiProxy` later works
    // without a matcher change.
    "/__clerk/(.*)",
  ],
};
