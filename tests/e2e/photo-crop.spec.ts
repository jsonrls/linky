import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  createProfile,
  openIdentity,
  removeOwner,
  saved,
  sessionOwner,
} from "./helpers";

const directory = "artifacts/photo-crop";
const dialogFor = (page: Page) =>
  page.getByRole("dialog", { name: "Adjust profile photo" });
const inputFor = (page: Page) =>
  page.getByLabel("Choose profile photo", { exact: true });
async function fixture(orientation = 1) {
  const width = 360,
    height = 240;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      data[offset] = Math.round((x / width) * 230);
      data[offset + 1] = Math.round((y / height) * 230);
      data[offset + 2] = x < 90 && y < 180 ? 210 : 40;
    }
  }
  return {
    name: `asymmetric-exif-${orientation}.jpg`,
    mimeType: "image/jpeg",
    buffer: await sharp(data, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 95 })
      .withMetadata({ orientation })
      .toBuffer(),
  };
}
async function appearance(page: Page) {
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  const disclosure = page.locator("details").filter({
    has: page.getByText("Profile images (optional)", { exact: true }),
  });
  if ((await disclosure.getAttribute("open")) === null)
    await disclosure.locator(":scope > summary").click();
}
async function setup(page: Page, suffix: string) {
  const email = await sessionOwner(page);
  const { id } = await createProfile(page, suffix);
  await appearance(page);
  await mkdir(directory, { recursive: true });
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  return { email, id };
}
async function cleanup(id: string, email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url.startsWith("http://127.0.0.1:")) throw new Error("Local tests only");
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
  await removeOwner(email);
}
async function avatar(page: Page, id: string) {
  return (await (await page.request.get(`/api/profiles/${id}`)).json()).document
    .appearance.avatarUrl;
}
async function ready(page: Page) {
  await expect(
    dialogFor(page).getByRole("button", { name: "Upload photo", exact: true }),
  ).toBeEnabled();
  await expect(dialogFor(page).locator("img")).toBeVisible();
}
async function imagePosition(viewport: Locator) {
  return viewport.locator("img").evaluate((image) => ({
    left: image.style.left,
    top: image.style.top,
    width: image.style.width,
  }));
}
async function assertCovered(viewport: Locator) {
  const size = (await viewport.boundingBox())!;
  expect(size.width).toBeCloseTo(size.height, 0);
  const boxes = await viewport.evaluate((element) => {
    const frame = element.getBoundingClientRect();
    const image = element.querySelector("img")!.getBoundingClientRect();
    return {
      left: image.left - frame.left,
      top: image.top - frame.top,
      right: image.right - frame.right,
      bottom: image.bottom - frame.bottom,
    };
  });
  expect(boxes.left).toBeLessThanOrEqual(0.1);
  expect(boxes.top).toBeLessThanOrEqual(0.1);
  expect(boxes.right).toBeGreaterThanOrEqual(-0.1);
  expect(boxes.bottom).toBeGreaterThanOrEqual(-0.1);
}

