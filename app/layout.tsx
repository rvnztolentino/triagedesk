import type { Metadata } from "next";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { getCurrentUser } from "@/lib/auth";

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
  var accent = localStorage.getItem("triagedesk-accent") || "emerald";
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
} catch (_) {
  document.documentElement.dataset.theme = "dark";
  document.documentElement.dataset.accent = "emerald";
}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans bg-[#0a0a0a] text-neutral-200 min-h-screen" suppressHydrationWarning>
        <AppLayout currentUser={currentUser}>{children}</AppLayout>
      </body>
    </html>
  );
}
