import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, open, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  createManifest, createRepositoryBundle, exportPhotos, prepareDatabaseRestore,
  restorePhotos, validateEnvironment, verifyBackup,
} from "../scripts/backup-storage.mjs";

async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), "linky-backup-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function fakeBucket(keys) {
  const content = new Map(keys.map((key) => [key, Buffer.from(`photo:${key}`)]));
  const calls = [];
  const uploads = [];
  return {
    calls, uploads, content,
    async list(prefix, options) {
      calls.push({ prefix, ...options });
      const children = new Map();
      for (const [key, bytes] of content) {
        const start = prefix ? `${prefix}/` : "";
        if (!key.startsWith(start)) continue;
        const tail = key.slice(start.length);
        const name = tail.split("/")[0];
        children.set(name, tail.includes("/") ? { name, id: null, metadata: null } : {
          name, id: `id:${key}`, metadata: { size: bytes.length, mimetype: "image/webp", cacheControl: "max-age=7200" },
        });
      }
      const data = [...children.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      return { data: data.slice(options.offset, options.offset + options.limit), error: null };
    },
    async download(key) { return { data: new Blob([content.get(key)]), error: null }; },
    async upload(key, bytes, options) {
      uploads.push({ key, bytes, options });
      content.set(key, bytes);
      return { data: { path: key }, error: null };
    },
  };
}

async function payload(t, keys = ["profile/asset.webp"]) {
  const root = await scratch(t);
  await mkdir(join(root, "database"));
  for (const file of ["roles.sql", "schema.sql", "data.sql", "history-schema.sql", "history-data.sql"]) {
    await writeFile(join(root, "database", file), `-- synthetic ${file}\n`);
  }
  await writeFile(join(root, "repository.bundle"), "synthetic bundle\n");
  const bucket = fakeBucket(keys);
  const photos = await exportPhotos(bucket, root);
  const manifest = await createManifest(root, { gitCommit: "synthetic" });
  return { root, photos, manifest, bucket };
}

