import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaLink } from "react-icons/fa6";
import { LinkIcon, linkPlatform, linkPlatforms } from "./link-platforms";
import { ProfileRenderer } from "@/features/public-profile/ProfileRenderer";
import type { ProfileDocument } from "./model";

describe("link icons", () => {
  it("renders every curated packaged mark as a decorative SVG", () => {
    expect(linkPlatforms).toHaveLength(30);
    const labels = linkPlatforms.map(({ label }) => label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    const generic = renderToStaticMarkup(createElement(FaLink));
    for (const { label, Icon } of linkPlatforms) {
      const svg = renderToStaticMarkup(createElement(LinkIcon, { label }));
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
      expect(svg).toContain('width="22"');
      expect(svg).toContain("<path");
      expect(renderToStaticMarkup(createElement(Icon))).not.toBe(generic);
    }
  });

  it.each([
    "",
    "github",
    " GitHub",
    "GitHub ",
    "Twitter",
    "Selected work",
    "toString",
  ])("preserves arbitrary label %j and uses a generic icon", (label) => {
    expect(linkPlatform(label)).toBeUndefined();
    expect(renderToStaticMarkup(createElement(LinkIcon, { label }))).toBe(
      renderToStaticMarkup(createElement(LinkIcon, { label: "Custom" })),
    );
  });

  it("shares marks between preview and public output, excluding hidden blocks", () => {
    const document: ProfileDocument = {
      schemaVersion: 1,
      name: "Icon fixture",
      bio: "",
      appearance: { theme: "warm", layout: "editorial", shape: "soft" },
      blocks: [
        {
          id: "brand",
          type: "link",
          visible: true,
          label: "GitHub",
          url: "https://example.com/work",
        },
        {
          id: "custom",
          type: "link",
          visible: true,
          label: "Selected work",
          url: "https://example.com/custom",
        },
        {
          id: "hidden",
          type: "link",
          visible: false,
          label: "Hidden brand",
          url: "https://example.com/hidden",
        },
      ],
    };
    const preview = renderToStaticMarkup(
      createElement(ProfileRenderer, { document, preview: true }),
    );
    const live = renderToStaticMarkup(
      createElement(ProfileRenderer, { document }),
    );
    const icons = (html: string) => html.match(/<svg.*?<\/svg>/g);
    expect(icons(live)).toEqual(icons(preview));
    expect(icons(live)).toHaveLength(2);
    expect(live).toContain('href="https://example.com/work"');
    expect(preview).not.toContain("href=");
    expect(preview).toContain('aria-disabled="true"');
    expect(preview).toContain('tabindex="-1"');
    expect(live).toContain('class="link-label">Selected work');
    expect(live).not.toContain("Hidden brand");
    expect(live).not.toContain("link-number");
  });
});
