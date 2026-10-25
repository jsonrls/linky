import { describe, it, expect } from "vitest";
import {
  documentSchema,
  publicationError,
  publicationIssue,
  safeMediaUrl,
  safeUrl,
  handleSchema,
  type ProfileDocument,
} from "./model";
import { profileTemplates } from "./templates";
const document: ProfileDocument = {
  schemaVersion: 1,
  name: "Owner",
  bio: "",
  appearance: { theme: "warm", layout: "editorial", shape: "soft" },
  blocks: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      type: "text",
      visible: true,
      text: "Public text",
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      type: "link",
      visible: false,
      label: "",
      url: "",
    },
  ],
};
describe("publication validation", () => {
  it("permits hidden incomplete blocks, but rejects empty public content", () => {
    expect(publicationError(document)).toBeNull();
    expect(
      publicationError({
        ...document,
        blocks: document.blocks.map((block) => ({ ...block, visible: false })),
      }),
    ).toMatch(/at least one/);
  });
  it("rejects unknown fields and null enums", () => {
    expect(
      documentSchema.safeParse({ ...document, ownerEmail: "secret" }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({
        ...document,
        appearance: { ...document.appearance, theme: null },
      }).success,
    ).toBe(false);
  });
  it.each([
    "https://example.com",
    "http://127.0.0.1:3000/",
    "https://[2001:db8::1]:65535/a?q=b#c",
  ])("accepts allowed URL %s", (url) => expect(safeUrl(url)).toBe(true));
  it.each([
    "https://example.com:99999/",
    "https://%ZZ/",
    "https://[a]/",
    "https://user:pass@example.com",
    "javascript:alert(1)",
    "https://-example.com",
    "https://999.999.999.999",
    "https://example.com\\evil",
  ])("rejects unsafe or malformed URL %s", (url) =>
    expect(safeUrl(url)).toBe(false),
  );
  it("normalizes a handle and reserves platform handles", () => {
    expect(handleSchema.parse(" MY-PAGE ")).toBe("my-page");
    expect(handleSchema.safeParse("login").success).toBe(false);
  });
});

describe("template and media documents", () => {
  it.each([
    { name: "empty", value: "", invalid: false },
    { name: "ordinary spaces", value: "   ", invalid: false },
    { name: "tab", value: "\t", invalid: true },
    { name: "NBSP", value: "\u00a0", invalid: true },
  ])(
    "matches SQL optional-media blank handling for $name",
    ({ value, invalid }) => {
      for (const field of ["avatarUrl", "coverUrl", "imageUrl"] as const) {
        const link = {
          id: document.blocks[1].id,
          type: "link" as const,
          visible: true,
          label: "Work",
          url: "https://example.com",
          imageUrl: "",
        };
        const draft: ProfileDocument = {
          ...document,
          appearance: { ...document.appearance },
          blocks: [document.blocks[0], link],
        };
        if (field === "imageUrl") link.imageUrl = value;
        else draft.appearance[field] = value;
        expect(documentSchema.parse(draft)).toEqual(draft);
        const expectedField =
          field === "imageUrl"
            ? `image-${link.id}`
            : field === "avatarUrl"
              ? "avatar-url"
              : "cover-url";
        expect(publicationIssue(draft)?.field ?? null).toBe(
          invalid ? expectedField : null,
        );
        if (field === "imageUrl") {
          link.visible = false;
          expect(publicationIssue(draft)).toBeNull();
        }
      }
    },
  );

  it("preserves legacy documents without inserting optional fields", () => {
    expect(documentSchema.parse(document)).toEqual(document);
    for (const template of [
      "original",
      ...profileTemplates.map(({ id }) => id),
    ]) {
      const chosen = {
        ...document,
        appearance: { ...document.appearance, template },
      };
      expect(documentSchema.parse(chosen)).toEqual(chosen);
    }
  });

  it.each([
    { template: "unknown-template" },
    { template: null },
    { template: 1 },
    { avatarUrl: null },
    { coverUrl: [] },
    { avatarUrl: "x".repeat(2049) },
    { coverUrl: "x".repeat(2049) },
    { extra: "unknown" },
  ])("rejects invalid optional appearance data %j", (fields) => {
    expect(
      documentSchema.safeParse({
        ...document,
        appearance: { ...document.appearance, ...fields },
      }).success,
    ).toBe(false);
  });

  it("keeps incomplete media in drafts, but identifies each invalid publication field", () => {
    const draft: ProfileDocument = {
      ...document,
      appearance: {
        ...document.appearance,
        avatarUrl: "unfinished",
        coverUrl: "http://example.com/cover.jpg",
      },
      blocks: [
        {
          id: document.blocks[1].id,
          type: "link",
          visible: true,
          label: "Work",
          url: "https://example.com",
          imageUrl: "https://user:pass@example.com/image.jpg",
        },
      ],
    };
    expect(documentSchema.parse(draft)).toEqual(draft);
    expect(publicationIssue(draft)?.field).toBe("avatar-url");
    draft.appearance.avatarUrl = "";
    expect(publicationIssue(draft)?.field).toBe("cover-url");
    draft.appearance.coverUrl = "https://example.com/cover.jpg";
    expect(publicationIssue(draft)?.field).toBe(`image-${draft.blocks[0].id}`);
    if (draft.blocks[0].type !== "link")
      throw new Error("Expected link fixture");
    draft.blocks[0].imageUrl = "https://example.com/work.jpg";
    expect(publicationIssue(draft)).toBeNull();
  });

  it("accepts empty optional media and ignores incomplete hidden link images", () => {
    const draft = {
      ...document,
      appearance: { ...document.appearance, avatarUrl: "", coverUrl: " " },
      blocks: [
        document.blocks[0],
        { ...document.blocks[1], imageUrl: "unfinished" },
      ],
    };
    expect(documentSchema.parse(draft)).toEqual(draft);
    expect(publicationIssue(draft)).toBeNull();
  });

  it("limits link media to strings on link blocks with the same 2048 character draft limit", () => {
    for (const imageUrl of [null, 1, [], "x".repeat(2049)]) {
      expect(
        documentSchema.safeParse({
          ...document,
          blocks: [{ ...document.blocks[1], imageUrl }],
        }).success,
      ).toBe(false);
    }
    expect(
      documentSchema.safeParse({
        ...document,
        blocks: [{ ...document.blocks[0], imageUrl: "" }],
      }).success,
    ).toBe(false);
    const draft = {
      ...document,
      blocks: [{ ...document.blocks[1], imageUrl: "x".repeat(2048) }],
    };
    expect(documentSchema.parse(draft)).toEqual(draft);
  });

  it.each([
    ["https://example.com/image.png", true],
    ["HTTPS://example.com/image.png", true],
    ["http://example.com/image.png", false],
    ["https://user@example.com/image.png", false],
    ["https://example.com:99999/image.png", false],
    ["https://example.com\\image.png", false],
    ["", false],
  ])("allows only safe HTTPS media: %s", (url, safe) => {
    expect(safeMediaUrl(url as string)).toBe(safe);
  });
});
