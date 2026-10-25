import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { profileTemplates } from "../../src/features/profiles/templates.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  !url?.startsWith("http://127.0.0.1:") ||
  !process.env.TEST_DATABASE_URL?.includes("@127.0.0.1:")
) {
  throw new Error(
    "Template integration tests require explicitly configured localhost Supabase.",
  );
}
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const database = new pg.Client({
  connectionString: process.env.TEST_DATABASE_URL,
});
const prefix = `tpl-${crypto.randomUUID().slice(0, 8)}`;
let ownerId, client;

before(async () => {
  await database.connect();
  const email = `${prefix}@example.test`;
  const password = `Local-test-${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  ownerId = created.data.user.id;
  client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.ifError(
    (await client.auth.signInWithPassword({ email, password })).error,
  );
});
after(async () => {
  if (ownerId)
    assert.ifError((await admin.auth.admin.deleteUser(ownerId)).error);
  await database.end();
});

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  assert.ifError(error);
  return data;
}
async function mutate(
  kind,
  profile,
  body = {},
  operationId = crypto.randomUUID(),
) {
  return rpc(client, "mutate_profile", {
    kind,
    operation_id: operationId,
    ...(profile
      ? { profile: profile.id, expected_revision: profile.revision }
      : {}),
    body,
  });
}
async function save(profile, document) {
  return mutate("save", profile, {
    label: profile.label,
    handle: profile.handle,
    document,
  });
}
async function live(profile) {
  return rpc(admin, "public_profile", { handle: profile.handle });
}
function document() {
  return {
    schemaVersion: 1,
    name: "Template owner",
    bio: "Template biography",
    appearance: { theme: "warm", layout: "editorial", shape: "soft" },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "link",
        visible: true,
        label: "GitHub",
        url: "https://github.com/example",
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        visible: true,
        text: "Selected work",
      },
      {
        id: crypto.randomUUID(),
        type: "link",
        visible: true,
        label: "Portfolio",
        url: "https://example.com",
      },
      {
        id: crypto.randomUUID(),
        type: "link",
        visible: false,
        label: "",
        url: "",
        imageUrl: "unfinished private image",
      },
    ],
  };
}

test("optional media blank handling accepts only ordinary-space emptiness while hidden images stay private", async () => {
  let profile = await mutate("create", null, {
    label: "Media parity draft",
    name: "Media parity owner",
    handle: `${prefix}-parity`,
  });
  for (const { name, value, invalid } of [
    { name: "empty", value: "", invalid: false },
    { name: "ordinary spaces", value: "   ", invalid: false },
    { name: "tab", value: "\t", invalid: true },
    { name: "NBSP", value: "\u00a0", invalid: true },
  ]) {
    for (const field of ["avatarUrl", "coverUrl", "imageUrl"]) {
      const draft = document();
      if (field === "imageUrl") draft.blocks[0].imageUrl = value;
      else draft.appearance[field] = value;
      profile = await save(profile, draft);
      assert.deepEqual(
        (await rpc(client, "read_profile", { profile: profile.id })).document,
        draft,
      );
      if (invalid) {
        const result = await client.rpc("mutate_profile", {
          kind: "publish",
          operation_id: crypto.randomUUID(),
          profile: profile.id,
          expected_revision: profile.revision,
        });
        assert.equal(
          result.error?.message,
          "invalid_media_url",
          `${field}: ${name}`,
        );
      } else {
        profile = await mutate("publish", profile);
        assert.deepEqual((await live(profile)).document, {
          ...draft,
          blocks: draft.blocks.filter((block) => block.visible),
        });
      }
    }
    const hidden = document();
    hidden.blocks[3].imageUrl = value;
    profile = await save(profile, hidden);
    profile = await mutate("publish", profile);
    assert.deepEqual((await live(profile)).document, {
      ...hidden,
      blocks: hidden.blocks.filter((block) => block.visible),
    });
  }
  await mutate("unpublish", profile);
});

test("legacy absence and explicit original roundtrip without normalization", async () => {
  let profile = await mutate("create", null, {
    label: "Legacy draft",
    name: "Legacy owner",
    handle: `${prefix}-legacy`,
  });
  assert.deepEqual(profile.document.appearance, {
    theme: "warm",
    layout: "editorial",
    shape: "soft",
  });
  const legacy = document();
  delete legacy.blocks[3].imageUrl;
  profile = await save(profile, legacy);
  assert.deepEqual(
    (await rpc(client, "read_profile", { profile: profile.id })).document,
    legacy,
  );
  profile = await mutate("publish", profile);
  assert.deepEqual((await live(profile)).document, {
    ...legacy,
    blocks: legacy.blocks.filter((block) => block.visible),
  });
  const original = {
    ...legacy,
    appearance: { ...legacy.appearance, template: "original" },
  };
  profile = await save(profile, original);
  assert.deepEqual(profile.document, original);
  profile = await save(profile, legacy);
  assert.deepEqual(profile.document, legacy);
  assert.ok(!("template" in profile.document.appearance));
});

test("all 20 templates publish media in order and preserve immutable older snapshots and retry semantics", async () => {
  let profile = await mutate("create", null, {
    label: "Template draft",
    name: "Template owner",
    handle: `${prefix}-catalog`,
  });
  let firstPublication;
  for (const { id } of profileTemplates) {
    const draft = document();
    draft.appearance = {
      ...draft.appearance,
      template: id,
      avatarUrl: "https://example.com/avatar.jpg",
      coverUrl: "https://example.com/cover.jpg",
    };
    draft.blocks[0].imageUrl = `https://example.com/${id}.jpg`;
    const beforeSave = profile;
    const saveId = crypto.randomUUID();
    const body = {
      label: profile.label,
      handle: profile.handle,
      document: draft,
    };
    profile = await mutate("save", profile, body, saveId);
    assert.deepEqual(await mutate("save", beforeSave, body, saveId), profile);
    assert.deepEqual(
      (await rpc(client, "read_profile", { profile: profile.id })).document,
      draft,
    );
    const publishId = crypto.randomUUID();
    const published = await mutate("publish", profile, {}, publishId);
    assert.deepEqual(
      await mutate("publish", profile, {}, publishId),
      published,
    );
    profile = published;
    const current = await live(profile);
    assert.deepEqual(
      current.document,
      { ...draft, blocks: draft.blocks.filter((block) => block.visible) },
      id,
    );
    assert.ok(!("imageUrl" in current.document.blocks[2]));
    if (!firstPublication) firstPublication = current;
  }
  const previous = await database.query(
    "select payload from private.profile_publications where id=$1",
    [firstPublication.publicationId],
  );
  assert.deepEqual(previous.rows[0].payload, firstPublication.document);
  await assert.rejects(
    () =>
      database.query(
        "update private.profile_publications set payload='{}' where id=$1",
        [firstPublication.publicationId],
      ),
    /immutable_publication/,
  );

  const goodPublication = await live(profile);
  for (const field of ["avatarUrl", "coverUrl", "imageUrl"]) {
    const draft = document();
    if (field === "imageUrl")
      draft.blocks[0].imageUrl = "http://example.com/image.jpg";
    else draft.appearance[field] = "https://user:pass@example.com/image.jpg";
    profile = await save(profile, draft);
    assert.deepEqual(
      (await rpc(client, "read_profile", { profile: profile.id })).document,
      draft,
    );
    const rejected = await client.rpc("mutate_profile", {
      kind: "publish",
      operation_id: crypto.randomUUID(),
      profile: profile.id,
      expected_revision: profile.revision,
    });
    assert.equal(rejected.error?.message, "invalid_media_url", field);
    assert.deepEqual(await live(profile), goodPublication);
  }
  const empty = document();
  empty.appearance.avatarUrl = "";
  empty.appearance.coverUrl = "";
  empty.blocks[0].imageUrl = "";
  profile = await save(profile, empty);
  profile = await mutate("publish", profile);
  assert.deepEqual((await live(profile)).document, {
    ...empty,
    blocks: empty.blocks.filter((block) => block.visible),
  });
});

