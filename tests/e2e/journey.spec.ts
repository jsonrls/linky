import { test, expect } from "@playwright/test";
import {
  signIn,
  createProfile,
  openIdentity,
  addLink,
  saved,
  publish,
  removeOwner,
} from "./helpers";
test("real OTP, two independent profiles, shared preview, immutable publish and unpublish", async ({
  page,
  browser,
}, testInfo) => {
  const email = await signIn(page);
  try {
    const first = await createProfile(page);
    await addLink(page);
    await page.getByRole("button", { name: "Add text", exact: true }).click();
    await page.getByLabel("Text content").fill("A private hidden note");
    await page
      .getByRole("group", { name: "Block 2 actions" })
      .getByRole("button", { name: "Hide", exact: true })
      .click();
    await saved(page);
    await publish(page);
    const visitor = await browser.newContext();
    const publicPage = await visitor.newPage();
    let response = await publicPage.goto(`/@${first.handle}`);
    expect(response?.status()).toBe(200);
    await expect(
      publicPage.getByRole("heading", { name: "Public first", exact: true }),
    ).toBeVisible();
    expect(await publicPage.content()).not.toContain("A private hidden note");
    expect(await publicPage.content()).not.toContain("Private first");
    await expect(
      publicPage.getByRole("link", { name: /Selected work/ }),
    ).toHaveAttribute("href", "https://example.com/work");
    await openIdentity(page);
    await page.getByLabel("Public display name").fill("Private changed title");
    await saved(page);
    await publicPage.reload();
    await expect(
      publicPage.getByRole("heading", { name: "Public first", exact: true }),
    ).toBeVisible();
    expect(await publicPage.title()).toContain("Public first");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      if (width < 1024) {
        await page
          .getByRole("button", { name: "Private preview", exact: true })
          .click();
        await expect(
          page.getByRole("heading", {
            name: "Private changed title",
            exact: true,
          }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Edit", exact: true }).click();
      }
      await page.screenshot({
        path: testInfo.outputPath(`editor-${width}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("link", { name: "‹ Profiles", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Profiles", exact: true }),
    ).toBeVisible();
    const second = await createProfile(page, "second");
    await expect(page.getByLabel("Public display name")).toHaveValue(
      "Public second",
    );
    await page.getByRole("button", { name: "Add text", exact: true }).click();
    await page.getByLabel("Text content").fill("A separate second profile");
    await saved(page);
    await publish(page);
    await page.getByLabel("Editing a profile").selectOption(first.id);
    await page.waitForURL(`**/profiles/${first.id}/edit?**`);
    await page.waitForLoadState("load");
    await expect(page.getByLabel("Public display name")).toHaveValue(
      "Private changed title",
    );
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByLabel("Public handle")).toHaveAttribute(
      "readonly",
      "",
    );
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Keep editing", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Unpublish page", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    response = await publicPage.goto(`/@${first.handle}`);
    expect(response?.status()).toBe(404);
    await expect(
      publicPage.getByRole("heading", {
        name: "This page is unavailable",
        exact: true,
      }),
    ).toBeVisible();
    response = await publicPage.goto(`/@${second.handle}`);
    expect(response?.status()).toBe(200);
    await expect(
      publicPage.getByText("A separate second profile", { exact: true }),
    ).toBeVisible();
    await visitor.close();
  } finally {
    await removeOwner(email);
  }
});
