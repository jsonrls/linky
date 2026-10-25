import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  loadPublishedPreview,
  selectDashboardProfiles,
} from "./dashboard-selection";
import { PublishedPreview } from "./PublishedPreview";
import type { ProfileSummary, PublishedProfile } from "./model";

const draft: ProfileSummary = {
  id: "draft",
  label: "Private work",
  name: "Private name",
  handle: "private-work",
  publicationId: null,
  firstPublishedAt: null,
  publishedRevision: null,
  revision: 5,
  updatedAt: "2026-10-24T10:00:00Z",
};
const published: ProfileSummary = {
  ...draft,
  id: "published",
  label: "Owner-only studio",
  handle: "public-studio",
  publicationId: "snapshot-1",
  firstPublishedAt: "2026-10-24T00:00:00Z",
  publishedRevision: 2,
};
const snapshot: PublishedProfile = {
  handle: published.handle,
  publicationId: "snapshot-1",
  document: {
    schemaVersion: 1,
    name: "Published name",
    bio: "Published bio",
    appearance: {
      theme: "ink",
      layout: "compact",
      shape: "square",
      template: "soft-motion",
      avatarUrl: "https://example.com/published.png",
    },
    blocks: [
      {
        id: "link",
        type: "link",
        label: "Published link",
        visible: true,
        url: "https://example.com/live",
      },
    ],
  },
};

describe("dashboard selection", () => {
  it("preserves order and prefers a visible published default, then the first private row", () => {
    const rows = [draft, published, { ...published, id: "older" }];
    expect(selectDashboardProfiles(rows, "", "all")).toEqual({
      profiles: rows,
      selected: published,
    });
    expect(selectDashboardProfiles(rows, "", "private").selected).toBe(draft);
    expect(selectDashboardProfiles(rows, "", "all", draft.id).selected).toBe(
      draft,
    );
  });
  it("resolves unknown, stale and filtered selections only within visible owned rows", () => {
    for (const id of [undefined, "other-owner", "deleted"])
      expect(
        selectDashboardProfiles([draft, published], "", "all", id).selected,
      ).toBe(published);
    expect(
      selectDashboardProfiles(
        [draft, published],
        "Private work",
        "all",
        published.id,
      ).selected,
    ).toBe(draft);
    expect(
      selectDashboardProfiles(
        [draft, published],
        "OWNER-ONLY",
        "published",
        draft.id,
      ).selected,
    ).toBe(published);
    expect(
      selectDashboardProfiles(
        [draft, published],
        "no matches",
        "all",
        published.id,
      ),
    ).toEqual({ profiles: [], selected: null });
    expect(selectDashboardProfiles([], "", "all").selected).toBeNull();
  });
});

describe("published preview boundary", () => {
  it("never reads private, unpublished or empty selections", async () => {
    const read = vi.fn();
    expect(await loadPublishedPreview(null, read)).toEqual({ status: "none" });
    for (const selected of [
      draft,
      { ...draft, firstPublishedAt: "2026-01-01" },
    ])
      expect(await loadPublishedPreview(selected, read)).toEqual({
        status: "private",
      });
    expect(read).not.toHaveBeenCalled();
  });
  it("reads the selected owned handle and returns only the matching immutable snapshot", async () => {
    const read = vi.fn().mockResolvedValue(snapshot);
    const result = await loadPublishedPreview(published, read);
    expect(read).toHaveBeenCalledExactlyOnceWith(published.handle);
    expect(result).toEqual({ status: "ready", snapshot });
    const html = renderToStaticMarkup(
      createElement(PublishedPreview, {
        selected: published,
        preview: result,
        pending: false,
        onRefresh() {},
      }),
    );
    expect(html).toContain("Published name");
    expect(html).toContain("Published link");
    expect(html).toContain("published.png");
    expect(html).toContain('data-template="soft-motion"');
    expect(html).not.toContain(published.label);
    expect(html).not.toContain(published.name);
    expect(html).not.toContain("href=");
  });
  it("keeps null, errors and changed publications local without exposing content", async () => {
    const cases = [
      [vi.fn().mockResolvedValue(null), "unavailable", "Refresh preview"],
      [
        vi.fn().mockRejectedValue(new Error("private service detail")),
        "error",
        "Retry",
      ],
      [
        vi.fn().mockResolvedValue({ ...snapshot, publicationId: "newer" }),
        "changed",
        "Refresh preview",
      ],
    ] as const;
    for (const [read, status, action] of cases) {
      const preview = await loadPublishedPreview(published, read);
      expect(preview).toEqual({ status });
      const html = renderToStaticMarkup(
        createElement(PublishedPreview, {
          selected: published,
          preview,
          pending: false,
          onRefresh() {},
        }),
      );
      expect(html).toContain(action);
      expect(html).not.toContain("Published name");
      expect(html).not.toContain("private service detail");
    }
  });
  it("removes the prior snapshot while navigation is pending", () => {
    const html = renderToStaticMarkup(
      createElement(PublishedPreview, {
        selected: published,
        preview: { status: "ready", snapshot },
        pending: true,
        onRefresh() {},
      }),
    );
    expect(html).toContain("Loading published preview…");
    expect(html).not.toContain("Published name");
  });
});
