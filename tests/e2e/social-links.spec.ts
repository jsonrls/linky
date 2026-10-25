import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  sessionOwner,
  createProfile,
  openIdentity,
  openBlock,
  addLink,
  saved,
  publish,
  removeOwner,
} from "./helpers";
const directory =
  process.env.LINKY_SOCIAL_ARTIFACTS || "artifacts/social-links";

test.beforeEach(({}, info) =>
  test.skip(
    info.project.name !== "chromium",
    "Focused social link coverage runs in Chromium.",
  ),
);

async function attemptPublish(page: Page) {
  await saved(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish snapshot", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("platforms and existing custom links save, reload and publish matching local SVGs", async ({
  page,
  browser,
}) => {
  const email = await sessionOwner(page);
  const visitor = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const profile = await createProfile(page, "social");
    await openIdentity(page);
    await page
      .getByLabel("Public display name")
      .fill("Social links test profile");
    await addLink(page);
    await page.reload();
    await openBlock(page);
    const first = page.locator(".block").first();
    const select = first.getByLabel("Link label", { exact: true });
    await expect(select).toBeVisible();
    await expect(select).toBeEnabled();
    await expect(select).toHaveValue("custom");
    await expect(first.getByLabel("Custom label", { exact: true })).toHaveValue(
      "Selected work",
    );
    const options = await select.locator("option").allTextContents();
    expect(options[0].trim()).toBe("Choose a platform");
    expect(options.at(-1)).toBe("Custom");
    const platforms = options.slice(1, -1).map((label) => label.trim());
    expect(platforms).toHaveLength(30);
    expect(platforms).toEqual(
      [...platforms].sort((a, b) => a.localeCompare(b)),
    );
    for (const label of platforms) {
      await select.selectOption(label);
      await expect(first.getByLabel("Destination URL")).toHaveValue(
        "https://example.com/work",
      );
      await expect(first.locator("summary svg")).toHaveCount(1);
    }
    await select.selectOption("GitHub");
    await saved(page);
    await page.reload();
    await openBlock(page);
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("GitHub");
    await expect(first.getByLabel("Custom label", { exact: true })).toHaveCount(
      0,
    );
    await mkdir(directory, { recursive: true });
    await page.screenshot({
      path: `${directory}/editor-platforms.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: "Add link", exact: true }).click();
    const custom = page.locator(".block").nth(1);
    const customSelect = custom.getByLabel("Link label", { exact: true });
    await expect(custom.getByLabel("Destination URL")).toBeFocused();
    await expect(customSelect).toHaveValue("");
    await customSelect.selectOption("custom");
    const customLabel = custom.getByLabel("Custom label", { exact: true });
    await expect(customLabel).toHaveAttribute("maxlength", "120");
    await customLabel.fill("Instagram");
    await custom
      .getByLabel("Destination URL")
      .fill("https://example.com/custom");
    await saved(page);
    await expect(customSelect).toHaveValue("custom");
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await openBlock(page, 1);
    await expect(customSelect).toHaveValue("custom");
    await customSelect.selectOption("YouTube");
    await customSelect.selectOption("custom");
    await expect(customLabel).toHaveValue("Instagram");
    await customLabel.fill(
      "Selected work with a long label that wraps on mobile and remains fully readable",
    );
    await customSelect.selectOption("Bluesky");
    await customSelect.selectOption("custom");
    await expect(customLabel).toHaveValue(
      "Selected work with a long label that wraps on mobile and remains fully readable",
    );
    await expect(custom.getByLabel("Destination URL")).toHaveValue(
      "https://example.com/custom",
    );
    await saved(page);
    await page.screenshot({
      path: `${directory}/editor-custom.png`,
      fullPage: true,
    });
    await page.reload();
    await openBlock(page, 1);
    await expect(customSelect).toBeVisible();
    await expect(customSelect).toHaveValue("custom");
    await expect(customLabel).toHaveValue(
      "Selected work with a long label that wraps on mobile and remains fully readable",
    );

    for (const label of ["Kick", "Substack", "YouTube"]) {
      await page.getByRole("button", { name: "Add link", exact: true }).click();
      const block = page.locator(".block").last();
      await block.getByLabel("Link label", { exact: true }).selectOption(label);
      await block
        .getByLabel("Destination URL")
        .fill(`https://example.com/${label}`);
    }
    await saved(page);
    const preview = page.locator(".preview-frame");
    await expect(preview.locator(".public-link")).toHaveCount(5);
    await expect(preview.locator(".public-link[href]")).toHaveCount(0);
    await publish(page);
    const live = await visitor.newPage();
    expect((await live.goto(`/@${profile.handle}`))?.status()).toBe(200);
    const icons = (target: Page, selector: string) =>
      target
        .locator(`${selector} .link-icon`)
        .evaluateAll((svgs) => svgs.map((svg) => svg.innerHTML));
    expect(await icons(live, ".public-links")).toEqual(
      await icons(page, ".preview-frame .public-links"),
    );
    await expect(
      live.getByRole("link", { name: "GitHub", exact: true }),
    ).toHaveAttribute("href", "https://example.com/work");
    await expect(
      live.locator("svg[aria-hidden=true][focusable=false]"),
    ).toHaveCount(5);
    await live.screenshot({
      path: `${directory}/public-social-390.png`,
      fullPage: true,
    });
    for (const width of [320, 390, 768]) {
      await live.setViewportSize({ width, height: 844 });
      expect(
        await live.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  } finally {
    await visitor.close();
    await removeOwner(email);
  }
});

test("blank choice and empty Custom focus visible controls; hide and undo retain Custom mode and cache", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await createProfile(page);
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    const select = page.getByLabel("Link label", { exact: true });
    await expect(page.getByLabel("Destination URL")).toBeFocused();
    await page.getByLabel("Destination URL").fill("https://example.com/");
    await page.locator(".block > summary").click();
    await attemptPublish(page);
    await expect(select).toBeFocused();
    await expect(select).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".field-error[role=alert]")).toHaveText(
      "Choose a platform or Custom for this visible link.",
    );
    await select.selectOption("custom");
    const label = page.getByLabel("Custom label", { exact: true });
    await saved(page);
    await page.reload();
    await openBlock(page);
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("custom");
    await expect(label).toHaveValue("");
    await page.locator(".block > summary").click();
    await attemptPublish(page);
    await expect(label).toBeFocused();
    await expect(label).toHaveAttribute("aria-invalid", "true");
    await label.fill("Instagram");
    await saved(page);
    await page.getByRole("button", { name: "Hide", exact: true }).click();
    await page
      .getByRole("button", { name: "Private preview", exact: true })
      .click();
    await expect(page.locator(".preview-frame .public-link")).toHaveCount(0);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Show", exact: true }).click();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Add link", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Undo removal", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".block > summary")).toBeFocused();
    await openBlock(page);
    await expect(select).toHaveValue("custom");
    await expect(label).toHaveValue("Instagram");
    await select.selectOption("GitHub");
    await select.selectOption("custom");
    await expect(label).toHaveValue("Instagram");
    await saved(page);
    await page.reload();
    await openBlock(page);
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("Instagram");
  } finally {
    await removeOwner(email);
  }
});