test("cancel, Escape and close send no upload; reset, arrows, buttons and captured drag clamp the local crop", async ({
  page,
}, info) => {
  const { email, id } = await setup(page, "crop");
  let posts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith(`/api/profiles/${id}/photo`)
    )
      posts++;
  });
  try {
    const original = await fixture();
    const before = await avatar(page, id);
    for (const close of ["Cancel", "Escape", "Close dialog"]) {
      await inputFor(page).setInputFiles(original);
      await ready(page);
      await expect(page.locator("#photo-crop-help")).toBeFocused();
      if (close === "Escape") await page.keyboard.press("Escape");
      else
        await dialogFor(page)
          .getByRole("button", { name: close, exact: true })
          .click();
      await expect(dialogFor(page)).not.toBeVisible();
      await expect(page.locator("#avatar-url")).toBeFocused();
      expect(posts).toBe(0);
      expect(await avatar(page, id)).toBe(before);
    }
    await inputFor(page).setInputFiles(original);
    await ready(page);
    const dialog = dialogFor(page);
    const viewport = page.getByRole("group", {
      name: "Photo crop preview",
      exact: true,
    });
    const centered = await imagePosition(viewport);
    const zoom = dialog.getByRole("slider", { name: "Zoom" });
    await zoom.focus();
    await zoom.press("End");
    await expect(zoom).toHaveValue("300");
    await expect(dialog.locator("output")).toHaveText("300%");
    await viewport.focus();
    const atZoom = await imagePosition(viewport);
    await viewport.press("ArrowLeft");
    const small = await imagePosition(viewport);
    await viewport.press("Shift+ArrowLeft");
    const large = await imagePosition(viewport);
    expect(parseFloat(small.left) - parseFloat(atZoom.left)).toBeCloseTo(-2);
    expect(parseFloat(large.left) - parseFloat(small.left)).toBeCloseTo(-10);
    for (const direction of ["left", "right", "up", "down"]) {
      const prior = await imagePosition(viewport);
      await dialog
        .getByRole("button", { name: `Move photo ${direction}`, exact: true })
        .click();
      expect(await imagePosition(viewport)).not.toEqual(prior);
    }
    const box = (await viewport.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 180, box.y + box.height + 180, {
      steps: 8,
    });
    await page.mouse.up();
    await assertCovered(viewport);
    expect(await imagePosition(viewport)).not.toEqual(atZoom);
    await dialog.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(zoom).toHaveValue("100");
    expect(await imagePosition(viewport)).toEqual(centered);
    await assertCovered(viewport);
    await page.setViewportSize({ width: 1280, height: 900 });
    await dialog.screenshot({
      path: `${directory}/dialog-${info.project.name}-desktop.png`,
    });
    for (const size of [
      { width: 320, height: 844 },
      { width: 320, height: 568 },
      { width: 640, height: 360 },
    ]) {
      await page.setViewportSize(size);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const geometry = await dialog.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));
      expect(geometry.width).toBeLessThanOrEqual(size.width);
      expect(geometry.height).toBeLessThanOrEqual(size.height);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeInViewport();
      await expect(
        dialog.getByRole("button", { name: "Upload photo", exact: true }),
      ).toBeInViewport();
      const sizes = await dialog.locator("button").evaluateAll((buttons) =>
        buttons.map((button) => ({
          width: button.getBoundingClientRect().width,
          height: button.getBoundingClientRect().height,
        })),
      );
      expect(
        sizes.every((target) => target.width >= 44 && target.height >= 44),
      ).toBe(true);
      await assertCovered(viewport);
      const movement = await dialog.locator(".photo-crop-moves").boundingBox();
      const frame = (await viewport.boundingBox())!;
      expect(movement!.y).toBeGreaterThanOrEqual(frame.y + frame.height);
      const zoomBounds = (await dialog
        .locator(".photo-crop-zoom")
        .boundingBox())!;
      expect(zoomBounds.y).toBeGreaterThanOrEqual(
        movement!.y + movement!.height,
      );
      await dialog.screenshot({
        path: `${directory}/dialog-${info.project.name}-${size.width}x${size.height}.png`,
      });
      for (const control of [
        dialog.getByRole("button", { name: "Move photo down", exact: true }),
        zoom,
        dialog.getByRole("button", { name: "Reset", exact: true }),
      ]) {
        await control.scrollIntoViewIfNeeded();
        const controlBounds = (await control.boundingBox())!;
        const body = (await dialog.locator(".photo-crop-body").boundingBox())!;
        expect(controlBounds.y).toBeGreaterThanOrEqual(body.y - 1);
        expect(controlBounds.y + controlBounds.height).toBeLessThanOrEqual(
          body.y + body.height + 1,
        );
      }
      await dialog.screenshot({
        path: `${directory}/controls-${info.project.name}-${size.width}x${size.height}.png`,
      });
    }
    if (info.project.name === "chromium") {
      await page.setViewportSize({ width: 320, height: 568 });
      await zoom.press("End");
      await viewport.scrollIntoViewIfNeeded();
      const beforeTouch = await imagePosition(viewport);
      const bounds = (await viewport.boundingBox())!;
      const touch = await page.context().newCDPSession(page);
      await touch.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 1,
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        ],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: bounds.x + bounds.width / 2 - 50,
            y: bounds.y + bounds.height / 2 - 30,
          },
        ],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      expect(await imagePosition(viewport)).not.toEqual(beforeTouch);
      await assertCovered(viewport);
      await touch.detach();
      await dialog.getByRole("button", { name: "Reset", exact: true }).click();
    }
    await page.keyboard.press("Escape");
    expect(posts).toBe(0);
    expect(await avatar(page, id)).toBe(before);
  } finally {
    await cleanup(id, email);
  }
});

