import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  !url?.startsWith("http://127.0.0.1:") ||
  !process.env.TEST_DATABASE_URL?.includes("@127.0.0.1:")
)
  throw new Error(
    "Integration tests require an explicitly configured localhost Supabase.",
  );
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const database = new pg.Client({
  connectionString: process.env.TEST_DATABASE_URL,
});
const owners = [];
const prefix = `it-${crypto.randomUUID().slice(0, 8)}`;
async function owner(suffix) {
  const email = `${prefix}-${suffix}@example.test`;
  const password = `Local-test-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  owners.push(data.user.id);
  const client = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  return client;
}
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  assert.ifError(error);
  return data;
}
async function mutate(
  client,
  kind,
  profile,
  body = {},
  id = crypto.randomUUID(),
) {
  return rpc(client, "mutate_profile", {
    kind,
    operation_id: id,
    ...(profile
      ? { profile: profile.id, expected_revision: profile.revision }
      : {}),
    body,
  });
}
function doc(name = "Live name") {
  return {
    schemaVersion: 1,
    name,
    bio: "Published bio",
    appearance: { theme: "warm", layout: "editorial", shape: "soft" },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "link",
        visible: true,
        label: "Website",
        url: "https://example.com/path",
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        visible: false,
        text: "hidden private secret",
      },
    ],
  };
}
async function create(client, suffix) {
  return mutate(client, "create", null, {
    label: `private ${suffix}`,
    name: `Name ${suffix}`,
    handle: `${prefix}-${suffix}`,
  });
}
async function prepared(client, suffix) {
  const profile = await create(client, suffix);
  return mutate(client, "save", profile, {
    label: profile.label,
    handle: profile.handle,
    document: doc(),
  });
}
let a, b;
before(async () => {
  await database.connect();
  a = await owner("a");
  b = await owner("b");
});
after(async () => {
  for (const id of owners) {
    await admin.auth.admin.deleteUser(id);
  }
  await database.end();
});
test("two-owner isolation, narrow RPC grants, summary list and neutral unknowns", async () => {
  const profile = await create(a, "isolated");
  const list = await rpc(b, "owner_workspace");
  assert.equal(list.profiles.length, 0);
  for (const kind of ["save", "publish", "unpublish"]) {
    const denied = await b.rpc("mutate_profile", {
      kind,
      operation_id: crypto.randomUUID(),
      profile: profile.id,
      expected_revision: 0,
      body: {},
    });
    assert.equal(denied.error?.message, "not_found");
  }
  const denied = await b.rpc("read_profile", { profile: profile.id });
  assert.equal(denied.error?.message, "not_found");
  const direct = await a.schema("private").from("profiles").select("*");
  assert.ok(direct.error);
  const anon = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  assert.ok((await anon.rpc("owner_workspace")).error);
  assert.ok((await a.rpc("public_profile", { handle: profile.handle })).error);
  const summary = (await rpc(a, "owner_workspace")).profiles.find(
    (p) => p.id === profile.id,
  );
  assert.ok(!("document" in summary));
  assert.ok(!("ownerId" in summary));
  assert.equal(
    await rpc(admin, "public_profile", { handle: `${prefix}-absent` }),
    null,
  );
});
test("normalized handle race has exactly one winner", async () => {
  const body = { label: "Race", name: "Race", handle: `${prefix}-race` };
  const attempts = await Promise.all(
    [a, b].map((client) =>
      client.rpc("mutate_profile", {
        kind: "create",
        operation_id: crypto.randomUUID(),
        body,
      }),
    ),
  );
  assert.equal(attempts.filter((result) => !result.error).length, 1);
  assert.equal(
    attempts.find((result) => result.error).error.message,
    "handle_taken",
  );
});
test("strict save revisions, retry IDs and late publication are atomic", async () => {
  const profile = await create(a, "revisions");
  const document = doc();
  const body = { label: profile.label, handle: profile.handle, document };
  const id = crypto.randomUUID();
  const saved = await mutate(a, "save", profile, body, id);
  assert.deepEqual(await mutate(a, "save", profile, body, id), saved);
  const changed = await a.rpc("mutate_profile", {
    kind: "save",
    operation_id: id,
    profile: profile.id,
    expected_revision: 0,
    body: { ...body, label: "changed" },
  });
  assert.equal(changed.error?.message, "idempotency_conflict");
  const saves = await Promise.all(
    ["one", "two"].map((name) =>
      a.rpc("mutate_profile", {
        kind: "save",
        operation_id: crypto.randomUUID(),
        profile: profile.id,
        expected_revision: 1,
        body: { ...body, document: { ...document, name } },
      }),
    ),
  );
  assert.equal(saves.filter((result) => !result.error).length, 1);
  assert.equal(
    saves.find((result) => result.error).error.message,
    "revision_conflict",
  );
  const stale = await a.rpc("mutate_profile", {
    kind: "publish",
    operation_id: crypto.randomUUID(),
    profile: profile.id,
    expected_revision: 1,
  });
  assert.equal(stale.error?.message, "revision_conflict");
});
test("last published slot race never exceeds limit", async () => {
  const ownerClient = await owner("slots");
  const first = await prepared(ownerClient, "slot1");
  await mutate(ownerClient, "publish", first);
  const second = await prepared(ownerClient, "slot2");
  const third = await prepared(ownerClient, "slot3");
  const results = await Promise.all(
    [second, third].map((profile) =>
      ownerClient.rpc("mutate_profile", {
        kind: "publish",
        operation_id: crypto.randomUUID(),
        profile: profile.id,
        expected_revision: profile.revision,
      }),
    ),
  );
  assert.equal(results.filter((result) => !result.error).length, 1);
  assert.equal(
    results.find((result) => result.error).error.message,
    "published_limit",
  );
  assert.equal(
    (await rpc(ownerClient, "owner_workspace")).profiles.filter(
      (p) => p.publicationId,
    ).length,
    2,
  );
});
test("immutable snapshot privacy, repeat publish/unpublish, fixed handles and account status", async () => {
  let profile = await prepared(b, "snapshot");
  const publishId = crypto.randomUUID();
  const published = await mutate(b, "publish", profile, {}, publishId);
  assert.deepEqual(
    await mutate(b, "publish", profile, {}, publishId),
    published,
  );
  let live = await rpc(admin, "public_profile", { handle: profile.handle });
  assert.equal(live.document.name, "Live name");
  assert.equal(live.document.blocks.length, 1);
  assert.ok(!JSON.stringify(live).includes("hidden private secret"));
  assert.ok(!JSON.stringify(live).includes("private snapshot"));
  profile = await mutate(b, "save", published, {
    label: "owner-only secret",
    handle: profile.handle,
    document: doc("Private changed name"),
  });
  live = await rpc(admin, "public_profile", { handle: profile.handle });
  assert.equal(live.document.name, "Live name");
  const immutable = await database.query(
    "select payload from private.profile_publications where id=$1",
    [live.publicationId],
  );
  assert.equal(immutable.rows[0].payload.name, "Live name");
  await assert.rejects(
    () =>
      database.query(
        "update private.profile_publications set payload='{}' where id=$1",
        [live.publicationId],
      ),
    /immutable_publication/,
  );
  const locked = await b.rpc("mutate_profile", {
    kind: "save",
    operation_id: crypto.randomUUID(),
    profile: profile.id,
    expected_revision: profile.revision,
    body: {
      label: profile.label,
      handle: `${prefix}-changed`,
      document: profile.document,
    },
  });
  assert.equal(locked.error?.message, "handle_locked");
  const unpublishId = crypto.randomUUID();
  const unpublished = await mutate(b, "unpublish", profile, {}, unpublishId);
  assert.deepEqual(
    await mutate(b, "unpublish", profile, {}, unpublishId),
    unpublished,
  );
  assert.equal(
    await rpc(admin, "public_profile", { handle: profile.handle }),
    null,
  );
  // Old receipts describe their original result; replay cannot move the live pointer.
  await mutate(b, "publish", { ...profile, revision: 1 }, {}, publishId);
  assert.equal(
    await rpc(admin, "public_profile", { handle: profile.handle }),
    null,
  );
  const republished = await mutate(b, "publish", profile);
  await mutate(b, "unpublish", profile, {}, unpublishId);
  assert.equal(
    (await rpc(admin, "public_profile", { handle: profile.handle }))
      .publicationId,
    republished.publicationId,
  );
  const id = (await rpc(b, "owner_workspace")).ownerId;
  await database.query(
    "update private.accounts set status='suspended' where id=$1",
    [id],
  );
  assert.equal(
    await rpc(admin, "public_profile", { handle: profile.handle }),
    null,
  );
  assert.equal(
    (await b.rpc("read_profile", { profile: profile.id })).error?.message,
    "account_unavailable",
  );
  await database.query(
    "update private.accounts set status='active' where id=$1",
    [id],
  );
});
test("direct RPC validates null enums, malformed URLs and legitimate URL hosts", async () => {
  let profile = await create(a, "validation");
  for (const path of [
    ["appearance", "theme"],
    ["appearance", "layout"],
    ["appearance", "shape"],
    ["blocks", 0, "type"],
  ]) {
    const document = doc();
    if (path.length === 3) document[path[0]][path[1]][path[2]] = null;
    else document[path[0]][path[1]] = null;
    const rejected = await a.rpc("mutate_profile", {
      kind: "save",
      operation_id: crypto.randomUUID(),
      profile: profile.id,
      expected_revision: profile.revision,
      body: { label: profile.label, handle: profile.handle, document },
    });
    assert.equal(rejected.error?.message, "invalid_document");
  }
  for (const url of [
    "https://example.com:99999/",
    "https://%ZZ/",
    "https://[a]/",
    "https://user:pass@example.com/",
    "https://999.999.999.999/",
    "javascript:alert(1)",
  ]) {
    const document = doc();
    document.blocks[0].url = url;
    profile = await mutate(a, "save", profile, {
      label: profile.label,
      handle: profile.handle,
      document,
    });
    const rejected = await a.rpc("mutate_profile", {
      kind: "publish",
      operation_id: crypto.randomUUID(),
      profile: profile.id,
      expected_revision: profile.revision,
    });
    assert.equal(rejected.error?.message, "invalid_visible_link", url);
  }
  const rows = await database.query(
    "select private.valid_url('https://example.com:65535/path') a,private.valid_url('https://[2001:db8::1]/') b,private.valid_url('http://127.0.0.1:3000/') c",
  );
  assert.deepEqual(rows.rows[0], { a: true, b: true, c: true });
});
