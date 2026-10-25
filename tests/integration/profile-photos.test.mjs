import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  !url?.startsWith("http://127.0.0.1:") ||
  !process.env.TEST_DATABASE_URL?.includes("@127.0.0.1:")
)
  throw new Error(
    "Photo integration tests require explicitly configured localhost Supabase.",
  );
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const anon = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  options,
);
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
const ownerIds = [],
  objects = [];
let owner, other;
async function account() {
  const email = `photo-${crypto.randomUUID()}@example.test`,
    password = `Local-${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  ownerIds.push(created.data.user.id);
  const client = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    options,
  );
  assert.ifError(
    (await client.auth.signInWithPassword({ email, password })).error,
  );
  return client;
}
async function rpc(client, name, args) {
  const result = await client.rpc(name, args);
  assert.ifError(result.error);
  return result.data;
}
async function mutate(kind, profile, body = {}) {
  return rpc(owner, "mutate_profile", {
    kind,
    operation_id: crypto.randomUUID(),
    body,
    ...(profile
      ? { profile: profile.id, expected_revision: profile.revision }
      : {}),
  });
}
async function save(profile, document) {
  return mutate("save", profile, {
    label: profile.label,
    handle: profile.handle,
    document,
  });
}
before(async () => {
  await db.connect();
  owner = await account();
  other = await account();
});
after(async () => {
  if (objects.length)
    assert.ifError(
      (await admin.storage.from("profile-photos").remove(objects)).error,
    );
  for (const id of ownerIds)
    assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  await db.end();
});
test("SQL and JavaScript fixtures agree on exact managed paths, avatar only", async () => {
  const cases = JSON.parse(
    await readFile(
      new URL("../fixtures/managed-avatars.json", import.meta.url),
      "utf8",
    ),
  );
  let profile = await mutate("create", null, {
    name: "Photo validation fixture",
    label: "Photo fixture",
    handle: `photo-${crypto.randomUUID().slice(0, 8)}`,
  });
  for (const { url, valid } of cases) {
    assert.equal(
      (await db.query("select private.valid_avatar_path($1) as valid", [url]))
        .rows[0].valid,
      valid,
      url,
    );
    for (const field of ["avatarUrl", "coverUrl", "imageUrl"]) {
      const document = {
        ...profile.document,
        appearance: { theme: "warm", layout: "editorial", shape: "soft" },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: "link",
            visible: true,
            label: "Work",
            url: "https://example.com",
          },
        ],
      };
      if (field === "imageUrl") document.blocks[0].imageUrl = url;
      else document.appearance[field] = url;
      profile = await save(profile, document);
      const result = await owner.rpc("mutate_profile", {
        kind: "publish",
        operation_id: crypto.randomUUID(),
        profile: profile.id,
        expected_revision: profile.revision,
      });
      if (field === "avatarUrl" && valid) {
        assert.ifError(result.error);
        profile = result.data;
      } else
        assert.equal(
          result.error?.message,
          "invalid_media_url",
          `${field}: ${url}`,
        );
    }
  }
  await mutate("unpublish", profile);
});
test("photo permission follows current publication and active owner; browser Storage is denied", async () => {
  let profile = await mutate("create", null, {
    name: "Photo lifecycle fixture",
    label: "Photo fixture",
    handle: `photo-${crypto.randomUUID().slice(0, 8)}`,
  });
  const first = crypto.randomUUID(),
    second = crypto.randomUUID();
  const bytes = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "navy" },
  })
    .webp()
    .toBuffer();
  for (const asset of [first, second]) {
    const key = `${profile.id}/${asset}.webp`;
    assert.ifError(
      (
        await admin.storage
          .from("profile-photos")
          .upload(key, bytes, { contentType: "image/webp", upsert: false })
      ).error,
    );
    objects.push(key);
  }
  const gate = (client, asset) =>
    rpc(client, "can_read_profile_photo", { profile: profile.id, asset });
  assert.equal(await gate(owner, first), true);
  assert.equal(await gate(anon, first), false);
  assert.equal(await gate(other, first), false);
  for (const client of [owner, other, anon]) {
    assert.ok(
      (await client.storage.from("profile-photos").download(objects[0])).error,
    );
    const key = `${profile.id}/${crypto.randomUUID()}.webp`;
    assert.ok(
      (
        await client.storage
          .from("profile-photos")
          .upload(key, bytes, { contentType: "image/webp" })
      ).error,
    );
    assert.deepEqual(
      (await client.storage.from("profile-photos").list(profile.id)).data,
      [],
    );
  }
  const photo = (asset) => `/api/profile-photos/${profile.id}/${asset}`;
  const document = (asset) => ({
    ...profile.document,
    appearance: { ...profile.document.appearance, avatarUrl: photo(asset) },
    blocks: [
      { id: crypto.randomUUID(), type: "text", visible: true, text: "Work" },
    ],
  });
  profile = await save(profile, document(first));
  profile = await mutate("publish", profile);
  assert.equal(await gate(anon, first), true);
  profile = await save(profile, document(second));
  assert.equal(await gate(anon, first), true);
  assert.equal(await gate(anon, second), false);
  profile = await mutate("publish", profile);
  assert.equal(await gate(anon, first), false);
  assert.equal(await gate(anon, second), true);
  await db.query("update private.accounts set status='suspended' where id=$1", [
    ownerIds[0],
  ]);
  assert.equal(await gate(owner, second), false);
  assert.equal(await gate(anon, second), false);
  assert.equal(
    (await owner.rpc("read_profile", { profile: profile.id })).error?.message,
    "account_unavailable",
  );
  await db.query("update private.accounts set status='active' where id=$1", [
    ownerIds[0],
  ]);
  await mutate("unpublish", profile);
  assert.equal(await gate(anon, second), false);
  assert.equal(await gate(owner, second), true);
  const grants = await db.query(
    "select has_function_privilege('anon','public.read_profile(uuid)','execute') as owner_rpc, has_table_privilege('anon','private.profiles','select') as domain_read",
  );
  assert.equal(grants.rows[0].owner_rpc, false);
  assert.equal(grants.rows[0].domain_read, false);
});