test("exports every nested object across pages of files and folders, preserving exact keys and hashes", async (t) => {
  const root = await scratch(t);
  const keys = Array.from({ length: 205 }, (_, i) => `profile/nested/photo-${String(i).padStart(3, "0")}.webp`);
  keys.push(...Array.from({ length: 101 }, (_, i) => `user-${String(i).padStart(3, "0")}/asset.webp`));
  keys.push("profile/space + percent%雪.webp");
  const bucket = fakeBucket(keys);
  const manifest = await exportPhotos(bucket, root);
  assert.equal(manifest.count, keys.length);
  assert.equal(manifest.bytes, [...bucket.content.values()].reduce((sum, bytes) => sum + bytes.length, 0));
  assert.deepEqual(manifest.objects.map((object) => object.key), [...keys].sort());
  for (const object of manifest.objects) {
    const bytes = await readFile(join(root, object.file));
    assert.deepEqual(bytes, bucket.content.get(object.key));
    assert.equal(object.sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.match(object.file, /^storage\/objects\/[a-f0-9]{64}\.bin$/);
  }
  assert.deepEqual(bucket.calls.filter((call) => call.prefix === "profile/nested").map((call) => call.offset), [0, 100, 200]);
  assert.deepEqual(bucket.calls.filter((call) => call.prefix === "").map((call) => call.offset), [0, 100]);
  assert.ok(bucket.calls.every((call) => call.limit === 100 && call.sortBy.column === "name" && call.sortBy.order === "asc"));
});

test("listing and download errors fail without a success manifest or remote secrets", async (t) => {
  for (const operation of ["list", "download"]) {
    const root = await scratch(t);
    const bucket = fakeBucket(["asset.webp"]);
    bucket[operation] = async () => ({ data: null, error: new Error("secret-token-sensitive-response") });
    await assert.rejects(exportPhotos(bucket, root), (error) => !error.message.includes("secret-token") && /failed/.test(error.message));
    await assert.rejects(readFile(join(root, "storage/manifest.json")), { code: "ENOENT" });
  }
});

test("fails on a later listing page and on thrown transport errors", async (t) => {
  const root = await scratch(t);
  const bucket = fakeBucket(Array.from({ length: 100 }, (_, i) => `asset-${i}.webp`));
  const list = bucket.list.bind(bucket);
  bucket.list = async (prefix, options) => options.offset ? { data: null, error: true } : list(prefix, options);
  await assert.rejects(exportPhotos(bucket, root), /listing failed/);
  bucket.list = async () => { throw new Error("private remote error"); };
  await assert.rejects(exportPhotos(bucket, await scratch(t)), /listing request failed/);
});

test("rejects path traversal, unsafe folder entries, duplicate pages and size changes", async (t) => {
  for (const name of ["..", ".", "../escape", "/absolute", "a\\b", "a\nname"]) {
    const root = await scratch(t);
    const bucket = fakeBucket([]);
    bucket.list = async () => ({ data: [{ name, id: null, metadata: null }], error: null });
    await assert.rejects(exportPhotos(bucket, root), /Unsafe object name/);
  }
  const duplicate = fakeBucket(["a.webp"]);
  duplicate.list = async () => ({ data: Array(100).fill({ name: "folder", id: null, metadata: null }), error: null });
  await assert.rejects(exportPhotos(duplicate, await scratch(t)), /Duplicate/);
  const changed = fakeBucket(["a.webp"]);
  changed.download = async () => ({ data: new Blob(["changed"]), error: null });
  await assert.rejects(exportPhotos(changed, await scratch(t)), /size changed/);
});

test("verifies checksums and totals; rejects changed, missing, extra and symlinked files", async (t) => {
  const valid = await payload(t);
  assert.equal((await verifyBackup(valid.root)).photoCount, 1);
  assert.equal(valid.manifest.fileCount, 8);
  await writeFile(join(valid.root, valid.photos.objects[0].file), "corrupt");
  await assert.rejects(verifyBackup(valid.root), /checksum mismatch/);
  const missing = await payload(t);
  await rm(join(missing.root, "database/data.sql"));
  await assert.rejects(verifyBackup(missing.root), /files do not match/);
  const extra = await payload(t);
  await writeFile(join(extra.root, "unexpected"), "extra");
  await assert.rejects(verifyBackup(extra.root), /files do not match/);
  const linked = await payload(t);
  await symlink("database/data.sql", join(linked.root, "link"));
  await assert.rejects(verifyBackup(linked.root), /symlinks/);
  const totals = await payload(t);
  totals.manifest.photoCount += 1;
  await writeFile(join(totals.root, "manifest.json"), JSON.stringify(totals.manifest));
  await assert.rejects(verifyBackup(totals.root), /totals do not match/);
});

test("rejects manifest traversal and photo count mismatches", async (t) => {
  const fixture = await payload(t);
  fixture.manifest.files[0].path = "../escape";
  await writeFile(join(fixture.root, "manifest.json"), JSON.stringify(fixture.manifest));
  await assert.rejects(verifyBackup(fixture.root), /Invalid backup manifest/);
  const root = await scratch(t);
  await exportPhotos(fakeBucket([]), root);
  const path = join(root, "storage/manifest.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest.count = 1;
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(createManifest(root), /totals do not match/);
});

test("restore uploads exact keys and MIME without upsert and verifies downloaded bytes", async (t) => {
  const fixture = await payload(t, ["profile/space + 雪.webp", "other/nested/asset.webp"]);
  const destination = fakeBucket([]);
  assert.equal(await restorePhotos(destination, fixture.root), 2);
  assert.deepEqual(destination.uploads.map((upload) => upload.key), fixture.photos.objects.map((object) => object.key));
  assert.ok(destination.uploads.every((upload) => upload.options.contentType === "image/webp" &&
    upload.options.cacheControl === "7200" && upload.options.upsert === false));
  await assert.rejects(restorePhotos(destination, fixture.root), /empty destination/);
  const broken = fakeBucket([]);
  broken.upload = async () => ({ error: new Error("private response") });
  await assert.rejects(restorePhotos(broken, fixture.root), /upload failed/);
  const corrupt = fakeBucket([]);
  corrupt.download = async () => ({ data: new Blob(["corrupt"]), error: null });
  await assert.rejects(restorePhotos(corrupt, fixture.root), /checksum mismatch/);
});

test("real Storage list cache headers become valid SDK upload headers", async (t) => {
  const fixture = await payload(t);
  let cacheHeader;
  const client = createClient("https://example.supabase.co", "fake-server-secret", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (_url, options) => {
      cacheHeader = new Headers(options.headers).get("cache-control");
      return new Response(JSON.stringify({ Id: "fixture", Key: "profile-photos/profile/asset.webp" }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    } },
  });
  const object = fixture.photos.objects[0];
  const result = await client.storage.from("profile-photos").upload(object.key,
    await readFile(join(fixture.root, object.file)), {
      contentType: object.contentType, cacheControl: object.cacheControl, upsert: false,
    });
  assert.equal(result.error, null);
  assert.equal(cacheHeader, "max-age=7200");
});

test("restore SQL omits only storage.objects COPY and preserves SQL-looking application data", async (t) => {
  const root = await scratch(t);
  const input = join(root, "data.sql");
  const output = join(root, "restore.sql");
  const before = 'SET session_replication_role = replica;\nCOPY "private"."documents" ("text") FROM stdin;\nCOPY "storage"."objects" ("id") FROM stdin;\n\\.\n';
  const objects = 'COPY "storage"."objects" ("id", "name") FROM stdin;\nid\tphoto.webp\n\\.\n';
  const after = 'COPY "storage"."buckets" ("id") FROM stdin;\nprofile-photos\n\\.\nRESET ALL;\n';
  await writeFile(input, before + objects + after);
  await prepareDatabaseRestore(input, output);
  assert.equal(await readFile(output, "utf8"), before + after);
  assert.equal(await readFile(input, "utf8"), before + objects + after);
  await assert.rejects(prepareDatabaseRestore(input, output), { code: "EEXIST" });
  await writeFile(input, objects.slice(0, -3));
  await assert.rejects(prepareDatabaseRestore(input, join(root, "truncated.sql")), /complete/);
  await assert.rejects(readFile(join(root, "truncated.sql")), { code: "ENOENT" });
});

test("restore SQL source, destination and mid-write errors reject and remove partial output", async (t) => {
  const root = await scratch(t);
  const output = join(root, "restore.sql");
  await assert.rejects(prepareDatabaseRestore(join(root, "missing.sql"), output), { code: "ENOENT" });
  await assert.rejects(readFile(output), { code: "ENOENT" });
  await assert.rejects(prepareDatabaseRestore(root, output), { code: "EISDIR" });
  await assert.rejects(readFile(output), { code: "ENOENT" });
  const input = join(root, "data.sql");
  await writeFile(input, '-- first line\n-- second line\nCOPY "storage"."objects" ("id") FROM stdin;\n\\.\n');
  await assert.rejects(prepareDatabaseRestore(input, join(root, "missing-directory/output.sql")), { code: "ENOENT" });
  const handle = await open(join(root, "handle"), "w");
  const prototype = Object.getPrototypeOf(handle);
  await handle.close();
  const original = prototype.writeFile;
  let writes = 0;
  t.mock.method(prototype, "writeFile", async function (...args) {
    writes += 1;
    if (writes === 2) throw Object.assign(new Error("synthetic disk failure"), { code: "EIO" });
    return original.apply(this, args);
  });
  await assert.rejects(prepareDatabaseRestore(input, output), { code: "EIO" });
  assert.equal(writes, 2);
  await assert.rejects(readFile(output), { code: "ENOENT" });
});

test("bundle restores full history, remote-only branches and tags without repository credentials", async (t) => {
  const root = await scratch(t);
  const source = join(root, "source");
  const checkout = join(root, "checkout");
  const restored = join(root, "restored");
  await mkdir(source);
  const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git(source, "init", "--initial-branch=main");
  git(source, "config", "user.name", "Backup Fixture");
  git(source, "config", "user.email", "backup-fixture@example.invalid");
  await writeFile(join(source, "file"), "main");
  git(source, "add", "file");
  git(source, "commit", "-m", "fixture main");
  const main = git(source, "rev-parse", "HEAD");
  git(source, "tag", "v1-fixture");
  git(source, "checkout", "-b", "feature/nested");
  await writeFile(join(source, "file"), "feature");
  git(source, "commit", "-am", "fixture feature");
  const feature = git(source, "rev-parse", "HEAD");
  git(source, "checkout", "main");
  git(root, "clone", source, checkout);
  git(checkout, "config", "http.extraheader", "AUTHORIZATION: bearer fake-token-not-for-bundle");
  assert.equal(git(checkout, "branch", "--list", "feature/nested"), "");
  const bundle = join(root, "repository.bundle");
  createRepositoryBundle(checkout, join(root, "mirror"), bundle);
  git(root, "clone", bundle, restored);
  assert.equal(git(restored, "rev-parse", "HEAD"), main);
  assert.equal(git(restored, "rev-parse", "origin/feature/nested"), feature);
  assert.equal(git(restored, "rev-parse", "v1-fixture"), main);
  assert.equal(git(restored, "rev-list", "--all", "--count"), "2");
  assert.ok(!(await readFile(bundle)).includes(Buffer.from("fake-token-not-for-bundle")));
  git(restored, "fsck", "--full");
});

test("configuration failures do not expose secrets and shell cleanup leaves no plaintext or artifact", async (t) => {
  const env = { SUPABASE_DB_URL: "postgresql://user:secret@db.example.invalid/postgres", SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "secret-service-key", BACKUP_PASSPHRASE: "x".repeat(40) };
  validateEnvironment(env);
  assert.throws(() => validateEnvironment({ ...env, BACKUP_PASSPHRASE: "short" }), /32 characters/);
  assert.throws(() => validateEnvironment({ ...env, SUPABASE_DB_URL: "secret-invalid-url" }), (error) => !error.message.includes("secret-invalid"));
  const root = await scratch(t);
  const result = spawnSync("bash", ["scripts/backup.sh"], { encoding: "utf8", env: {
    ...process.env, RUNNER_TEMP: root, SUPABASE_DB_URL: "", SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", BACKUP_PASSPHRASE: "",
  } });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /No complete artifact/);
  await assert.rejects(readFile(join(root, "linky-backup-output/backup.tar.gz.gpg")), { code: "ENOENT" });
});
