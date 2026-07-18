import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { getActiveWorkspaceAccess, getCurrentUser, getSiteUrl } from "@/lib/auth";
import { isWorkspacePreview } from "@/lib/workspaces";
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

const themeScript = `
try {
  var theme = localStorage.getItem("triagedesk-theme") || "dark";
  var rawAccent = localStorage.getItem("triagedesk-accent") || "#879D5A";
  var legacy = { "#7b787a": "#879D5A", emerald: "#10b981", blue: "#3b82f6", orange: "#f97316", red: "#ef4444", violet: "#8b5cf6", yellow: "#eab308" };
  var accent = legacy[rawAccent] || (/^#[0-9a-f]{6}$/i.test(rawAccent) ? rawAccent : "#879D5A");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("--accent", accent);
} catch (_) {
  document.documentElement.dataset.theme = "dark";
}
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
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className="font-sans bg-bg text-fg min-h-screen antialiased" suppressHydrationWarning>
          <AppLayout
            currentUser={currentUser}
            activeWorkspace={activeWorkspace ? {
              name: activeWorkspace.workspace.name,
              slug: activeWorkspace.workspace.slug,
              role: activeWorkspace.membership.role,
              isPreview: isWorkspacePreview(activeWorkspace.workspace.id),
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