test("preparation, stale decode cancellation, decode error, choose another and size errors keep local state disposable", async ({
  page,
}, info) => {
  const { email, id } = await setup(page, "decode");
  let posts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith(`/api/profiles/${id}/photo`)
    )
      posts++;
  });
  try {
    await page.evaluate(() => {
      const state = window as typeof window & {
        photoUrls: string[];
        revokedPhotoUrls: string[];
        releasePhotoDecode?: () => void;
      };
      state.photoUrls = [];
      state.revokedPhotoUrls = [];
      const create = URL.createObjectURL.bind(URL),
        revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = create(blob);
        state.photoUrls.push(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        state.revokedPhotoUrls.push(url);
        revoke(url);
      };
      const decode = HTMLImageElement.prototype.decode;
      const releases: Array<() => void> = [];
      state.releasePhotoDecode = () => {
        HTMLImageElement.prototype.decode = decode;
        releases.forEach((release) => release());
      };
      HTMLImageElement.prototype.decode = function () {
        return new Promise<void>((resolve) => {
          releases.push(resolve);
        }).then(() => decode.call(this));
      };
    });
    await inputFor(page).setInputFiles(await fixture());
    await expect(
      dialogFor(page).getByText("Preparing photo…", { exact: true }),
    ).toBeVisible();
    await expect(
      dialogFor(page).getByRole("button", {
        name: "Upload photo",
        exact: true,
      }),
    ).toBeDisabled();
    await dialogFor(page).screenshot({
      path: `${directory}/preparing-${info.project.name}.png`,
    });
    await page.keyboard.press("Escape");
    await page.evaluate(() =>
      (
        window as typeof window & { releasePhotoDecode?: () => void }
      ).releasePhotoDecode?.(),
    );
    await expect(dialogFor(page)).not.toBeVisible();
    await inputFor(page).setInputFiles({
      name: "bad.png",
      mimeType: "image/png",
      buffer: Buffer.from("not a photo"),
    });
    await expect(dialogFor(page).getByRole("alert")).toBeFocused();
    await expect(
      dialogFor(page).getByRole("button", {
        name: "Upload photo",
        exact: true,
      }),
    ).toBeDisabled();
    await page.setViewportSize({ width: 320, height: 568 });
    await dialogFor(page).screenshot({
      path: `${directory}/decode-error-${info.project.name}-320.png`,
    });
    const picker = page.waitForEvent("filechooser");
    await dialogFor(page)
      .getByRole("button", { name: "Choose another photo", exact: true })
      .click();
    await (await picker).setFiles(await fixture(7));
    await ready(page);
    await expect(dialogFor(page).locator("output")).toHaveText("100%");
    await expect(dialogFor(page).getByRole("alert")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await inputFor(page).setInputFiles({
      name: "large.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: { width: 5000, height: 4001, channels: 3, background: "navy" },
      })
        .png()
        .toBuffer(),
    });
    await expect(dialogFor(page).getByRole("alert")).toHaveText(
      "Choose a photo up to 20 megapixels.",
    );
    await expect(
      dialogFor(page).getByRole("button", {
        name: "Upload photo",
        exact: true,
      }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await inputFor(page).setInputFiles({
      name: "large.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
    });
    await expect(page.locator("#profile-photo-error")).toBeFocused();
    await expect(dialogFor(page)).not.toBeVisible();
    const urls = await page.evaluate(() => {
      const state = window as typeof window & {
        photoUrls: string[];
        revokedPhotoUrls: string[];
      };
      return { made: state.photoUrls, revoked: state.revokedPhotoUrls };
    });
    expect(urls.made.length).toBeGreaterThanOrEqual(4);
    expect([...new Set(urls.made)].sort()).toEqual(
      [...new Set(urls.revoked)].sort(),
    );
    expect(posts).toBe(0);
  } finally {
    await cleanup(id, email);
  }
});

