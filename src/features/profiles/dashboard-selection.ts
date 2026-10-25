import type { ProfileSummary, PublishedProfile } from "./model";

export function selectDashboardProfiles(
  profiles: ProfileSummary[],
  query: string,
  filter: string,
  selected?: string,
) {
  const visible = profiles.filter(
    (profile) =>
      `${profile.label} ${profile.name} ${profile.handle}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "published"
        ? !!profile.publicationId
        : filter === "private"
          ? !profile.publicationId
          : true),
  );
  return {
    profiles: visible,
    selected:
      visible.find((profile) => profile.id === selected) ??
      visible.find((profile) => profile.publicationId) ??
      visible[0] ??
      null,
  };
}

export type PublishedPreview =
  | { status: "none" | "private" | "unavailable" | "error" | "changed" }
  | { status: "ready"; snapshot: PublishedProfile };

// The caller supplies only the selection resolved from visible, owned summaries.
export async function loadPublishedPreview(
  selected: ProfileSummary | null,
  read: (handle: string) => Promise<PublishedProfile | null>,
): Promise<PublishedPreview> {
  if (!selected) return { status: "none" };
  if (!selected.publicationId) return { status: "private" };
  try {
    const snapshot = await read(selected.handle);
    if (!snapshot) return { status: "unavailable" };
    if (snapshot.publicationId !== selected.publicationId)
      return { status: "changed" };
    return { status: "ready", snapshot };
  } catch {
    return { status: "error" };
  }
}
