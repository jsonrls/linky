import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import cases from "../../../tests/fixtures/managed-avatars.json";
import { managedAvatar } from "./paths";
import {
  safeAvatarUrl,
  safeMediaUrl,
  publicationIssue,
  type ProfileDocument,
} from "@/features/profiles/model";
import { ProfileRenderer } from "@/features/public-profile/ProfileRenderer";
import { profileTemplates } from "@/features/profiles/templates";
const document: ProfileDocument = {
  schemaVersion: 1,
  name: "Photo fixture",
  bio: "",
  appearance: { theme: "warm", shape: "soft", layout: "editorial" },
  blocks: [
    { id: crypto.randomUUID(), type: "text", visible: true, text: "Work" },
  ],
};
it.each(cases)(
  "accepts only an exact managed avatar path: $url",
  ({ url, valid }) => {
    expect(!!managedAvatar(url)).toBe(valid);
    expect(safeAvatarUrl(url)).toBe(valid);
    expect(safeMediaUrl(url)).toBe(false);
    expect(
      publicationIssue({
        ...document,
        appearance: { ...document.appearance, avatarUrl: url },
      })?.field ?? null,
    ).toBe(valid ? null : "avatar-url");
    expect(
      publicationIssue({
        ...document,
        appearance: { ...document.appearance, coverUrl: url },
      })?.field,
    ).toBe("cover-url");
  },
);
it("renders managed avatars in every template while keeping cover and link media HTTPS only", () => {
  const url = cases[0].url;
  for (const template of [
    "original",
    ...profileTemplates.map(({ id }) => id),
  ]) {
    const html = renderToStaticMarkup(
      createElement(ProfileRenderer, {
        document: {
          ...document,
          appearance: {
            ...document.appearance,
            template,
            avatarUrl: url,
            coverUrl: url,
          },
          blocks: [
            {
              id: crypto.randomUUID(),
              type: "link",
              visible: true,
              label: "Work",
              url: "https://example.test",
              imageUrl: url,
            },
          ],
        } as ProfileDocument,
      }),
    );
    expect((html.match(/<img /g) ?? []).length, template).toBe(1);
    expect(html).toContain(`src="${url}"`);
  }
});
