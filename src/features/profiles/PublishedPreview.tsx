import { ProfileRenderer } from "@/features/public-profile/ProfileRenderer";
import type { PublishedPreview as PreviewState } from "./dashboard-selection";
import type { ProfileSummary } from "./model";

export function PublishedPreview({
  selected,
  preview,
  pending,
  onRefresh,
}: {
  selected: ProfileSummary | null;
  preview: PreviewState;
  pending: boolean;
  onRefresh: () => void;
}) {
  if (pending)
    return (
      <div className="desk-preview-state" role="status">
        Loading published preview…
      </div>
    );
  if (preview.status === "ready")
    return (
      <>
        {selected?.revision !== selected?.publishedRevision && (
          <p className="desk-private-note">Private edits are not shown here.</p>
        )}
        <div className="desk-published-document">
          <ProfileRenderer
            document={preview.snapshot.document}
            preview
            previewContext="published"
          />
        </div>
      </>
    );
  const messages = {
    none: [
      "No profile selected",
      "Choose a profile or adjust your search and filters.",
    ],
    private: [
      "No published page",
      "Publish this profile from the editor to see it here.",
    ],
    unavailable: [
      "Published preview unavailable",
      "This page may no longer be published.",
    ],
    error: [
      "Could not load the published preview.",
      "Your profiles are still available. Retry to load the published version.",
    ],
    changed: [
      "This publication changed.",
      "Refresh the preview to see the latest version.",
    ],
  };
  const [title, description] = messages[preview.status];
  return (
    <div
      className="desk-preview-state"
      role={preview.status === "error" ? "alert" : undefined}
    >
      <h3>{title}</h3>
      <p>{description}</p>
      {["unavailable", "error", "changed"].includes(preview.status) && (
        <button onClick={onRefresh}>
          {preview.status === "error" ? "Retry" : "Refresh preview"}
        </button>
      )}
    </div>
  );
}
