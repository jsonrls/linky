import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, open, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const bucketName = "profile-photos";
const pageSize = 100;
const databaseFiles = [
  "database/roles.sql",
  "database/schema.sql",
  "database/data.sql",
  "database/history-schema.sql",
  "database/history-data.sql",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const objectFile = (key) => `storage/objects/${sha256(key)}.bin`;

export function createRepositoryBundle(repository, mirror, destination) {
  const git = (directory, args) => execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  git(repository, ["rev-parse", "--verify", "HEAD"]);
  if (git(repository, ["rev-parse", "--is-shallow-repository"]) !== "false") {
    throw new Error("Full Git history is required.");
  }
  git(repository, ["clone", "--mirror", "--no-hardlinks", repository, mirror]);
  const refs = git(mirror, ["for-each-ref", "--format=%(objectname) %(refname)", "refs/remotes/origin/"]);
  for (const line of refs.split("\n").filter(Boolean)) {
    const [commit, ref] = line.split(" ");
    const branch = ref.slice("refs/remotes/origin/".length);
    if (branch !== "HEAD") git(mirror, ["update-ref", `refs/heads/${branch}`, commit]);
  }
  git(mirror, ["bundle", "create", destination, "--all"]);
  git(mirror, ["bundle", "verify", destination]);
}

export function validateEnvironment(env) {
  for (const name of ["SUPABASE_DB_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "BACKUP_PASSPHRASE"]) {
    if (!env[name]) throw new Error(`Missing required secret: ${name}`);
  }
  try {
    const api = new URL(env.SUPABASE_URL);
    const db = new URL(env.SUPABASE_DB_URL);
    if (api.protocol !== "https:" || api.username || api.password || api.search || api.hash ||
        !["postgres:", "postgresql:"].includes(db.protocol) || !db.password) throw new Error();
  } catch {
    throw new Error("Invalid Supabase URL or database connection string.");
  }
  if (env.BACKUP_PASSPHRASE.length < 32 || /[\r\n]/.test(env.BACKUP_PASSPHRASE)) {
    throw new Error("BACKUP_PASSPHRASE needs at least 32 characters and no line breaks.");
  }
}

function storageClient(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error("Missing Storage credentials.");
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (url, options = {}) => fetch(url, {
        ...options,
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(60_000)])
          : AbortSignal.timeout(60_000),
      }),
    },
  }).storage.from(bucketName);
}

function validSegment(name) {
  return typeof name === "string" && name.length > 0 && name !== "." && name !== ".." &&
    !/[\/\\\u0000-\u001f\u007f]/.test(name);
}

function validKey(key) {
  return typeof key === "string" && key.split("/").every(validSegment);
}

function cacheSeconds(value) {
  const match = /^(?:max-age=)?([0-9]+)$/i.exec(String(value ?? "3600").trim());
  if (!match || !Number.isSafeInteger(Number(match[1]))) throw new Error("Invalid photo cache lifetime.");
  return String(Number(match[1]));
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
}

export async function exportPhotos(bucket, root) {
  await mkdir(join(root, "storage/objects"), { recursive: true, mode: 0o700 });
  const prefixes = [""];
  const seen = new Set();
  const objects = [];
  let bytes = 0;
  for (let index = 0; index < prefixes.length; index += 1) {
    const prefix = prefixes[index];
    for (let offset = 0; ; offset += pageSize) {
      let result;
      try {
        result = await bucket.list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
      } catch { throw new Error("Photo listing request failed."); }
      if (result.error || !Array.isArray(result.data)) throw new Error("Photo listing failed.");
      for (const entry of result.data) {
        if (!validSegment(entry.name)) throw new Error("Unsafe object name in photo listing.");
        const key = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (seen.has(key)) throw new Error("Duplicate photo listing entry; retry the backup.");
        seen.add(key);
        if (entry.id === null && entry.metadata === null) {
          prefixes.push(key);
          continue;
        }
        const metadata = entry.metadata;
        if (typeof entry.id !== "string" || !metadata || !Number.isSafeInteger(metadata.size) ||
            metadata.size < 0 || typeof metadata.mimetype !== "string" || !metadata.mimetype) {
          throw new Error("Incomplete photo metadata.");
        }
        let downloaded;
        try { downloaded = await bucket.download(key); }
        catch { throw new Error("Photo download request failed."); }
        if (downloaded.error || !downloaded.data) throw new Error("Photo download failed.");
        const content = Buffer.from(await downloaded.data.arrayBuffer());
        if (content.length !== metadata.size) throw new Error("Photo size changed during backup.");
        const file = objectFile(key);
        await writeFile(join(root, file), content, { flag: "wx", mode: 0o600 });
        objects.push({ key, file, bytes: content.length, sha256: sha256(content),
          contentType: metadata.mimetype, cacheControl: cacheSeconds(metadata.cacheControl),
          sourceId: entry.id, sourceCreatedAt: entry.created_at, sourceUpdatedAt: entry.updated_at });
        bytes += content.length;
      }
      if (result.data.length < pageSize) break;
    }
  }
  objects.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const manifest = { formatVersion: 1, bucket: bucketName, count: objects.length, bytes, objects };
  await writeJson(join(root, "storage/manifest.json"), manifest);
  return manifest;
}

