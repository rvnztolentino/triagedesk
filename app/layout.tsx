import type { Metadata } from "next";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "TriageDesk",
  description: "AI internal operations helpdesk",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="en">
      <body className="font-sans bg-[#0a0a0a] text-neutral-200 selection:bg-emerald-500 selection:text-black min-h-screen" suppressHydrationWarning>
        <AppLayout currentUser={currentUser}>{children}</AppLayout>
      </body>
    </html>
  );
}
