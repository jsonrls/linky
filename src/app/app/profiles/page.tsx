import { workspace } from "@/features/auth/server";
import { Dashboard } from "@/features/profiles/Dashboard";
import { readPublicProfile } from "@/features/profiles/server";
import {
  loadPublishedPreview,
  selectDashboardProfiles,
} from "@/features/profiles/dashboard-selection";
export const metadata = { title: "Profiles" };
export default async function Profiles({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; selected?: string }>;
}) {
  const [{ workspace: data }, query] = await Promise.all([
    workspace(),
    searchParams,
  ]);
  const search = typeof query.q === "string" ? query.q : "";
  const filter = ["all", "published", "private"].includes(query.filter || "")
    ? query.filter!
    : "all";
  const selection = selectDashboardProfiles(
    data.profiles,
    search,
    filter,
    query.selected,
  );
  const preview = await loadPublishedPreview(
    selection.selected,
    readPublicProfile,
  );
  return (
    <Dashboard
      workspace={data}
      query={search}
      filter={filter}
      selectedId={selection.selected?.id}
      preview={preview}
    />
  );
}
