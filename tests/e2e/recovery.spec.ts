import { test, expect, type Page } from "@playwright/test";
import {
  sessionOwner,
  createProfile,
  openIdentity,
  addLink,
  saved,
  publish,
  emailCode,
  removeOwner,
} from "./helpers";

test.beforeEach(({}, info) =>
  test.skip(
    info.project.name !== "chromium",
    "Deterministic fault injection runs in Chromium; real OTP journey covers all engines.",
  ),
);

async function loseCommittedResponse(page: Page, endpoint: string) {
  const requests: unknown[] = [];
  await page.route(endpoint, async (route) => {
    requests.push(route.request().postDataJSON());
    const response = await route.fetch();
    if (requests.length === 1)
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "unreadable committed response",
      });
    else await route.fulfill({ response });
  });
  return requests;
}

test("lost publish and unpublish receipts keep the original intent until reconciled", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  try {
    const profile = await createProfile(page);
    await openIdentity(page);
    await addLink(page);
    const publishRequests = await loseCommittedResponse(
      page,
      `**/api/profiles/${profile.id}/publish`,
    );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page
      .getByRole("button", { name: "Publish snapshot", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check publish status", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await page
      .getByLabel("Bio")
      .fill("Newer private draft after uncertain publication");
    await saved(page);
    await expect(
      page.getByRole("button", { name: /^Publish( changes)?$/ }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Check publish status", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Check publish status", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your published page", exact: true }),
    ).toBeVisible();
    expect(publishRequests).toHaveLength(2);
    expect(publishRequests[1]).toEqual(publishRequests[0]);
    await page
      .getByRole("button", { name: "Back to editing", exact: true })
      .click();
    const live = await page.request.get(`/@${profile.handle}`);
    expect(await live.text()).not.toContain(
      "Newer private draft after uncertain publication",
    );
    await expect(
      page.getByRole("button", { name: "Publish changes", exact: true }),
    ).toBeEnabled();
    await publish(page);
    expect(publishRequests).toHaveLength(3);
    expect(publishRequests[2]).not.toEqual(publishRequests[0]);

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const unpublishRequests = await loseCommittedResponse(
      page,
      `**/api/profiles/${profile.id}/unpublish`,
    );
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await page
      .getByRole("button", { name: "Unpublish page", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check unpublish status", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page
      .getByLabel("Bio")
      .fill("New private draft after uncertain unpublication");
    await saved(page);
    await expect(
      page.getByRole("button", { name: /^Publish( changes)?$/ }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Check unpublish status", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Check unpublish status", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(unpublishRequests).toHaveLength(2);
    expect(unpublishRequests[1]).toEqual(unpublishRequests[0]);
    expect((await page.request.get(`/@${profile.handle}`)).status()).toBe(404);
    await publish(page);
    expect((await page.request.get(`/@${profile.handle}`)).status()).toBe(200);
    expect(unpublishRequests).toHaveLength(2);
  } finally {
    await removeOwner(email);
  }
});

test("unreadable committed save survives real session loss and OTP reauthentication", async ({
  page,
}, info) => {
  const email = await sessionOwner(page);
  try {
    const profile = await createProfile(page);
    await openIdentity(page);
    const requests = await loseCommittedResponse(
      page,
      `**/api/profiles/${profile.id}/save`,
    );
    await page.getByLabel("Bio").fill("First committed edit");
    await expect(
      page.getByRole("button", { name: "Retry save", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Bio")
      .fill("Newer local edit retained across authentication");
    await page.context().clearCookies();
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    await page
      .getByRole("button", { name: "Sign in to continue", exact: true })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(async () => (await page.getByRole("dialog").boundingBox())?.width)
      .toBeCloseTo(390, 0);
    await expect
      .poll(async () => (await page.getByRole("dialog").boundingBox())?.x)
      .toBeCloseTo(0, 0);
    await page.screenshot({
      path: info.outputPath("session-recovery-390.png"),
      fullPage: false,
    });
    await expect(page.getByLabel("Bio")).toHaveValue(
      "Newer local edit retained across authentication",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Sign in to continue", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Sign in to continue", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Send code", exact: true })
      .click();
    await page.getByLabel("Sign-in code").fill(await emailCode(email));
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Verify", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await saved(page);
    expect(requests.length).toBeGreaterThanOrEqual(4);
    expect(requests[1]).toEqual(requests[0]);
    expect(requests[2]).toEqual(requests[0]);
    expect(requests[3]).not.toEqual(requests[0]);
    await page.reload();
    await openIdentity(page);
    await expect(page.getByLabel("Bio")).toHaveValue(
      "Newer local edit retained across authentication",
    );
    await expect(
      page.getByText("Could not save", { exact: true }),
    ).not.toBeVisible();
  } finally {
    await removeOwner(email);
  }
});

test("concurrent tab conflict pauses autosave, preserves copy, and requires explicit discard", async ({
  page,
}) => {
  const email = await sessionOwner(page);
  try {
    await createProfile(page);
    await openIdentity(page);
    const second = await page.context().newPage();
    await second.goto(page.url());
    await openIdentity(second);
    await expect(second.getByLabel("Bio")).toBeVisible();
    await page.getByLabel("Bio").fill("Winning edit from first tab");
    await saved(page);
    await second.getByLabel("Bio").fill("Protected local second-tab edit");
    await expect(
      second.getByRole("button", { name: "Reload latest draft", exact: true }),
    ).toBeVisible();
    await second.getByLabel("Bio").fill("Even newer protected local edit");
    await second.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("denied")) },
        configurable: true,
      }),
    );
    await second
      .getByRole("button", { name: "Copy unsaved work", exact: true })
      .click();
    await expect(second.getByLabel("Text to copy")).toContainText(
      "Even newer protected local edit",
    );
    await second
      .getByRole("button", { name: "Reload latest draft", exact: true })
      .click();
    await expect(
      second.getByRole("button", { name: "Keep editing", exact: true }),
    ).toBeFocused();
    await second
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(second.getByLabel("Bio")).toHaveValue(
      "Even newer protected local edit",
    );
    await second
      .getByRole("button", { name: "Reload latest draft", exact: true })
      .click();
    await second
      .getByRole("button", { name: "Discard & reload", exact: true })
      .click();
    await expect(second.getByLabel("Bio")).toHaveValue(
      "Winning edit from first tab",
    );
    await second.close();
  } finally {
    await removeOwner(email);
  }
});
