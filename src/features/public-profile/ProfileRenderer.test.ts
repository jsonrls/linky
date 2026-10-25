import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileRenderer } from "./ProfileRenderer";
import { ProfileMedia } from "./ProfileMedia";
import { profileTemplates } from "@/features/profiles/templates";
import type { ProfileDocument } from "@/features/profiles/model";

const base: ProfileDocument = {
  schemaVersion: 1,
  name: "A real name",
  bio: "Line one\nLine two",
  appearance: { theme: "ink", shape: "soft", layout: "editorial" },
  blocks: [],
};
const link = (index: number) => ({
  id: `link-${index}`,
  type: "link" as const,
  visible: true,
  label: `Link ${index}`,
  url: `https://example.com/${index}`,
});
describe("shared public renderer", () => {
  for (const { id } of profileTemplates) {
    it(`${id} preserves visible content and text boundaries for 0, 1, 2, 20 and 100 blocks`, () => {
      for (const count of [0, 1, 2, 20, 100]) {
        const blocks = Array.from({ length: count }, (_, index) =>
          index % 4 === 3
            ? {
                id: `text-${index}`,
                type: "text" as const,
                visible: true,
                text: `Text ${index}\nSecond line`,
              }
            : { ...link(index), visible: index !== 0 },
        );
        const document = {
          ...base,
          appearance: { ...base.appearance, template: id },
          blocks,
        };
        const before = JSON.stringify(document);
        const html = renderToStaticMarkup(
          createElement(ProfileRenderer, { document }),
        );
        const ids = [...html.matchAll(/data-block-id="([^"]+)"/g)].map(
          (match) => match[1],
        );
        expect(ids).toEqual(
          blocks.filter((block) => block.visible).map((block) => block.id),
        );
        expect(html).not.toContain('data-block-id="link-0"');
        expect(html).not.toContain("/templates/");
        expect(JSON.stringify(document)).toBe(before);
      }
    });
  }
  it("uses Original for absent and unknown templates without changing the document", () => {
    for (const template of [undefined, "original", "future-template"]) {
      const document = {
        ...base,
        appearance: { ...base.appearance, template },
      } as ProfileDocument;
      const html = renderToStaticMarkup(
        createElement(ProfileRenderer, { document }),
      );
      expect(html).toContain('data-template="original"');
      expect(html).toContain("theme-ink");
      expect(html).toContain('class="public-profile"');
      expect(document.appearance.template).toBe(template);
    }
  });
  it("disables preview destinations and unsafe draft URLs", () => {
    const document = {
      ...base,
      blocks: [link(1), { ...link(2), url: "javascript:alert(1)" }],
    };
    const preview = renderToStaticMarkup(
      createElement(ProfileRenderer, { document, preview: true }),
    );
    expect(preview).not.toContain("href=");
    const live = renderToStaticMarkup(
      createElement(ProfileRenderer, { document }),
    );
    expect(live).toContain('href="https://example.com/1"');
    expect(live).not.toContain("javascript:");
  });
  it("distinguishes published, private and live contexts without changing appearance", () => {
    for (const template of [
      undefined,
      ...profileTemplates.map(({ id }) => id),
    ]) {
      const document: ProfileDocument = {
        ...base,
        appearance: {
          ...base.appearance,
          template,
          layout: "compact",
          shape: "square",
        },
      };
      const desk = renderToStaticMarkup(
        createElement(ProfileRenderer, {
          document,
          preview: true,
          previewContext: "published",
        }),
      );
      expect(desk).toContain("Published preview. Links are disabled.");
      expect(desk).toContain("No links or text in this published version.");
      expect(desk).not.toContain("Private draft");
      expect(desk).not.toContain("Add or show");
      expect(desk).toContain("compact square");
      const editor = renderToStaticMarkup(
        createElement(ProfileRenderer, { document, preview: true }),
      );
      expect(editor).toContain("Private draft preview. Links are disabled.");
      expect(editor).toContain("Add or show a content block to begin.");
      const live = renderToStaticMarkup(
        createElement(ProfileRenderer, { document }),
      );
      expect(live).toContain("Made with Linky");
      expect(live).not.toContain("preview. Links");
      expect(live).not.toContain("No links or text");
    }
  });
  it("only renders safe HTTPS media using native browser images with no referrer", () => {
    for (const url of [
      undefined,
      "",
      "http://example.com/a.png",
      "https://user:pass@example.com/a.png",
      "data:image/png;base64,x",
      "https://",
      "\thttps://example.com/a.png",
    ]) {
      expect(renderToStaticMarkup(createElement(ProfileMedia, { url }))).toBe(
        "",
      );
    }
    const html = renderToStaticMarkup(
      createElement(ProfileMedia, { url: "https://example.com/a.png" }),
    );
    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain('alt=""');
    expect(html).not.toContain("/_next/image");
  });
});

it("Night Shift falls back to the avatar for absent, empty or space-only covers", () => {
  for (const coverUrl of [
    undefined,
    "",
    "   ",
    "https://example.com/cover.png",
  ]) {
    const document: ProfileDocument = {
      ...base,
      appearance: {
        ...base.appearance,
        template: "night-shift",
        avatarUrl: "https://example.com/avatar.png",
        coverUrl,
      },
    };
    const html = renderToStaticMarkup(
      createElement(ProfileRenderer, { document }),
    );
    expect(html).toContain(
      `src="${coverUrl?.startsWith("https:") ? coverUrl : "https://example.com/avatar.png"}"`,
    );
  }
});
