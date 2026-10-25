import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { sessionOwner, removeOwner } from "./helpers";
import type {
  Profile,
  ProfileDocument,
} from "../../src/features/profiles/model";

const directory = "artifacts/profile-desk";
test.beforeEach(({}, info) =>
  test.skip(
    info.project.name !== "chromium",
    "Focused Profile Desk coverage runs in Chromium.",
  ),
);

async function mutation(page: Page, path: string, data: object) {
  const response = await page.request.post(path, {
    headers: { Origin: new URL(page.url()).origin },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as Profile;
}
async function create(page: Page, label: string, name: string) {
  return mutation(page, "/api/profiles", {
    operationId: crypto.randomUUID(),
    body: { label, name, handle: `desk-${crypto.randomUUID().slice(0, 8)}` },
  });
}
async function save(page: Page, profile: Profile, document: ProfileDocument) {
  return mutation(page, `/api/profiles/${profile.id}/save`, {
    operationId: crypto.randomUUID(),
    expectedRevision: profile.revision,
    body: { label: profile.label, handle: profile.handle, document },
  });
}
async function fixture(page: Page) {
  const studio = await create(page, "Review studio", "Review Studio");
  const document: ProfileDocument = {
    schemaVersion: 1,
    name: "Review Studio",
    bio: "A local test of private drafts and published pages.",
    appearance: { theme: "warm", layout: "editorial", shape: "soft" },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "link",
        label: "Example website",
        url: "https://example.com",
        visible: true,
      },
    ],
  };
  let current = await save(page, studio, document);
  await mutation(page, `/api/profiles/${studio.id}/publish`, {
    operationId: crypto.randomUUID(),
    expectedRevision: current.revision,
  });
  current = (await (
    await page.request.get(`/api/profiles/${studio.id}`)
  ).json()) as Profile;
  await save(page, current, {
    ...document,
    name: "Review Studio Private Revision",
    bio: "PRIVATE biography must never appear in published preview",
    appearance: {
      ...document.appearance,
      template: "night-shift",
      theme: "ink",
      avatarUrl: "https://media.example.test/private-avatar.png",
    },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "text",
        visible: true,
        text: "PRIVATE text must never appear in published preview",
      },
    ],
  });
  const journal = await create(page, "Review journal", "Review Journal");
  await page.goto("/app/profiles");
  return { studio, journal, document };
}
async function capture(page: Page, name: string) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.screenshot({
    path: `${directory}/${name}.png`,
    fullPage: false,
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("published snapshot isolation, owned selection, filters, history and edit/back", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  await mkdir(directory, { recursive: true });
  try {
    await page.setViewportSize({ width: 1440, height: 1058 });
    await expect(
      page.getByRole("button", { name: "Create your first profile" }),
    ).toBeVisible();
    await capture(page, "dashboard-empty-1440");
    const { studio, journal } = await fixture(page);
    const pane = page.getByRole("complementary", { name: "Published preview" });
    await expect(page.locator(".profile-row h2")).toHaveText([
      "Review journal",
      "Review studio",
    ]);
    await expect(
      page.getByRole("button", { name: "Selected: Review studio" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      pane.getByRole("heading", { name: "Review Studio", exact: true }),
    ).toBeVisible();
    await expect(pane).toContainText(
      "A local test of private drafts and published pages.",
    );
    await expect(pane.locator(".public-surface")).toHaveAttribute(
      "data-template",
      "original",
    );
    await expect(pane.locator("a[href]")).toHaveCount(0);
    await expect(pane.locator("img")).toHaveCount(0);
    await expect(pane).not.toContainText("PRIVATE");
    await expect(pane).not.toContainText("Private Revision");
    await expect(pane).toContainText("Private edits are not shown here.");
    await expect(page.locator(".usage")).toHaveText(
      "1 of 2 published profiles",
    );
    await expect(page.locator(".profile-row").last()).toContainText("UTC");
    await noOverflow(page);
    await capture(page, "dashboard-1440");
    console.log(`STABLE DESIGN CAPTURE: ${directory}/dashboard-1440.png`);

    await page.getByRole("button", { name: "Preview: Review journal" }).click();
    await expect(
      page.getByRole("button", { name: "Selected: Review journal" }),
    ).toBeFocused();
    await expect(pane).toContainText("No published page");
    await expect(pane.locator(".public-surface")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`selected=${journal.id}`));
    await page.goBack();
    await expect(
      pane.getByRole("heading", { name: "Review Studio", exact: true }),
    ).toBeVisible();
    await page.goForward();
    await expect(pane).toContainText("No published page");

    await page.getByRole("button", { name: "Published", exact: true }).click();
    await expect(page.locator(".profile-row")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Selected: Review studio" }),
    ).toBeVisible();
    await expect(
      pane.getByRole("heading", { name: "Review Studio", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Find a profile").fill("studio");
    await page.getByLabel("Find a profile").press("Enter");
    await expect(page).toHaveURL(/q=studio/);
    await page.getByRole("link", { name: "Edit profile", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Add link", exact: true }),
    ).toBeEnabled();
    await page.getByRole("link", { name: "‹ Profiles", exact: true }).click();
    const back = new URL(page.url()).searchParams;
    expect(back.get("selected")).toBe(studio.id);
    expect(back.get("filter")).toBe("published");
    expect(back.get("q")).toBe("studio");
    await expect(
      pane.getByRole("heading", { name: "Review Studio", exact: true }),
    ).toBeVisible();

    await page.goto("/app/profiles?selected=not-owned");
    await expect(
      page.getByRole("button", { name: "Selected: Review studio" }),
    ).toBeVisible();
    await page.goto(`/app/profiles?filter=private&selected=${studio.id}`);
    await expect(
      page.getByRole("button", { name: "Selected: Review journal" }),
    ).toBeVisible();
    await expect(pane).toContainText("No published page");
    await expect(page.locator(".usage")).toHaveText(
      "1 of 2 published profiles",
    );
    await page.getByLabel("Find a profile").fill("no-matches");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "No matching profiles" }),
    ).toBeVisible();
    await expect(pane).toContainText("No profile selected");
    await expect(pane.locator(".public-surface")).toHaveCount(0);
    await capture(page, "dashboard-no-results-1440");
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(
      page.getByRole("button", { name: "Selected: Review studio" }),
    ).toBeVisible();

    // A newer label must never be displayed over the previous snapshot during a slow response.
    await page.getByLabel("Find a profile").fill("Review");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=Review/);
    await expect(page.locator(".profile-desk")).toHaveAttribute(
      "data-enhanced",
      "true",
    );
    await expect(
      pane.getByRole("heading", { name: "Review Studio", exact: true }),
    ).toBeVisible();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/app/profiles?**", async (route) => {
      await held;
      await route.continue();
    });
    try {
      await page
        .getByRole("button", { name: "Preview: Review journal" })
        .click();
      await expect(pane).toContainText("Loading published preview…");
      await expect(pane.locator(".public-surface")).toHaveCount(0);
    } finally {
      release();
    }
    await expect(pane).toContainText("No published page");
    await page.unroute("**/app/profiles?**");
    const live = await page.context().newPage();
    await live.goto(`/@${studio.handle}`);
    await expect(
      live.getByRole("heading", { name: "Review Studio", exact: true }),
    ).toBeVisible();
    await expect(
      live.getByRole("link", { name: /Example website/ }),
    ).toHaveAttribute("href", "https://example.com");
    await live.close();
  } finally {
    await removeOwner(email);
  }
});

