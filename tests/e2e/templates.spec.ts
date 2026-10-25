import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { sessionOwner, createProfile, removeOwner, saved } from "./helpers";
import { profileTemplates } from "../../src/features/profiles/templates";
import type {
  Profile,
  ProfileDocument,
} from "../../src/features/profiles/model";

test.beforeEach(({}, info) =>
  test.skip(
    info.project.name !== "chromium",
    "Template coverage runs in Chromium.",
  ),
);
const directory =
  process.env.LINKY_TEMPLATE_ARTIFACTS || "artifacts/template-review";
function fixture(): ProfileDocument {
  return {
    schemaVersion: 1,
    name: "Alex Rivera",
    bio: "Independent designer.\nMaking useful things for people and places.",
    appearance: { theme: "ink", layout: "editorial", shape: "soft" },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "link",
        visible: false,
        label: "Hidden first link",
        url: "https://example.com/hidden",
      },
      ...["Selected work", "Instagram", "Studio notes"].map((label) => ({
        id: crypto.randomUUID(),
        type: "link" as const,
        visible: true,
        label,
        url: "https://example.com/work",
      })),
      {
        id: crypto.randomUUID(),
        type: "text",
        visible: true,
        text: "A few things I’m working on.\nNew ideas, shared along the way.",
      },
      ...["YouTube", "Get in touch"].map((label) => ({
        id: crypto.randomUUID(),
        type: "link" as const,
        visible: true,
        label,
        url: "https://example.com/contact",
      })),
    ],
  };
}
async function saveDocument(page: Page, id: string, document: ProfileDocument) {
  const profile = (await (
    await page.request.get(`/api/profiles/${id}`)
  ).json()) as Profile;
  const response = await page.request.post(`/api/profiles/${id}/save`, {
    headers: { Origin: process.env.APP_ORIGIN! },
    data: {
      operationId: crypto.randomUUID(),
      expectedRevision: profile.revision,
      body: { label: profile.label, handle: profile.handle, document },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as Profile;
}
async function publishDocument(page: Page, profile: Profile) {
  const response = await page.request.post(
    `/api/profiles/${profile.id}/publish`,
    {
      headers: { Origin: process.env.APP_ORIGIN! },
      data: {
        operationId: crypto.randomUUID(),
        expectedRevision: profile.revision,
      },
    },
  );
  expect(response.ok(), await response.text()).toBe(true);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".template-profile")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
}

test("all twenty real layouts preserve order and render at mobile, desktop and narrow preview widths", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const email = await sessionOwner(page);
  try {
    const profile = await createProfile(page, "templates");
    const document = fixture();
    await mkdir(directory, { recursive: true });
    const live = await page.context().newPage();
    const contrasts: Array<{ template: string; minimum: number }> = [];
    for (const template of profileTemplates) {
      document.appearance.template = template.id;
      const saved = await saveDocument(page, profile.id, document);
      await publishDocument(page, saved);
      await live.setViewportSize({ width: 390, height: 844 });
      await live.goto(`/@${profile.handle}`);
      await live.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });
      await expect(live.locator(".template-surface")).toHaveAttribute(
        "data-template",
        template.id,
      );
      expect(
        await live
          .locator("[data-block-id]")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("data-block-id")),
          ),
      ).toEqual(
        document.blocks
          .filter((block) => block.visible)
          .map((block) => block.id),
      );
      await expect(live.locator(".template-link[href]")).toHaveCount(5);
      const contrast = await live
        .locator(
          ".template-name, .template-bio, .link-label, .template-text, .public-footnote",
        )
        .evaluateAll((nodes) => {
          function luminance(color: string) {
            const values = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((channel) => {
                const v = channel / 255;
                return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              });
            return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
          }
          return Math.min(
            ...nodes.map((node) => {
              let parent: Element | null = node;
              let background = "rgb(255, 255, 255)";
              while (parent) {
                const value = getComputedStyle(parent).backgroundColor;
                if (value !== "rgba(0, 0, 0, 0)" && value !== "transparent") {
                  background = value;
                  break;
                }
                parent = parent.parentElement;
              }
              const a = luminance(getComputedStyle(node).color),
                b = luminance(background);
              return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            }),
          );
        });
      expect(contrast, `${template.name} text contrast`).toBeGreaterThanOrEqual(
        4.5,
      );
      contrasts.push({
        template: template.id,
        minimum: Number(contrast.toFixed(2)),
      });
      await noOverflow(live);
      await live
        .locator(".template-surface")
        .screenshot({ path: `${directory}/${template.id}-390.png` });
      for (const width of [320, 1280]) {
        await live.setViewportSize({ width, height: 900 });
        await noOverflow(live);
        await live
          .locator(".template-surface")
          .screenshot({ path: `${directory}/${template.id}-${width}.png` });
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/app/profiles/${profile.id}/edit`);
      await expect(
        page.locator(".preview-frame .template-link[href]"),
      ).toHaveCount(0);
      await expect(page.locator(".preview-frame .template-link")).toHaveCount(
        5,
      );
      expect(
        await page
          .locator(".preview-frame .template-profile")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
    }
    await writeFile(
      `${directory}/contrast-results.json`,
      JSON.stringify(contrasts, null, 2),
    );
    await live.close();
  } finally {
    await removeOwner(email);
  }
});

test("picker keyboard, candidate cancellation and every selection preserve the complete draft", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const email = await sessionOwner(page);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    const profile = await createProfile(page, "picker");
    const document = fixture();
    document.appearance.avatarUrl = "https://media.example.test/avatar.png";
    document.appearance.coverUrl = "https://media.example.test/cover.png";
    const first = document.blocks[1];
    if (first.type === "link")
      first.imageUrl = "https://media.example.test/link.png";
    await page.route("https://media.example.test/**", (route) => route.abort());
    await saveDocument(page, profile.id, document);
    await page.reload();
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Change template" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Choose a template" });
    await expect(page.getByLabel("Search templates")).toBeFocused();
    await expect(dialog.getByRole("radio")).toHaveCount(21);
    await dialog
      .getByRole("radio", { name: "Original Example design", exact: true })
      .focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      dialog.getByRole("radio", {
        name: "Electric Index Example design",
        exact: true,
      }),
    ).toBeChecked();
    await expect(
      dialog.locator(".candidate-frame .public-surface"),
    ).toHaveAttribute("data-template", "electric-index");
    await expect(dialog.locator(".candidate-frame a[href]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(
      page.locator(".preview-frame .public-surface"),
    ).toHaveAttribute("data-template", "original");
    await trigger.click();
    await page.getByLabel("Search templates").fill("not-a-template");
    await expect(dialog.getByText(/No matching templates/)).toBeVisible();
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await page.screenshot({ path: `${directory}/picker-empty-search.png` });
    await dialog.getByRole("button", { name: "Clear search" }).click();
    await page.getByLabel("Search templates").fill("lavender");
    await expect(dialog.getByRole("radio")).toHaveCount(1);
    await dialog.getByRole("radio").check();
    await page.screenshot({ path: `${directory}/picker-candidate.png` });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(trigger).toBeFocused();
    for (const template of [
      ...profileTemplates,
      { id: "original", name: "Original" },
    ]) {
      await trigger.click();
      await page.getByLabel("Search templates").fill(template.name);
      await dialog
        .getByRole("radio", {
          name: `${template.name} Example design`,
          exact: true,
        })
        .check();
      await dialog.getByRole("button", { name: "Use template" }).click();
      await expect(trigger).toBeFocused();
      await saved(page);
      const stored = (await (
        await page.request.get(`/api/profiles/${profile.id}`)
      ).json()) as Profile;
      expect(stored.document).toEqual({
        ...document,
        appearance: { ...document.appearance, template: template.id },
      });
      await expect(
        page.locator(".preview-frame .public-surface"),
      ).toHaveAttribute("data-template", template.id);
      if (template.id !== "original")
        await expect(
          page.getByText("Color theme", { exact: true }),
        ).toHaveCount(0);
    }
    await page.reload();
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await expect(
      page.getByRole("radio", { name: /Midnight navy/ }),
    ).toBeChecked();
    await trigger.click();
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await page.screenshot({
      path: `${directory}/picker-desktop.png`,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${directory}/picker-mobile.png`,
    });
    await expect(
      dialog.getByRole("button", { name: "Use template" }),
    ).toBeInViewport();
  } finally {
    await removeOwner(email);
  }
});

