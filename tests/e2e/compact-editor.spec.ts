import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import {
  sessionOwner,
  createProfile,
  openIdentity,
  openBlock,
  saved,
  removeOwner,
} from "./helpers";
const directory =
  process.env.LINKY_COMPACT_ARTIFACTS || "artifacts/compact-editor";

test.beforeEach(({}, info) =>
  test.skip(
    info.project.name !== "chromium",
    "Focused editor coverage runs in Chromium.",
  ),
);

async function seedBlocks(
  page: Page,
  id: string,
  count: number,
  name?: string,
) {
  await saved(page);
  const profile = await (await page.request.get(`/api/profiles/${id}`)).json();
  const response = await page.request.post(`/api/profiles/${id}/save`, {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      operationId: crypto.randomUUID(),
      expectedRevision: profile.revision,
      body: {
        label: profile.label,
        handle: profile.handle,
        document: {
          ...profile.document,
          name: name ?? profile.document.name,
          blocks: Array.from({ length: count }, (_, i) => ({
            id: crypto.randomUUID(),
            type: "link",
            label: `Link ${i + 1}`,
            url: "https://example.com",
            visible: true,
          })),
        },
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await page.reload();
  await expect(page.locator(".block")).toHaveCount(count);
  await expect(
    page.getByRole("button", { name: "Add link", exact: true }),
  ).toBeVisible();
}

async function clearOfToolbar(page: Page, field: Locator) {
  await expect(field).toBeFocused();
  const rect = await field.boundingBox();
  const toolbar = await page.locator(".content-toolbar").boundingBox();
  expect(rect!.y).toBeGreaterThanOrEqual(toolbar!.y + toolbar!.height + 3);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height - 3,
  );
}

for (const width of [1440, 390, 320]) {
  test(`compact ${width}: initial add, exclusive keyboard disclosures, sticky add twentieth and preserved editing`, async ({
    page,
  }) => {
    const email = await sessionOwner(page);
    try {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      const profile = await createProfile(page, "compact");
      await mkdir(directory, { recursive: true });
      const add = page.getByRole("button", { name: "Add link", exact: true });
      const initial = await add.evaluate((button) => ({
        addTop: button.getBoundingClientRect().top + scrollY,
      }));
      expect(
        (await add.boundingBox())!.y + (await add.boundingBox())!.height,
      ).toBeLessThan(page.viewportSize()!.height);
      await expect(page.locator(".identity-disclosure")).not.toHaveAttribute(
        "open",
      );
      await add.click();
      const firstUrl = page.getByLabel("Destination URL");
      await clearOfToolbar(page, firstUrl);
      const firstUrlTop = await firstUrl.evaluate(
        (field) => field.getBoundingClientRect().top + scrollY,
      );
      if (width >= 390)
        expect(firstUrlTop + 44).toBeLessThan(page.viewportSize()!.height);
      await firstUrl.fill("https://github.com/example");
      await expect(page.getByLabel("Link label", { exact: true })).toHaveValue(
        "GitHub",
      );
      await saved(page);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `${directory}/after-initial-${width}.png`,
      });

      await seedBlocks(page, profile.id, 20);
      const collapsedHeight = await page
        .locator(".block-list")
        .evaluate((list) => list.getBoundingClientRect().height);
      await seedBlocks(page, profile.id, 19);
      await expect(page.locator(".block[open]")).toHaveCount(0);
      await page.locator(".block").last().scrollIntoViewIfNeeded();
      expect(
        (await page.locator(".content-toolbar").boundingBox())!.y,
      ).toBeCloseTo(0, 0);
      await expect(add).toBeInViewport();
      await add.click();
      await expect(page.locator(".block")).toHaveCount(20);
      await expect(page.locator(".block[open]")).toHaveCount(1);
      const newest = page.locator(".block").last();
      const newestUrl = newest.getByLabel("Destination URL");
      await clearOfToolbar(page, newestUrl);
      const platformBounds = await newest
        .getByLabel("Link label", { exact: true })
        .boundingBox();
      const actionBounds = await newest.locator(".block-actions").boundingBox();
      expect(platformBounds!.y + platformBounds!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height,
      );
      expect(actionBounds!.y + actionBounds!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height,
      );
      await newestUrl.fill("https://instagram.com/example");
      await expect(
        newest.getByLabel("Link label", { exact: true }),
      ).toHaveValue("Instagram");
      await saved(page);
      await page.screenshot({
        path: `${directory}/after-twentieth-${width}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);

      const first = page.locator(".block").first();
      await first.locator(":scope > summary").focus();
      await page.keyboard.press("Enter");
      await expect(first).toHaveAttribute("open");
      await expect(newest).not.toHaveAttribute("open");
      const select = first.getByLabel("Link label", { exact: true });
      await select.selectOption("custom");
      await first
        .getByLabel("Custom label", { exact: true })
        .fill("Cached custom");
      await openBlock(page, 1);
      await openBlock(page);
      await expect(
        first.getByLabel("Custom label", { exact: true }),
      ).toHaveValue("Cached custom");
      const summaryId = await first
        .locator(":scope > summary")
        .getAttribute("id");
      await first
        .getByRole("button", { name: "Move down", exact: true })
        .click();
      const movedSummary = page.locator(`[id="${summaryId}"]`);
      await expect(movedSummary).toBeFocused();
      const moved = page.locator(".block").nth(1);
      await moved.getByRole("button", { name: "Remove", exact: true }).click();
      await expect(
        page.locator(".block").nth(1).locator(":scope > summary"),
      ).toBeFocused();
      await page
        .getByRole("button", { name: "Undo removal", exact: true })
        .click();
      await expect(movedSummary).toBeFocused();
      await page.keyboard.press("Space");
      await expect(moved).toHaveAttribute("open");
      await expect(
        moved.getByLabel("Custom label", { exact: true }),
      ).toHaveValue("Cached custom");
      await saved(page);
      await writeFile(
        `${directory}/after-measurements-${width}.json`,
        JSON.stringify(
          {
            width,
            ...initial,
            firstUrlTop,
            twentyBlockHeight: collapsedHeight,
            toolbarHeight: (await page
              .locator(".content-toolbar")
              .boundingBox())!.height,
          },
          null,
          2,
        ),
      );
    } finally {
      await removeOwner(email);
    }
  });
}

test("collapsed identity and block validation reveal fields and remain open through rerenders; cap stays visible", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const profile = await createProfile(page, "validation");
    await openIdentity(page);
    await page.getByLabel("Public display name").fill("");
    await page.locator(".identity-disclosure > summary").click();
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await page.getByLabel("Destination URL").fill("https://example.com");
    await page.locator(".block > summary").click();
    const attemptPublish = async () => {
      await saved(page);
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await page
        .getByRole("button", { name: "Publish snapshot", exact: true })
        .click();
    };
    await attemptPublish();
    const name = page.getByLabel("Public display name");
    await clearOfToolbar(page, name);
    await name.fill("Restored name");
    await saved(page);
    await expect(page.locator(".identity-disclosure")).toHaveAttribute("open");
    await attemptPublish();
    const select = page.getByLabel("Link label", { exact: true });
    await clearOfToolbar(page, select);
    await select.selectOption("custom");
    await page.getByLabel("Custom label", { exact: true }).fill("Custom work");
    await saved(page);
    await expect(page.locator(".block[open]")).toHaveCount(1);
    await seedBlocks(page, profile.id, 100);
    await expect(page.locator(".content-toolbar")).toContainText("100/100");
    await expect(
      page.getByRole("button", { name: "Add link", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Add text", exact: true }),
    ).toBeDisabled();
    await openBlock(page, 99);
    await page
      .getByRole("button", { name: "Remove", exact: true })
      .last()
      .click();
    await expect(page.locator(".content-toolbar")).toContainText("99/100");
    await expect(
      page.getByRole("button", { name: "Add link", exact: true }),
    ).toBeEnabled();
  } finally {
    await removeOwner(email);
  }
});