test("direct RPC rejects unknown templates and invalid optional types without changing the draft", async () => {
  const profile = await mutate("create", null, {
    label: "Validation draft",
    name: "Validation owner",
    handle: `${prefix}-validation`,
  });
  for (const fields of [
    { template: "unknown" },
    { template: null },
    { avatarUrl: null },
    { coverUrl: [] },
    { avatarUrl: "x".repeat(2049) },
  ]) {
    const draft = document();
    Object.assign(draft.appearance, fields);
    const rejected = await client.rpc("mutate_profile", {
      kind: "save",
      operation_id: crypto.randomUUID(),
      profile: profile.id,
      expected_revision: profile.revision,
      body: { label: profile.label, handle: profile.handle, document: draft },
    });
    assert.equal(rejected.error?.message, "invalid_document");
  }
  const draft = document();
  draft.blocks[0].imageUrl = null;
  const rejected = await client.rpc("mutate_profile", {
    kind: "save",
    operation_id: crypto.randomUUID(),
    profile: profile.id,
    expected_revision: profile.revision,
    body: { label: profile.label, handle: profile.handle, document: draft },
  });
  assert.equal(rejected.error?.message, "invalid_document");
  assert.deepEqual(
    await rpc(client, "read_profile", { profile: profile.id }),
    profile,
  );
});
