import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
// Password seeds a real local session without consuming the OTP resend window.
// The session-interruption test then restores that session using a real email OTP.
export async function sessionOwner(page: Page) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url.startsWith("http://127.0.0.1:")) throw new Error("Local tests only");
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  const password = `Local-${crypto.randomUUID()}`;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  const cookies: Array<
    Parameters<ReturnType<Page["context"]>["addCookies"]>[0][number]
  > = [];
  const client = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: (values) => {
          for (const { name, value, options } of values)
            cookies.push({
              name,
              value,
              url: process.env.APP_ORIGIN!,
              httpOnly: options.httpOnly,
              secure: options.secure,
              sameSite:
                typeof options.sameSite === "string"
                  ? ((options.sameSite[0].toUpperCase() +
                      options.sameSite.slice(1)) as "Lax" | "Strict" | "None")
                  : "Lax",
            });
        },
      },
    },
  );
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  await page.context().addCookies(cookies);
  await page.goto("/app/profiles");
  await expect(
    page.getByRole("heading", { name: "Profiles", exact: true }),
  ).toBeVisible();
  return email;
}
export async function signIn(page: Page) {
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  const code = await emailCode(email);
  await page.getByLabel("Sign-in code").fill(code);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Profiles", exact: true }),
  ).toBeVisible();
  return email;
}
export async function emailCode(email: string) {
  const base = process.env.MAILPIT_URL || "http://127.0.0.1:54324";
  let code = "";
  await expect
    .poll(
      async () => {
        const data = await (await fetch(`${base}/api/v1/messages`)).json();
        const message = data.messages.find(
          (item: { To: { Address: string }[] }) =>
            item.To.some((to) => to.Address === email),
        );
        if (!message) return "";
        const content = await (
          await fetch(`${base}/api/v1/message/${message.ID}`)
        ).json();
        code = (content.Text || content.HTML).match(/\b\d{6}\b/)?.[0] || "";
        return code;
      },
      { timeout: 15000 },
    )
    .toMatch(/^\d{6}$/);
  return code;
}
export async function createProfile(page: Page, suffix = "first") {
  const handle = `e2e-${crypto.randomUUID().slice(0, 8)}-${suffix}`;
  await page
    .getByRole("button", { name: "Create profile", exact: true })
    .click();
  await page.getByLabel("Owner-only label").fill(`Private ${suffix}`);
  await page.getByLabel("Public display name").fill(`Public ${suffix}`);
  await page.getByLabel("Public handle").fill(handle);
  await page
    .getByRole("button", { name: "Create private draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add link", exact: true }),
  ).toBeEnabled();
  return { handle, id: page.url().match(/profiles\/([^/]+)\/edit/)![1] };
}
export async function openIdentity(page: Page) {
  const identity = page.locator(".identity-disclosure");
  await expect(identity).toBeVisible();
  if ((await identity.getAttribute("open")) === null)
    await identity.locator("summary").click();
}
export async function openBlock(page: Page, index = 0) {
  const block = page.locator(".block").nth(index);
  await expect(block).toBeVisible();
  if ((await block.getAttribute("open")) === null)
    await block.locator(":scope > summary").click();
  return block;
}
export async function addLink(page: Page) {
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  await page.getByLabel("Link label", { exact: true }).selectOption("custom");
  await page.getByLabel("Custom label", { exact: true }).fill("Selected work");
  await page.getByLabel("Destination URL").fill("https://example.com/work");
  await saved(page);
}
export async function saved(page: Page) {
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
}
export async function publish(page: Page) {
  await page.getByRole("button", { name: /^Publish( changes)?$/ }).click();
  await page
    .getByRole("button", { name: "Publish snapshot", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your published page", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to editing", exact: true })
    .click();
}
export async function removeOwner(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url.startsWith("http://127.0.0.1:")) throw new Error("Local tests only");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((user) => user.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}