test("media fields reveal on publish errors; browser failures collapse layouts; publishing isolates media", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const email = await sessionOwner(page);
  const image =
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#d5a776"/><circle cx="160" cy="120" r="100" fill="#345565"/><path d="M0 320 480 100v220" fill="#243e34"/></svg>';
  await page
    .context()
    .route("https://media.example.test/**", (route) =>
      route.request().url().includes("broken")
        ? route.abort()
        : route.fulfill({ contentType: "image/svg+xml", body: image }),
    );
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    const profile = await createProfile(page, "media");
    const document = fixture();
    document.appearance.template = "soft-motion";
    document.appearance.avatarUrl = "http://insecure.example.test/a.png";
    await saveDocument(page, profile.id, document);
    await page.reload();
    async function attempt() {
      await saved(page);
      await page.getByRole("button", { name: /^Publish( changes)?$/ }).click();
      await page.getByRole("button", { name: "Publish snapshot" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await attempt();
    await expect(page.locator("#avatar-url")).toBeFocused();
    await expect(page.locator("#avatar-url")).toHaveAttribute(
      "aria-describedby",
      /profile-photo-error/,
    );
    await page.getByText("Use an image URL instead", { exact: true }).click();
    await expect(
      page.getByLabel("Avatar URL", { exact: true }),
    ).toHaveAttribute("aria-invalid", "true");
    await page
      .getByLabel("Avatar URL", { exact: true })
      .fill("https://media.example.test/avatar.png");
    await page.getByRole("button", { name: "Apply URL", exact: true }).click();
    await page
      .getByLabel("Cover URL", { exact: true })
      .fill("https://media.example.test/cover.png");
    await expect(page.locator(".media-field-preview img")).toHaveCount(1);
    await expect(page.locator(".profile-photo-thumbnail img")).toHaveCount(1);
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.locator(".block").nth(1).locator(":scope > summary").click();
    await page
      .locator(".block")
      .nth(1)
      .getByText("Link image (optional)", { exact: true })
      .click();
    await page
      .locator(".block")
      .nth(1)
      .getByLabel("Link image URL")
      .fill("https://");
    await page.locator(".block").nth(1).locator("summary").first().click();
    await attempt();
    await expect(
      page.locator(".block").nth(1).getByLabel("Link image URL"),
    ).toBeFocused();
    await expect(
      page.locator(".block").nth(1).getByLabel("Link image URL"),
    ).toHaveAttribute("aria-invalid", "true");
    await page
      .locator(".block")
      .nth(1)
      .getByLabel("Link image URL")
      .fill("https://media.example.test/broken.png");
    await expect(
      page.getByText("Could not load image", { exact: true }),
    ).toBeVisible();
    await page
      .locator(".block")
      .nth(1)
      .getByLabel("Link image URL")
      .fill("https://media.example.test/link.png");
    await saved(page);
    const stored = (await (
      await page.request.get(`/api/profiles/${profile.id}`)
    ).json()) as Profile;
    await publishDocument(page, stored);
    const live = await page.context().newPage();
    await live.setViewportSize({ width: 390, height: 844 });
    await live.goto(`/@${profile.handle}`);
    await expect(live.locator(".template-profile img")).toHaveCount(3);
    await live.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await live
      .locator(".template-surface")
      .screenshot({ path: `${directory}/media-soft-motion.png` });
    const updated = structuredClone(stored.document);
    updated.appearance.avatarUrl = "https://media.example.test/changed.png";
    updated.appearance.template = "night-shift";
    await saveDocument(page, profile.id, updated);
    await live.reload();
    await expect(live.locator(".template-surface")).toHaveAttribute(
      "data-template",
      "soft-motion",
    );
    await expect(live.locator(".template-avatar")).toHaveAttribute(
      "src",
      "https://media.example.test/avatar.png",
    );
    for (const template of [
      "contact-sheet",
      "screening-room",
      "objects-and-hands",
      "coastal-assembly",
    ] as const) {
      const withMedia = structuredClone(stored.document);
      withMedia.appearance.template = template;
      const savedMedia = await saveDocument(page, profile.id, withMedia);
      await publishDocument(page, savedMedia);
      await live.goto(`/@${profile.handle}`);
      await live.locator(".public-footnote").scrollIntoViewIfNeeded();
      await expect(live.locator(".template-profile img")).toHaveCount(3);
      await live.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });
      await live
        .locator(".template-surface")
        .screenshot({ path: `${directory}/media-${template}.png` });
    }
    for (const template of [
      "soft-motion",
      "route-postcard",
      "objects-and-hands",
      "distance-club",
    ] as const) {
      const broken = structuredClone(stored.document);
      broken.bio = "";
      broken.appearance = {
        ...broken.appearance,
        template,
        avatarUrl: "https://media.example.test/broken-avatar.png",
        coverUrl: "https://media.example.test/broken-cover.png",
      };
      broken.blocks = broken.blocks.map((block) =>
        block.type === "link"
          ? { ...block, imageUrl: "https://media.example.test/broken-link.png" }
          : block,
      );
      const savedBroken = await saveDocument(page, profile.id, broken);
      await publishDocument(page, savedBroken);
      await live.goto(`/@${profile.handle}`);
      await live.locator(".public-footnote").scrollIntoViewIfNeeded();
      await expect(live.locator(".template-profile img")).toHaveCount(0);
      for (const selector of [".postcard", ".objects-images", ".club-poster"]) {
        if (await live.locator(selector).count())
          await expect(live.locator(selector)).toBeHidden();
      }
      await noOverflow(live);
      await live.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });
      await live
        .locator(".template-surface")
        .screenshot({ path: `${directory}/broken-${template}.png` });
    }
    await live.close();
  } finally {
    await removeOwner(email);
  }
});