test("mobile sheet opens only on request and restores exact trigger and scroll across selection and resize", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  await mkdir(directory, { recursive: true });
  try {
    const { journal } = await fixture(page);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/app/profiles");
      await expect(
        page.getByRole("button", { name: "Selected: Review studio" }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await noOverflow(page);
      await capture(page, `dashboard-${width}`);
      const trigger = page.getByRole("button", {
        name: "Preview: Review journal",
      });
      await trigger.scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => scrollY);
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Published preview" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("No published page");
      await expect(
        dialog.getByRole("button", { name: "Close dialog" }),
      ).toBeFocused();
      await noOverflow(page);
      await capture(page, `preview-private-${width}`);
      await page.keyboard.press("Escape");
      const selected = page.getByRole("button", {
        name: "Selected: Review journal",
      });
      await expect(selected).toBeFocused();
      expect(await page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
      await page
        .getByRole("button", { name: "Preview: Review studio" })
        .click();
      await expect(
        dialog.getByRole("heading", { name: "Review Studio", exact: true }),
      ).toBeVisible();
      await capture(page, `preview-published-${width}`);
      await dialog.getByRole("button", { name: "Close dialog" }).click();
      await expect(
        page.getByRole("button", { name: "Selected: Review studio" }),
      ).toBeFocused();
      const toggle = page.getByRole("button", {
        name: "Show published preview",
      });
      await toggle.click();
      await expect(dialog).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole("complementary", { name: "Published preview" }),
      ).toBeVisible();
      await expect(page.locator(".desk-published-document")).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: "Selected: Review studio" }),
      ).toBeFocused();
      await page.setViewportSize({ width, height: 844 });
      await expect(dialog).toHaveCount(0);
      await page
        .getByRole("button", { name: "Selected: Review studio" })
        .click();
      await expect(dialog).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Selected: Review studio" }),
      ).toBeFocused();
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/app/profiles?filter=private&selected=${journal.id}`);
      await expect(dialog).toHaveCount(0);
      await page.getByLabel("Find a profile").fill("absent");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(toggle).toBeDisabled();
      await expect(dialog).toHaveCount(0);
    }
    await writeFile(
      `${directory}/mobile-checks.json`,
      JSON.stringify(
        {
          widths: [390, 320],
          focus: "exact row trigger",
          close: ["Escape", "Close"],
          resize: "modal closes at 1100px; no reopen on shrinking",
          horizontalOverflow: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await removeOwner(email);
  }
});

test("whole-app chrome captures with existing auth, editor, creation, publish and recovery behavior", async ({
  page,
}) => {
  test.setTimeout(120000);
  await mkdir(directory, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto("/login");
    await capture(page, `login-${width}`);
    await page.evaluate(() => {
      sessionStorage.setItem("linky-otp-email", "review-owner@linky.test");
      sessionStorage.setItem("linky-otp-until", String(Date.now() + 60000));
    });
    await page.goto("/auth/verify");
    await expect(page.getByLabel("Sign-in code")).toBeVisible();
    await capture(page, `verify-${width}`);
  }
  const email = await sessionOwner(page);
  try {
    const { studio } = await fixture(page);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto("/app/profiles");
      await page
        .getByRole("button", { name: "Create profile", exact: true })
        .click();
      await capture(page, `create-${width}`);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.goto(`/app/profiles/${studio.id}/edit`);
      await expect(
        page.getByRole("button", { name: "Add link", exact: true }),
      ).toBeEnabled();
      await capture(page, `content-${width}`);
      await page
        .getByRole("button", { name: "Appearance", exact: true })
        .click();
      await capture(page, `appearance-${width}`);
      await page.getByRole("button", { name: "Change template" }).click();
      await expect(page.getByRole("dialog").getByRole("radio")).toHaveCount(21);
      await capture(page, `templates-${width}`);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await capture(page, `settings-${width}`);
      await page
        .getByRole("button", { name: "Publish changes", exact: true })
        .click();
      await capture(page, `publish-${width}`);
      await page
        .getByRole("button", { name: "Keep editing", exact: true })
        .click();
      await page.getByRole("button", { name: "Content", exact: true }).click();
      // A real revision conflict exercises the existing recovery entry point.
      const other = (await (
        await page.request.get(`/api/profiles/${studio.id}`)
      ).json()) as Profile;
      await save(page, other, {
        ...other.document,
        bio: `Saved in another tab at ${width}px`,
      });
      await page.locator(".identity-disclosure > summary").click();
      await page.getByLabel("Bio").fill(`Retained local work at ${width}px`);
      await page.getByRole("button", { name: "Reload latest draft" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(page, `recovery-${width}`);
      await page
        .getByRole("button", { name: "Keep editing", exact: true })
        .click();
      await page.getByRole("button", { name: "Reload latest draft" }).click();
      await page
        .getByRole("button", { name: "Discard & reload", exact: true })
        .click();
      await noOverflow(page);
    }
  } finally {
    await removeOwner(email);
  }
});

test("all-private default, published template/media isolation and plain GET fallback", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  await mkdir(directory, { recursive: true });
  const mediaRequests: string[] = [];
  await page.route("https://media.example.test/**", async (route) => {
    mediaRequests.push(route.request().url());
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="navy"/></svg>',
    });
  });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    const privateProfile = await create(
      page,
      "Private-only desk",
      "Private-only name",
    );
    await page.goto("/app/profiles");
    const pane = page.getByRole("complementary", { name: "Published preview" });
    await expect(
      page.getByRole("button", { name: "Selected: Private-only desk" }),
    ).toBeVisible();
    await expect(pane).toContainText("No published page");
    const profile = await create(
      page,
      "Published media desk",
      "Published identity",
    );
    const document: ProfileDocument = {
      schemaVersion: 1,
      name: "Published identity",
      bio: "Published media biography",
      appearance: {
        theme: "warm",
        layout: "compact",
        shape: "square",
        template: "soft-motion",
        avatarUrl: "https://media.example.test/published-avatar.png",
        coverUrl: "https://media.example.test/published-cover.png",
      },
      blocks: [
        {
          id: crypto.randomUUID(),
          type: "link",
          label: "Published destination",
          url: "https://example.com/published",
          imageUrl: "https://media.example.test/published-link.png",
          visible: true,
        },
      ],
    };
    let current = await save(page, profile, document);
    await mutation(page, `/api/profiles/${profile.id}/publish`, {
      operationId: crypto.randomUUID(),
      expectedRevision: current.revision,
    });
    current = (await (
      await page.request.get(`/api/profiles/${profile.id}`)
    ).json()) as Profile;
    await save(page, current, {
      ...document,
      name: "Private changed identity",
      bio: "Private changed biography",
      appearance: {
        ...document.appearance,
        template: "night-shift",
        avatarUrl: "https://media.example.test/private-avatar.png",
        coverUrl: "https://media.example.test/private-cover.png",
      },
      blocks: [
        {
          ...document.blocks[0],
          label: "Private destination",
          imageUrl: "https://media.example.test/private-link.png",
        },
      ],
    } as ProfileDocument);
    await page.goto("/app/profiles");
    await expect(pane.locator(".public-surface")).toHaveAttribute(
      "data-template",
      "soft-motion",
    );
    await expect(pane.locator(".public-surface")).toHaveClass(/compact square/);
    await expect(
      pane.getByRole("heading", { name: "Published identity", exact: true }),
    ).toBeVisible();
    await expect(pane).toContainText("Published media biography");
    await expect(pane.locator("img")).toHaveCount(3);
    await expect
      .poll(() =>
        pane
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    const imageSources = await pane
      .locator("img")
      .evaluateAll((images) =>
        images.map((image) => image.getAttribute("src")),
      );
    expect(imageSources).toEqual(
      expect.arrayContaining([
        document.appearance.avatarUrl,
        document.appearance.coverUrl,
        "https://media.example.test/published-link.png",
      ]),
    );
    await expect(pane).not.toContainText("Private changed");
    await expect(pane.locator("a[href]")).toHaveCount(0);
    expect([...new Set(mediaRequests)].sort()).toEqual(
      [
        document.appearance.avatarUrl,
        document.appearance.coverUrl,
        "https://media.example.test/published-link.png",
      ].sort(),
    );
    await capture(page, "published-media-1440");

    // Bypass React's delegated submit handler to exercise the native GET form.
    await page.evaluate(() =>
      window.document.addEventListener(
        "submit",
        (event) => event.stopImmediatePropagation(),
        true,
      ),
    );
    await page
      .getByRole("button", { name: "Preview: Private-only desk" })
      .click();
    await expect(page).toHaveURL(new RegExp(`selected=${privateProfile.id}`));
    await expect(
      page.getByRole("complementary", { name: "Published preview" }),
    ).toContainText("No published page");
  } finally {
    await removeOwner(email);
  }
});