for (const orientation of [2, 6, 7]) {
  test(`original EXIF ${orientation} bytes and cropped browser preview match server output`, async ({
    page,
  }, info) => {
    const { email, id } = await setup(page, `exif${orientation}`);
    try {
      const original = await fixture(orientation);
      await page.evaluate(() => {
        const originalFetch = window.fetch;
        window.fetch = async (input, init) => {
          if (
            typeof input === "string" &&
            /\/api\/profiles\/[^/]+\/photo$/.test(input) &&
            init?.body instanceof File
          ) {
            const digest = await crypto.subtle.digest(
              "SHA-256",
              await init.body.arrayBuffer(),
            );
            (
              window as typeof window & {
                photoRequestBody?: { hash: string; size: number; type: string };
              }
            ).photoRequestBody = {
              hash: Array.from(new Uint8Array(digest), (byte) =>
                byte.toString(16).padStart(2, "0"),
              ).join(""),
              size: init.body.size,
              type: init.body.type,
            };
          }
          return originalFetch(input, init);
        };
      });
      await writeFile(
        `${directory}/asymmetric-exif-${orientation}.jpg`,
        original.buffer,
      );
      await inputFor(page).setInputFiles(original);
      await ready(page);
      const dialog = dialogFor(page),
        viewport = dialog.getByRole("group", {
          name: "Photo crop preview",
          exact: true,
        });
      const dimensions = await viewport.locator("img").evaluate((image) => ({
        width: (image as HTMLImageElement).naturalWidth,
        height: (image as HTMLImageElement).naturalHeight,
      }));
      expect(dimensions).toEqual(
        orientation >= 5
          ? { width: 240, height: 360 }
          : { width: 360, height: 240 },
      );
      await dialog.getByRole("slider", { name: "Zoom" }).press("End");
      await viewport.focus();
      await viewport.press("Shift+ArrowLeft");
      await viewport.press("Shift+ArrowUp");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
      const preview = await viewport.screenshot({
        path: `${directory}/preview-exif-${orientation}-${info.project.name}.png`,
      });
      const requestPromise = page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().endsWith(`/api/profiles/${id}/photo`),
      );
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().endsWith(`/api/profiles/${id}/photo`),
      );
      await dialog
        .getByRole("button", { name: "Upload photo", exact: true })
        .click();
      const request = await requestPromise,
        response = await responsePromise;
      // Browser protocols may omit binary Blob postData; inspect the actual File passed to fetch.
      expect(
        await page.evaluate(
          () =>
            (window as typeof window & { photoRequestBody?: unknown })
              .photoRequestBody,
        ),
      ).toEqual({
        hash: createHash("sha256").update(original.buffer).digest("hex"),
        size: original.buffer.length,
        type: "image/jpeg",
      });
      expect(request.headers()["content-type"]).toBe("image/jpeg");
      const crop = JSON.parse(request.headers()["x-photo-crop"]);
      expect(crop.zoom).toBe(3);
      expect(crop.centerX).toBeCloseTo(0.5 + (0.1 * 80) / dimensions.width);
      expect(crop.centerY).toBeCloseTo(0.5 + (0.1 * 80) / dimensions.height);
      expect(response.ok(), await response.text()).toBe(true);
      await expect(page.locator("#profile-photo-status")).toContainText(
        "Photo updated in this draft",
      );
      const { avatarUrl } = await response.json();
      await saved(page);
      const output = await (await page.request.get(avatarUrl)).body();
      await writeFile(
        `${directory}/output-exif-${orientation}-${info.project.name}.webp`,
        output,
      );
      const metadata = await sharp(output).metadata();
      expect(metadata).toMatchObject({ width: 80, height: 80, format: "webp" });
      expect(metadata.exif).toBeUndefined();
      const expected = await sharp(original.buffer)
        .autoOrient()
        .extract({
          left: Math.round(crop.centerX * dimensions.width - 40),
          top: Math.round(crop.centerY * dimensions.height - 40),
          width: 80,
          height: 80,
        })
        .webp({ quality: 85 })
        .toBuffer();
      expect(output).toEqual(expected);
      const previewMeta = await sharp(preview).metadata();
      const rendered = await sharp(preview).removeAlpha().raw().toBuffer();
      const stored = await sharp(output)
        .resize(previewMeta.width, previewMeta.height)
        .removeAlpha()
        .raw()
        .toBuffer();
      const meanError =
        rendered.reduce(
          (total, value, index) => total + Math.abs(value - stored[index]),
          0,
        ) / rendered.length;
      expect(meanError).toBeLessThan(4);
      await writeFile(
        `${directory}/pixels-exif-${orientation}-${info.project.name}.json`,
        JSON.stringify(
          {
            crop,
            dimensions,
            output: { width: metadata.width, height: metadata.height },
            previewMeanAbsoluteChannelError: meanError,
            originalBytesUnchanged: true,
          },
          null,
          2,
        ),
      );
      if (orientation === 6) {
        await page.route(`**/api/profiles/${id}/photo`, (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: { message: "Photo storage unavailable. Please retry." },
            }),
          }),
        );
        await inputFor(page).setInputFiles(original);
        await ready(page);
        await dialogFor(page)
          .getByRole("button", { name: "Upload photo", exact: true })
          .click();
        await expect(page.locator("#profile-photo-error")).toBeFocused();
        await expect(
          page.locator(".profile-photo-thumbnail img"),
        ).toHaveAttribute("src", avatarUrl);
        await page.setViewportSize({ width: 320, height: 568 });
        await page.locator(".profile-photo").screenshot({
          path: `${directory}/upload-error-${info.project.name}-320.png`,
        });
      }
    } finally {
      await cleanup(id, email);
    }
  });
}