for (const latest of ["YouTube", "Latest saved custom"]) {
  test(`conflict discard clears local Custom cache and uses ${latest}`, async ({
    page,
  }) => {
    const email = await sessionOwner(page);
    try {
      await createProfile(page);
      await addLink(page);
      const second = await page.context().newPage();
      await second.goto(page.url());
      await openBlock(second);
      const select = second.getByLabel("Link label", { exact: true });
      await expect(select).toBeEnabled();
      if (latest === "YouTube")
        await page
          .getByLabel("Link label", { exact: true })
          .selectOption(latest);
      else await page.getByLabel("Custom label", { exact: true }).fill(latest);
      await saved(page);
      await second
        .getByLabel("Custom label", { exact: true })
        .fill("Discarded local custom text");
      await expect(
        second.getByRole("button", {
          name: "Reload latest draft",
          exact: true,
        }),
      ).toBeVisible();
      await second
        .getByRole("button", { name: "Reload latest draft", exact: true })
        .click();
      await second
        .getByRole("button", { name: "Discard & reload", exact: true })
        .click();
      await expect(select).toHaveValue(
        latest === "YouTube" ? latest : "custom",
      );
      await select.selectOption("custom");
      await expect(
        second.getByLabel("Custom label", { exact: true }),
      ).toHaveValue(latest === "YouTube" ? "" : latest);
      await expect(second.getByLabel("Destination URL")).toHaveValue(
        "https://example.com/work",
      );
      await second.close();
    } finally {
      await removeOwner(email);
    }
  });
}

test("discarding a conflicting removal clears undo after restoring the saved block", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  try {
    await createProfile(page);
    await addLink(page);
    const second = await page.context().newPage();
    await second.goto(page.url());
    await openBlock(second);
    await expect(
      second.getByLabel("Custom label", { exact: true }),
    ).toBeEnabled();
    await openIdentity(page);
    await page.getByLabel("Bio").fill("Winning revision");
    await saved(page);
    await second.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(
      second.getByRole("button", { name: "Undo removal", exact: true }),
    ).toBeVisible();
    await expect(
      second.getByRole("button", { name: "Reload latest draft", exact: true }),
    ).toBeVisible();
    await second
      .getByRole("button", { name: "Reload latest draft", exact: true })
      .click();
    await second
      .getByRole("button", { name: "Discard & reload", exact: true })
      .click();
    await expect(second.locator(".block")).toHaveCount(1);
    await expect(
      second.getByRole("button", { name: "Undo removal", exact: true }),
    ).toHaveCount(0);
    await expect(
      second.getByLabel("Custom label", { exact: true }),
    ).toHaveValue("Selected work");
    await second.close();
  } finally {
    await removeOwner(email);
  }
});
