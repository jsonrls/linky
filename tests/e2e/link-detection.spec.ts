import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  sessionOwner,
  createProfile,
  openBlock,
  saved,
  publish,
  removeOwner,
} from "./helpers";
const directory =
  process.env.LINKY_DETECTION_ARTIFACTS || "artifacts/link-detection";

test.beforeEach(({}, info) =>
  test.skip(
    info.project.name !== "chromium",
    "Focused detection coverage runs in Chromium.",
  ),
);

async function pasteUrl(page: Page, field: Locator, value: string) {
  await page.evaluate((text) => navigator.clipboard.writeText(text), value);
  await field.focus();
  await field.press("ControlOrMeta+A");
  await field.press("ControlOrMeta+V");
  await expect(field).toHaveValue(value);
  await expect(field).toBeFocused();
}

test("clipboard detection follows automatic choices, preserves explicit labels, and survives save/publication", async ({
  page,
  context,
  browser,
}) => {
  const email = await sessionOwner(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const visitor = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const profile = await createProfile(page, "detect");
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    const block = page.locator(".block").first();
    const select = block.getByLabel("Link label", { exact: true });
    const url = block.getByLabel("Destination URL");
    await expect(url).toBeFocused();
    await expect(select).toHaveValue("");
    await url.press("Tab");
    await expect(select).toBeFocused();
    const raw = "https://WWW.INSTAGRAM.COM/person?from=clipboard#bio";
    await pasteUrl(page, url, raw);
    await expect(select).toHaveValue("Instagram");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Instagram selected from the URL" }),
    ).toBeVisible();
    await pasteUrl(page, url, "https://youtu.be/example");
    await expect(select).toHaveValue("YouTube");
    for (const invalid of [
      "https://example.com/work",
      "https://",
      "http://instagram.com.evil.com",
      "https://instagram.com@evil.com",
    ]) {
      await pasteUrl(page, url, "https://github.com/person");
      await expect(select).toHaveValue("GitHub");
      await url.fill(invalid);
      await expect(url).toBeFocused();
      await expect(select).toHaveValue("");
    }
    await pasteUrl(page, url, "https://t.me/person");
    await expect(select).toHaveValue("Telegram");
    await select.selectOption("custom");
    const custom = block.getByLabel("Custom label", { exact: true });
    await expect(custom).toHaveValue("");
    await pasteUrl(page, url, "https://instagram.com/person");
    await expect(select).toHaveValue("custom");
    await expect(custom).toHaveValue("");
    await custom.fill("GitHub");
    await pasteUrl(page, url, "https://youtu.be/example");
    await expect(select).toHaveValue("custom");
    await expect(custom).toHaveValue("GitHub");
    await select.selectOption("LINE");
    await pasteUrl(page, url, "https://wa.me/123");
    await expect(select).toHaveValue("LINE");
    await url.fill("invalid");
    await expect(select).toHaveValue("LINE");
    await url.fill("https://example.com/manual");

    await page.getByRole("button", { name: "Add link", exact: true }).click();
    const automatic = page.locator(".block").nth(1);
    const automaticSelect = automatic.getByLabel("Link label", { exact: true });
    const automaticUrl = automatic.getByLabel("Destination URL");
    await expect(automaticUrl).toBeFocused();
    await pasteUrl(page, automaticUrl, "https://github.com/person");
    await automatic.getByRole("button", { name: "Hide", exact: true }).click();
    await expect(page.locator(".preview-frame .public-link")).toHaveCount(1);
    await automatic.getByRole("button", { name: "Show", exact: true }).click();
    await automatic
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Undo removal", exact: true })
      .click();
    await openBlock(page, 1);
    await pasteUrl(page, automaticUrl, "https://youtu.be/example");
    await expect(automaticSelect).toHaveValue("YouTube");
    await saved(page);
    await mkdir(directory, { recursive: true });
    await page.screenshot({
      path: `${directory}/editor-url-first.png`,
      fullPage: true,
    });
    await page.reload();
    await openBlock(page, 1);
    await expect(automaticSelect).toBeVisible();
    await expect(automaticSelect).toHaveValue("YouTube");
    await pasteUrl(page, automaticUrl, "https://instagram.com/person");
    await expect(automaticSelect).toHaveValue("YouTube");
    await saved(page);
    await publish(page);
    const live = await visitor.newPage();
    await live.goto(`/@${profile.handle}`);
    const publicLink = live.getByRole("link", { name: "YouTube", exact: true });
    await expect(publicLink).toHaveAttribute(
      "href",
      "https://instagram.com/person",
    );
    expect(await publicLink.locator("svg").innerHTML()).toBe(
      await automatic.locator("summary svg").innerHTML(),
    );
    await live.screenshot({
      path: `${directory}/public-detected-390.png`,
      fullPage: true,
    });
  } finally {
    await visitor.close();
    await removeOwner(email);
  }
});

test("saved empty labels are eligible but explicit empty Custom stays protected until reload", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  try {
    await createProfile(page, "empty");
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    const select = page.getByLabel("Link label", { exact: true });
    const url = page.getByLabel("Destination URL");
    await select.selectOption("custom");
    await url.fill("https://example.com/unfinished");
    await saved(page);
    await url.fill("https://instagram.com/person");
    await expect(select).toHaveValue("custom");
    await saved(page);
    await page.reload();
    await openBlock(page);
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("custom");
    await url.fill("https://wa.me/123");
    await expect(select).toHaveValue("WhatsApp");
    await saved(page);
  } finally {
    await removeOwner(email);
  }
});

test("conflict discard clears automatic ownership", async ({ page }) => {
  const email = await sessionOwner(page);
  try {
    await createProfile(page, "reset");
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    const select = page.getByLabel("Link label", { exact: true });
    const url = page.getByLabel("Destination URL");
    await url.fill("https://github.com/person");
    await expect(select).toHaveValue("GitHub");
    await saved(page);
    const other = await page.context().newPage();
    await other.goto(page.url());
    await openBlock(other);
    await other.getByLabel("Link label", { exact: true }).selectOption("LINE");
    await saved(other);
    await url.fill("https://youtu.be/example");
    await expect(select).toHaveValue("YouTube");
    await page
      .getByRole("button", { name: "Reload latest draft", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Discard & reload", exact: true })
      .click();
    await expect(select).toHaveValue("LINE");
    await url.fill("https://instagram.com/person");
    await expect(select).toHaveValue("LINE");
    await saved(page);
    await other.close();
  } finally {
    await removeOwner(email);
  }
});
