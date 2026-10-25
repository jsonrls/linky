import { test, expect } from "@playwright/test";
import { sessionOwner, createProfile, saved, removeOwner } from "./helpers";

test.beforeEach(({}, info) =>
  test.skip(
    info.project.name !== "chromium",
    "Focused interaction coverage runs in Chromium.",
  ),
);

test("publication validation reveals and focuses the invalid field; keyboard undo restores focus", async ({
  page,
}, info) => {
  const email = await sessionOwner(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await createProfile(page);
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await page.getByLabel("Link label", { exact: true }).selectOption("custom");
    await page.getByLabel("Custom label", { exact: true }).fill("Example");
    await page.getByLabel("Destination URL").fill("https://example.com:99999/");
    await saved(page);
    await page.locator(".block > summary").click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page
      .getByRole("button", { name: "Publish snapshot", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const invalid = page.getByLabel("Destination URL");
    await expect(invalid).toBeFocused();
    await expect(invalid).toHaveAttribute("aria-invalid", "true");
    const description = await invalid.getAttribute("aria-describedby");
    await expect(page.locator(`[id="${description}"]`)).toContainText(
      "valid host and port",
    );
    await page.screenshot({
      path: info.outputPath("editor-validation-390.png"),
      fullPage: true,
    });
    await invalid.fill("https://example.com/");
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Add link", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Undo removal", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".block > summary")).toBeFocused();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "restored at position 1 of 1" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    for (const name of [/Midnight navy/, /Concise/, /Square/]) {
      const radio = page.getByRole("radio", { name });
      await radio.focus();
      await page.keyboard.press("Space");
      await expect(radio).toBeChecked();
    }
    await saved(page);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Add link", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    for (const name of [/Midnight navy/, /Concise/, /Square/])
      await expect(page.getByRole("radio", { name })).toBeChecked();
  } finally {
    await removeOwner(email);
  }
});

test("dashboard Search and Enter retain the selected filter while filter switches retain the query", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  try {
    await createProfile(page);
    await page.getByRole("link", { name: "‹ Profiles", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Profiles", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Published", exact: true }).click();
    await expect(page).toHaveURL(/filter=published/);
    await page.getByLabel("Find a profile").fill("Private");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("filter"))
      .toBe("published");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"))
      .toBe("Private");
    await page.getByLabel("Find a profile").fill("first");
    await page.getByLabel("Find a profile").press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("filter"))
      .toBe("published");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"))
      .toBe("first");
    await page
      .getByRole("button", { name: "Not published", exact: true })
      .click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("filter"))
      .toBe("private");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"))
      .toBe("first");
    await expect(
      page.getByRole("heading", { name: "Private first", exact: true }),
    ).toBeVisible();
  } finally {
    await removeOwner(email);
  }
});