async function filesIn(root, prefix = "") {
  const files = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(root, path));
    else if (entry.isFile()) files.push(path);
    else throw new Error("Backup must not contain symlinks or special files.");
  }
  return files.sort();
}

async function digestFile(path) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) { hash.update(chunk); bytes += chunk.length; }
  return { bytes, sha256: hash.digest("hex") };
}

async function photoManifest(root) {
  const manifest = await json(join(root, "storage/manifest.json"));
  if (manifest.formatVersion !== 1 || manifest.bucket !== bucketName || !Array.isArray(manifest.objects)) {
    throw new Error("Unsupported photo manifest.");
  }
  const keys = new Set();
  let bytes = 0;
  for (const object of manifest.objects) {
    if (!validKey(object.key) || keys.has(object.key) || object.file !== objectFile(object.key) ||
        !Number.isSafeInteger(object.bytes) || object.bytes < 0 || !/^[a-f0-9]{64}$/.test(object.sha256) ||
        typeof object.contentType !== "string" || !object.contentType || typeof object.cacheControl !== "string" ||
        object.cacheControl !== cacheSeconds(object.cacheControl)) {
      throw new Error("Invalid photo manifest entry.");
    }
    keys.add(object.key);
    bytes += object.bytes;
  }
  if (manifest.count !== keys.size || manifest.bytes !== bytes) throw new Error("Photo manifest totals do not match.");
  return manifest;
}

export async function createManifest(root, provenance = {}) {
  const photos = await photoManifest(root);
  const files = [];
  for (const path of await filesIn(root)) files.push({ path, ...await digestFile(join(root, path)) });
  const manifest = { formatVersion: 1, ...provenance, completedAt: new Date().toISOString(),
    photoCount: photos.count, photoBytes: photos.bytes, fileCount: files.length, files };
  await writeJson(join(root, "manifest.json"), manifest);
  return manifest;
}

export async function verifyBackup(root) {
  const manifest = await json(join(root, "manifest.json"));
  if (manifest.formatVersion !== 1 || !Array.isArray(manifest.files) || manifest.fileCount !== manifest.files.length) {
    throw new Error("Unsupported backup manifest or file count.");
  }
  const actualFiles = (await filesIn(root)).filter((path) => path !== "manifest.json");
  const expected = new Set();
  for (const file of manifest.files) {
    if (!validKey(file.path) || file.path === "manifest.json" || expected.has(file.path) ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error("Invalid backup manifest entry.");
    }
    expected.add(file.path);
  }
  if (actualFiles.length !== expected.size || actualFiles.some((path) => !expected.has(path))) {
    throw new Error("Backup files do not match the manifest.");
  }
  for (const file of manifest.files) {
    const digest = await digestFile(join(root, file.path));
    if (digest.bytes !== file.bytes || digest.sha256 !== file.sha256) throw new Error("Backup checksum mismatch.");
  }
  for (const path of [...databaseFiles, "repository.bundle", "storage/manifest.json"]) {
    if (!expected.has(path)) throw new Error("Required backup component is missing.");
  }
  const photos = await photoManifest(root);
  if (manifest.photoCount !== photos.count || manifest.photoBytes !== photos.bytes) throw new Error("Backup photo totals do not match.");
  for (const object of photos.objects) {
    const file = manifest.files.find((file) => file.path === object.file);
    if (!file || file.bytes !== object.bytes || file.sha256 !== object.sha256) throw new Error("Photo checksum mismatch.");
  }
  if (actualFiles.length !== databaseFiles.length + 2 + photos.count) throw new Error("Unexpected backup files.");
  return manifest;
}

