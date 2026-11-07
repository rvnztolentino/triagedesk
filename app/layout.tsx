import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { getActiveWorkspaceAccess, getClerkFapiOrigin, getCurrentUser, getSiteUrl } from "@/lib/auth";
import { formatDemoRemaining } from "@/lib/demo-ui";
import { countUnreadNotifications, listNotifications } from "@/lib/notifications";
import type { NotificationView } from "@/lib/schema";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const siteUrl = getSiteUrl();
const clerkFapiOrigin = getClerkFapiOrigin();
const siteTitle = "TriageDesk";
const siteDescription =
  "TriageDesk uses AI to read internal requests from staff, suggest a category, priority, and next action, then keeps an admin in the loop before anything becomes a tracked ticket.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s · ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    images: [{ url: "/icons/icon-512x512.png", width: 512, height: 512, alt: siteTitle }],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: ["/icons/icon-512x512.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

// Keeps the browser/app chrome monochrome instead of tinted. The manifest
// theme_color is static, so it tracks the dark default; this pair lets the
// mobile address bar follow the OS scheme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

// Applies the mode before paint so there is no flash of the wrong theme. A
// saved choice wins; otherwise the OS preference is used, and dark is the
// fallback when neither is available. The accent color is derived from the
// mode in globals.css.
const themeScript = `
(function () {
  var stored = null;
  try { stored = localStorage.getItem("triagedesk-theme"); } catch (_) {}
  var theme = "dark";
  if (stored === "light" || stored === "dark") {
    theme = stored;
  } else {
    try {
      if (window.matchMedia("(prefers-color-scheme: light)").matches) theme = "light";
    } catch (_) {}
  }
  document.documentElement.dataset.theme = theme;
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();
  const activeWorkspace = currentUser ? await getActiveWorkspaceAccess(currentUser.id) : undefined;
  const [notifications, unreadNotifications]: [NotificationView[], number] = currentUser && activeWorkspace
    ? await Promise.all([
        listNotifications(currentUser.id, activeWorkspace.workspace.id),
        countUnreadNotifications(currentUser.id, activeWorkspace.workspace.id),
      ])
    : [[], 0];

  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <head>
          {/* Warm the connection to Clerk's Frontend API before clerk.browser.js is
              discovered, so the OAuth return on /auth/callback isn't waiting on a
              cold DNS + TLS handshake to a third-party origin. */}
          {clerkFapiOrigin ? (
            <>
              <link rel="preconnect" href={clerkFapiOrigin} crossOrigin="anonymous" />
              <link rel="dns-prefetch" href={clerkFapiOrigin} />
            </>
          ) : null}
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className="font-sans bg-bg text-fg min-h-screen antialiased" suppressHydrationWarning>
          <AppLayout
            currentUser={currentUser}
            activeWorkspace={activeWorkspace ? {
              name: activeWorkspace.workspace.name,
              slug: activeWorkspace.workspace.slug,
              role: activeWorkspace.membership.role,
              isDemo: activeWorkspace.workspace.isDemo === true,
            } : null}
            // The countdown's first frame is rendered on the server so hydration has a
            // stable string to match; the banner's own interval takes over after mount.
            demo={currentUser?.isDemo ? {
              expiresAt: activeWorkspace?.workspace.expiresAt,
              remainingLabel: formatDemoRemaining(activeWorkspace?.workspace.expiresAt),
            } : null}
            notifications={notifications}
            unreadNotifications={unreadNotifications}
          >
            {children}
          </AppLayout>
        </body>
      </html>
    </ClerkProvider>
  );
}
