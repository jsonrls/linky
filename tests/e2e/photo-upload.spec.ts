import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  addLink,
  createProfile,
  openIdentity,
  publish,
  removeOwner,
  saved,
  sessionOwner,
} from "./helpers";
import type { Profile } from "../../src/features/profiles/model";

const directory = "artifacts/photo-crop/upload-regression";
const origin = process.env.APP_ORIGIN!;
const headers = { Origin: origin, "Content-Type": "image/png" };
const fixture = async (color = "#27446b") => ({
  name: "photo.png",
  mimeType: "image/png",
  buffer: await sharp({
    create: { width: 120, height: 80, channels: 3, background: color },
  })
    .png()
    .toBuffer(),
});
async function appearance(page: Page) {
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  const disclosure = page.locator("details").filter({
    has: page.getByText("Profile images (optional)", { exact: true }),
  });
  if ((await disclosure.getAttribute("open")) === null)
    await disclosure.locator(":scope > summary").click();
}
async function upload(page: Page, id: string, color?: string) {
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/profiles/${id}/photo`) &&
      response.request().method() === "POST",
  );
  await page.locator('input[type="file"]').setInputFiles(await fixture(color));
  await confirmCrop(page);
  const result = await response;
  expect(result.ok(), await result.text()).toBe(true);
  const { avatarUrl } = await result.json();
  await expect(page.locator(".profile-photo-thumbnail img")).toHaveAttribute(
    "src",
    avatarUrl,
  );
  await saved(page);
  return avatarUrl as string;
}
async function confirmCrop(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Adjust profile photo" });
  await dialog
    .getByRole("button", { name: "Upload photo", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}
async function cleanup(id: string | undefined, emails: string[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url.startsWith("http://127.0.0.1:")) throw new Error("Local tests only");
  if (id) {
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const files = await admin.storage
      .from("profile-photos")
      .list(id, { limit: 100 });
    if (files.error) throw files.error;
    const keys = files.data.map((file) => `${id}/${file.name}`);
    if (keys.length) {
      const result = await admin.storage.from("profile-photos").remove(keys);
      if (result.error) throw result.error;
    }
  }
  for (const email of emails) await removeOwner(email);
}
async function current(page: Page, id: string) {
  return (await (
    await page.request.get(`/api/profiles/${id}`)
  ).json()) as Profile;
}

test("device photo stays private until published, replacement preserves old snapshot, republish and unpublish revoke access", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  const email = await sessionOwner(page);
  let id: string | undefined;
  const anonymous = await browser.newContext();
  const cross = await browser.newContext();
  let otherEmail: string | undefined;
  try {
    const profile = await createProfile(page, "photo");
    id = profile.id;
    await addLink(page);
    await appearance(page);
    await mkdir(directory, { recursive: true });
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.locator(".profile-photo").screenshot({
      path: `${directory}/photo-empty-${info.project.name}-320.png`,
    });
    const first = await upload(page, id);
    await page.locator('input[type="file"]').setInputFiles([]);
    expect((await current(page, id)).document.appearance.avatarUrl).toBe(first);
    const ownerRead = await page.request.get(first);
    expect(ownerRead.status()).toBe(200);
    expect(ownerRead.headers()["content-type"]).toBe("image/webp");
    expect(ownerRead.headers()["x-content-type-options"]).toBe("nosniff");
    expect(ownerRead.headers()["cache-control"]).toContain("private, no-store");
    const denied = await anonymous.request.get(first);
    expect(denied.status()).toBe(404);
    expect(denied.headers()["cache-control"]).toContain("no-store");
    expect(denied.headers()["location"]).toBeUndefined();
    const crossPage = await cross.newPage();
    otherEmail = await sessionOwner(crossPage);
    expect((await cross.request.get(first)).status()).toBe(404);
    expect(
      (
        await cross.request.post(`/api/profiles/${id}/photo`, {
          headers,
          data: (await fixture()).buffer,
        })
      ).status(),
    ).toBe(404);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator(".profile-photo").screenshot({
      path: `${directory}/photo-control-${info.project.name}-desktop.png`,
    });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.locator(".profile-photo").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const sizes = await page
      .locator(".profile-photo button:visible")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().height),
      );
    expect(sizes.every((height) => height >= 44)).toBe(true);
    await page.locator(".profile-photo").screenshot({
      path: `${directory}/photo-control-${info.project.name}-320.png`,
    });
    await publish(page);
    expect((await anonymous.request.get(first)).status()).toBe(200);
    const second = await upload(page, id, "#81423d");
    expect(second).not.toBe(first);
    expect((await anonymous.request.get(first)).status()).toBe(200);
    expect((await anonymous.request.get(second)).status()).toBe(404);
    const publicPage = await anonymous.newPage();
    await publicPage.setViewportSize({ width: 320, height: 844 });
    await publicPage.goto(`/@${profile.handle}`);
    await expect(publicPage.locator(".original-avatar")).toHaveAttribute(
      "src",
      first,
    );
    await publish(page);
    expect((await anonymous.request.get(first)).status()).toBe(404);
    expect((await anonymous.request.get(second)).status()).toBe(200);
    await publicPage.reload();
    await expect(publicPage.locator(".original-avatar")).toHaveAttribute(
      "src",
      second,
    );
    await expect
      .poll(() =>
        publicPage
          .locator(".original-avatar")
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBe(80);
    await publicPage.screenshot({
      path: `${directory}/published-${info.project.name}-320.png`,
    });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await page
      .getByRole("button", { name: "Unpublish page", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Unpublish this page?" }),
    ).not.toBeVisible();
    expect((await anonymous.request.get(second)).status()).toBe(404);
    expect((await page.request.get(second)).status()).toBe(200);
  } finally {
    await anonymous.close();
    await cross.close();
    await cleanup(id, [email, ...(otherEmail ? [otherEmail] : [])]);
  }
});

test("upload allows concurrent editing across tabs, blocks publication until save and keeps previous photo after failure", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Race injection runs in Chromium.",
  );
  const email = await sessionOwner(page);
  let id: string | undefined;
  try {
    id = (await createProfile(page, "race")).id;
    await addLink(page);
    await appearance(page);
    const first = await upload(page, id);
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reached!: () => void;
    const started = new Promise<void>((resolve) => {
      reached = resolve;
    });
    await page.route(`**/api/profiles/${id}/photo`, async (route) => {
      reached();
      await held;
      await route.continue();
    });
    const response = page.waitForResponse((response) =>
      response.url().endsWith(`/api/profiles/${id}/photo`),
    );
    await page
      .locator('input[type="file"]')
      .setInputFiles(await fixture("#81423d"));
    await confirmCrop(page);
    await started;
    await expect(page.locator("#profile-photo-status")).toBeFocused();
    await expect(page.getByText(/Uploading photo…/)).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 });
    await page
      .locator(".profile-photo")
      .screenshot({ path: `${directory}/photo-uploading-320.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(
      page.getByRole("button", { name: "Replace photo", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Publish", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await openIdentity(page);
    await page
      .getByLabel("Public display name")
      .fill("Changed during photo upload");
    await page.getByLabel("Bio", { exact: true }).fill("Concurrent biography");
    await appearance(page);
    await page.getByRole("radio", { name: /Square/ }).check();
    let releaseSave!: () => void;
    const holdSave = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    let saveReached!: () => void;
    const saveStarted = new Promise<void>((resolve) => {
      saveReached = resolve;
    });
    await page.route(`**/api/profiles/${id}/save`, async (route) => {
      if (
        route.request().postDataJSON().body.document.appearance.avatarUrl ===
        first
      ) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      saveReached();
      await holdSave;
      await route.fulfill({ response });
    });
    release();
    expect((await response).ok()).toBe(true);
    await expect(page.getByText(/Uploading photo…/)).not.toBeVisible();
    await saveStarted;
    await expect(
      page.getByRole("button", { name: "Publish", exact: true }),
    ).toBeDisabled();
    await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
    releaseSave();
    await saved(page);
    await page.unroute(`**/api/profiles/${id}/save`);
    const draft = await current(page, id);
    expect(draft.document.name).toBe("Changed during photo upload");
    expect(draft.document.bio).toBe("Concurrent biography");
    expect(draft.document.appearance.shape).toBe("square");
    expect(draft.document.appearance.avatarUrl).not.toBe(first);
    await page.unroute(`**/api/profiles/${id}/photo`);
    await page.route(`**/api/profiles/${id}/photo`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "Photo storage unavailable. Please retry." },
        }),
      }),
    );
    await page.locator('input[type="file"]').setInputFiles(await fixture());
    await confirmCrop(page);
    await expect(page.getByText(/Photo storage unavailable/)).toBeVisible();
    await expect(page.locator(".profile-photo-thumbnail img")).toHaveAttribute(
      "src",
      draft.document.appearance.avatarUrl!,
    );
    await page
      .locator(".profile-photo")
      .screenshot({ path: `${directory}/upload-error.png` });
    await page.setViewportSize({ width: 320, height: 844 });
    await page
      .locator(".profile-photo")
      .screenshot({ path: `${directory}/upload-error-320.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.unroute(`**/api/profiles/${id}/photo`);
    await upload(page, id);
    await page
      .getByRole("button", { name: "Remove photo", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#avatar-url")).toBeFocused();
    await expect(page.locator(".profile-photo-thumbnail img")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Undo photo removal", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#avatar-url")).toBeFocused();
    await expect(page.locator(".profile-photo-thumbnail img")).toHaveCount(1);
    await saved(page);
  } finally {
    await cleanup(id, [email]);
  }
});

test("expired upload uses existing sign-in recovery and an unmounted editor ignores a late upload", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Recovery injection runs in Chromium.",
  );
  const email = await sessionOwner(page);
  let id: string | undefined;
  try {
    id = (await createProfile(page, "recover")).id;
    await addLink(page);
    await appearance(page);
    const first = await upload(page, id);
    await page.route(`**/api/profiles/${id}/photo`, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "unauthenticated",
            message: "Your session has expired. Sign in to continue.",
          },
        }),
      }),
    );
    await page.locator('input[type="file"]').setInputFiles(await fixture());
    await confirmCrop(page);
    await expect(
      page.getByRole("button", { name: "Sign in to continue", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".profile-photo-thumbnail img")).toHaveAttribute(
      "src",
      first,
    );
    await page
      .getByRole("button", { name: "Sign in to continue", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Sign in to keep editing" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Your unsaved work remains in this tab/),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    // Reload only this disposable fixture to clear the intentionally injected auth failure.
    await page.unroute(`**/api/profiles/${id}/photo`);
    await page.reload();
    await appearance(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reached!: () => void;
    const started = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const fakeUrl = `/api/profile-photos/${id}/${crypto.randomUUID()}`;
    await page.route(`**/api/profiles/${id}/photo`, async (route) => {
      reached();
      await held;
      try {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ avatarUrl: fakeUrl }),
        });
      } catch {
        /* Navigation may cancel this deliberately delayed fixture. */
      }
    });
    await page.locator('input[type="file"]').setInputFiles(await fixture());
    await confirmCrop(page);
    await started;
    // Navigation unmounts the editor while its upload response is still held.
    await page.evaluate(async () => {
      const link = document.querySelector<HTMLAnchorElement>(
        'a[href="/app/profiles"]',
      );
      if (link) link.click();
    });
    await expect(
      page.getByRole("heading", { name: "Profiles", exact: true }),
    ).toBeVisible();
    release();
    expect((await current(page, id)).document.appearance.avatarUrl).toBe(first);
    await page.goto(`/app/profiles/${id}/edit`);
    await appearance(page);
    await expect(
      page.getByRole("button", { name: "Replace photo", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".profile-photo-thumbnail img")).toHaveAttribute(
      "src",
      first,
    );
  } finally {
    await cleanup(id, [email]);
  }
});

test("upload rejects unauthenticated, wrong origin/host, oversized, unsupported and malformed requests", async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Boundary coverage runs in Chromium.",
  );
  const email = await sessionOwner(page);
  const anonymous = await browser.newContext();
  let id: string | undefined;
  try {
    id = (await createProfile(page, "bounds")).id;
    const path = `/api/profiles/${id}/photo`;
    const body = (await fixture()).buffer;
    expect(
      (await anonymous.request.post(path, { headers, data: body })).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post(path, {
          headers: { ...headers, Origin: "https://attacker.example" },
          data: body,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(path, {
          headers: { ...headers, Host: "attacker.example" },
          data: body,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(path, {
          headers,
          data: Buffer.alloc(3 * 1024 * 1024 + 1),
        })
      ).status(),
    ).toBe(413);
    expect(
      (
        await page.request.post(path, {
          headers: { ...headers, "Content-Type": "image/svg+xml" },
          data: "<svg/>",
        })
      ).status(),
    ).toBe(415);
    expect(
      (
        await page.request.post(path, { headers, data: "not an image" })
      ).status(),
    ).toBe(422);
    for (const crop of [
      "",
      "{}",
      "null",
      "{".repeat(257),
      JSON.stringify({ centerX: 0.5, centerY: 0.5, zoom: 4 }),
      JSON.stringify({ centerX: 0, centerY: 0.5, zoom: 1 }),
      '{"centerX":0.5,"centerY":0.5,"zoom":1e999}',
    ]) {
      const response = await page.request.post(path, {
        headers: { ...headers, "X-Photo-Crop": crop },
        data: body,
      });
      expect(response.status()).toBe(400);
      expect((await response.json()).error.code).toBe("invalid_photo_crop");
    }
    // Legacy clients can still upload raw original bytes without a crop header.
    const legacy = await page.request.post(path, { headers, data: body });
    expect(legacy.ok()).toBe(true);
    const legacyPhoto = await page.request.get((await legacy.json()).avatarUrl);
    expect(await sharp(await legacyPhoto.body()).metadata()).toMatchObject({
      width: 120,
      height: 80,
      format: "webp",
    });
    for (const url of [
      `/api/profile-photos/not-a-uuid/${crypto.randomUUID()}`,
      `/api/profile-photos/${id}/${crypto.randomUUID()}`,
      `/api/profile-photos/${id.toUpperCase()}/${crypto.randomUUID()}`,
    ]) {
      const response = await anonymous.request.get(url);
      expect(response.status()).toBe(404);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
      expect(response.headers()["location"]).toBeUndefined();
    }
    expect(
      (await current(page, id)).document.appearance.avatarUrl,
    ).toBeUndefined();
  } finally {
    await anonymous.close();
    await cleanup(id, [email]);
  }
});