test("known autosave session expiry keeps crop open with disabled confirmation and no photo POST", async ({
  page,
}, info) => {
  const { email, id } = await setup(page, "cropauth");
  let posts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith(`/api/profiles/${id}/photo`)
    )
      posts++;
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reached!: () => void;
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  try {
    const before = await avatar(page, id);
    await page.route(`**/api/profiles/${id}/save`, async (route) => {
      reached();
      await held;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "unauthenticated",
            message: "Your session has expired. Sign in to continue.",
          },
        }),
      });
    });
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await openIdentity(page);
    await page
      .getByLabel("Public display name")
      .fill("Pending session expiry fixture");
    await started;
    await appearance(page);
    await inputFor(page).setInputFiles(await fixture());
    await ready(page);
    release();
    await expect(
      dialogFor(page).getByText(/Cancel this adjustment and sign in/),
    ).toBeVisible();
    await expect(
      dialogFor(page).getByRole("button", {
        name: "Upload photo",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(dialogFor(page).locator("img")).toBeVisible();
    const frame = (await dialogFor(page)
      .locator(".photo-crop-viewport")
      .boundingBox())!;
    const moves = (await dialogFor(page)
      .locator(".photo-crop-moves")
      .boundingBox())!;
    expect(frame.width).toBeCloseTo(frame.height, 0);
    expect(moves.y).toBeGreaterThanOrEqual(frame.y + frame.height);
    await dialogFor(page)
      .getByRole("button", { name: "Reset", exact: true })
      .scrollIntoViewIfNeeded();
    await dialogFor(page).screenshot({
      path: `${directory}/session-expired-${info.project.name}.png`,
    });
    expect(posts).toBe(0);
    expect(await avatar(page, id)).toBe(before);
    await dialogFor(page)
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Sign in to continue", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Sign in to continue", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Sign in to keep editing" }),
    ).toBeVisible();
    expect(posts).toBe(0);
  } finally {
    release();
    await cleanup(id, email);
  }
});