test("long content, compact square shapes and hundred-block drafts remain readable", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const email = await sessionOwner(page);
  try {
    const profile = await createProfile(page, "long");
    const document = fixture();
    document.name =
      "Alexandra Rivera and the Independent Design Studio Working Across Places Together".slice(
        0,
        80,
      );
    document.bio =
      "A long biography with line breaks.\n" +
      "Making useful things for people and places. ".repeat(6).slice(0, 260);
    document.appearance.layout = "compact";
    document.appearance.shape = "square";
    document.blocks = Array.from({ length: 100 }, (_, index) =>
      index % 5 === 4
        ? {
            id: crypto.randomUUID(),
            type: "text" as const,
            visible: true,
            text:
              "Text breaks the grid.\n" +
              "Long text stays readable. ".repeat(20),
          }
        : {
            id: crypto.randomUUID(),
            type: "link" as const,
            visible: true,
            label:
              "A long descriptive link label that should wrap rather than disappear or overlap any other content in this layout",
            url: "https://example.com",
          },
    );
    for (const template of profileTemplates) {
      document.appearance.template = template.id;
      await saveDocument(page, profile.id, document);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/app/profiles/${profile.id}/edit`);
      const preview = page.locator(".preview-frame");
      await expect(preview.locator("[data-block-id]")).toHaveCount(100);
      expect(
        await preview
          .locator(".template-profile")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      const current = (await (
        await page.request.get(`/api/profiles/${profile.id}`)
      ).json()) as Profile;
      await publishDocument(page, current);
      const live = await page.context().newPage();
      await live.goto(`/@${profile.handle}`);
      for (const width of [320, 390, 1280]) {
        await live.setViewportSize({ width, height: 900 });
        await noOverflow(live);
        if (
          [
            "studio-index",
            "cobalt-objects",
            "coastal-assembly",
            "contact-sheet",
          ].includes(template.id)
        ) {
          await live.addStyleTag({
            content: "nextjs-portal { display: none !important; }",
          });
          await live.screenshot({
            path: `${directory}/long-${template.id}-${width}.png`,
          });
        }
        await expect(live.locator("h1")).toHaveText(document.name);
      }
      if (template.id === "studio-index") {
        expect(
          await live
            .locator("h1")
            .evaluate((element) => getComputedStyle(element).writingMode),
        ).toBe("horizontal-tb");
        await live.addStyleTag({
          content: "nextjs-portal { display: none !important; }",
        });
        await live.screenshot({
          path: `${directory}/studio-long-name-wide.png`,
        });
      }
      await live.close();
    }
  } finally {
    await removeOwner(email);
  }
});

test("failed image retries after removal and after another URL succeeds", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  let failA = true;
  const a = "https://media.example.test/retry-a.png";
  const b = "https://media.example.test/retry-b.png";
  await page.route("https://media.example.test/**", (route) =>
    route.request().url().startsWith(a) && failA
      ? route.abort()
      : route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="navy"/></svg>',
        }),
  );
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await createProfile(page, "retry");
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await page.getByText("Profile images (optional)", { exact: true }).click();
    await page.getByText("Use an image URL instead", { exact: true }).click();
    const input = page.getByLabel("Avatar URL", { exact: true });
    const apply = page.getByRole("button", { name: "Apply URL", exact: true });
    const avatar = page.locator(".preview-frame .original-avatar");
    await input.fill(a);
    await apply.click();
    await expect(page.getByText("Could not load image")).toBeVisible();
    await expect(avatar).toHaveCount(0);
    await page
      .getByRole("button", { name: "Remove photo", exact: true })
      .click();
    failA = false;
    await input.fill(a);
    await apply.click();
    await expect(avatar).toHaveAttribute("src", a);
    await expect(avatar).toBeVisible();
    await page
      .getByRole("button", { name: "Remove photo", exact: true })
      .click();
    failA = true;
    const secondA = `${a}?case=aba`;
    await input.fill(secondA);
    await apply.click();
    await expect(page.getByText("Could not load image")).toBeVisible();
    await input.fill(b);
    await apply.click();
    await expect(avatar).toHaveAttribute("src", b);
    failA = false;
    await input.fill(secondA);
    await apply.click();
    await expect(avatar).toHaveAttribute("src", secondA);
    await expect
      .poll(() =>
        avatar.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBe(80);
    await saved(page);
  } finally {
    await removeOwner(email);
  }
});

test("review crops show long grid labels and the narrow Coastal preview", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    const profile = await createProfile(page, "regions");
    const document = fixture();
    document.appearance.template = "coastal-assembly";
    await saveDocument(page, profile.id, document);
    await page.reload();
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await page
      .locator(".preview-frame")
      .screenshot({ path: `${directory}/coastal-narrow-preview.png` });
    document.blocks = document.blocks.map((block) =>
      block.type === "link"
        ? {
            ...block,
            label:
              "A long descriptive link label that should wrap rather than disappear or overlap any other content in this layout",
          }
        : block,
    );
    const live = await page.context().newPage();
    for (const template of ["cobalt-objects", "coastal-assembly"] as const) {
      document.appearance.template = template;
      const current = await saveDocument(page, profile.id, document);
      await publishDocument(page, current);
      await live.goto(`/@${profile.handle}`);
      await live.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });
      for (const width of [390, 1280]) {
        await live.setViewportSize({ width, height: 900 });
        const group = live.locator(".template-link-group").first();
        await group.scrollIntoViewIfNeeded();
        expect(
          await group
            .locator(".link-label")
            .evaluateAll((nodes) =>
              nodes.every(
                (node) =>
                  node.scrollWidth <= node.clientWidth &&
                  node.scrollHeight <= node.clientHeight,
              ),
            ),
        ).toBe(true);
        await group.screenshot({
          path: `${directory}/long-links-${template}-${width}.png`,
        });
      }
    }
    await live.close();
  } finally {
    await removeOwner(email);
  }
});