// Keep original SQL intact in the archive; API uploads must create fresh Storage metadata.
export async function prepareDatabaseRestore(input, output) {
  const target = await open(output, "wx", 0o600);
  const source = createReadStream(input);
  const lines = createInterface({ input: source, crlfDelay: Infinity });
  let inCopy = false;
  let skip = false;
  let storageBlocks = 0;
  try {
    for await (const line of lines) {
      if (!inCopy && /^COPY .* FROM stdin;$/.test(line)) {
        inCopy = true;
        skip = /^COPY "storage"\."objects" \(/.test(line);
        if (skip) storageBlocks += 1;
      }
      if (!skip) await target.writeFile(`${line}\n`);
      if (inCopy && line === "\\.") { inCopy = false; skip = false; }
    }
    if (inCopy || storageBlocks !== 1) throw new Error("Expected one complete storage.objects COPY block.");
  } catch (error) {
    await rm(output, { force: true });
    throw error;
  } finally { lines.close(); source.destroy(); await target.close(); }
}

export async function restorePhotos(bucket, root) {
  await verifyBackup(root);
  const manifest = await photoManifest(root);
  let initial;
  try { initial = await bucket.list("", { limit: 1, offset: 0, sortBy: { column: "name", order: "asc" } }); }
  catch { throw new Error("Destination photo listing failed."); }
  if (initial.error || !Array.isArray(initial.data) || initial.data.length !== 0) {
    throw new Error("Restore requires an empty destination photo bucket.");
  }
  for (const object of manifest.objects) {
    const content = await readFile(join(root, object.file));
    let result;
    try {
      result = await bucket.upload(object.key, content, { contentType: object.contentType,
        cacheControl: object.cacheControl, upsert: false });
    } catch { throw new Error("Photo restore upload request failed."); }
    if (result.error) throw new Error("Photo restore upload failed.");
    let downloaded;
    try { downloaded = await bucket.download(object.key); }
    catch { throw new Error("Restored photo verification request failed."); }
    if (downloaded.error || !downloaded.data || sha256(Buffer.from(await downloaded.data.arrayBuffer())) !== object.sha256) {
      throw new Error("Restored photo checksum mismatch.");
    }
  }
  return manifest.count;
}

async function main() {
  const [command, directory, output] = process.argv.slice(2);
  if (command === "validate") { validateEnvironment(process.env); return; }
  if (!directory) throw new Error("A backup payload directory is required.");
  const root = resolve(directory);
  if (command === "bundle") {
    if (!output) throw new Error("A mirror directory is required.");
    createRepositoryBundle(process.cwd(), resolve(output), join(root, "repository.bundle"));
  } else if (command === "prepare-restore") {
    if (!output) throw new Error("An output SQL path is required.");
    await prepareDatabaseRestore(root, resolve(output));
  } else {
    if (!(await lstat(root)).isDirectory()) throw new Error("A backup directory is required.");
    if (command === "export") await exportPhotos(storageClient(process.env), root);
    else if (command === "manifest") await createManifest(root, {
      startedAt: process.env.BACKUP_STARTED_AT,
      gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      repository: process.env.GITHUB_REPOSITORY,
      runId: process.env.GITHUB_RUN_ID,
    });
    else if (command === "verify") await verifyBackup(root);
    else if (command === "restore") await restorePhotos(storageClient(process.env), root);
    else throw new Error("Unknown backup command.");
  }
  console.log(`Backup ${command} completed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    // Remote errors can contain credentials, object keys or private records.
    console.error("Backup helper failed. Check configuration, service access and backup integrity; remote details are suppressed.");
    process.exitCode = 1;
  });
}
