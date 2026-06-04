import { SettingsPageView } from "@/app/settings/page";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettings({ params, searchParams }: { params: Promise<{ workspaceSlug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { workspaceSlug } = await params;
  return <SettingsPageView searchParams={searchParams} workspaceSlug={workspaceSlug} />;
}
