import type { Metadata } from "next";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { getActiveWorkspaceAccess, getCurrentUser } from "@/lib/auth";
import { isWorkspacePreview } from "@/lib/workspaces";

export const metadata: Metadata = {
  title: "TriageDesk",
  description: "AI internal operations helpdesk",
  manifest: "/site.webmanifest",
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
  var rawAccent = localStorage.getItem("triagedesk-accent") || "#7b787a";
  var legacy = { emerald: "#10b981", blue: "#3b82f6", orange: "#f97316", red: "#ef4444", violet: "#8b5cf6", yellow: "#eab308" };
  var accent = legacy[rawAccent] || (/^#[0-9a-f]{6}$/i.test(rawAccent) ? rawAccent : "#7b787a");
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = "custom";
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-strong", accent);
  document.documentElement.style.setProperty("--accent-text", accent);
  document.documentElement.style.setProperty("--accent-border", "color-mix(in srgb, " + accent + " 30%, transparent)");
} catch (_) {
  document.documentElement.dataset.theme = "dark";
  document.documentElement.dataset.accent = "custom";
}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();
  const activeWorkspace = currentUser ? await getActiveWorkspaceAccess(currentUser.id) : undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans bg-[#0a0a0a] text-neutral-200 min-h-screen" suppressHydrationWarning>
        <AppLayout
          currentUser={currentUser}
          activeWorkspace={activeWorkspace ? {
            name: activeWorkspace.workspace.name,
            slug: activeWorkspace.workspace.slug,
            role: activeWorkspace.membership.role,
            isPreview: isWorkspacePreview(activeWorkspace.workspace.id),
          } : null}
        >
          {children}
        </AppLayout>
      </body>
    </html>
  );
}
