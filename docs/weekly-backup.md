# Weekly encrypted backup

`weekly-backup.yml` runs on Mondays at **01:17 UTC / 09:17 Asia/Manila**, and from Actions → Weekly encrypted backup → Run workflow on the default branch. Other branches are skipped. It never runs on pull requests. A run has a 60-minute limit; concurrent backups queue instead of cancelling an active export.

## Enable it

This checkout currently has no commits or GitHub remote. The workflow becomes usable after the project is committed and uploaded to a GitHub repository, with this workflow on its default branch. These setup actions are separate from adding the backup files.

Add four **Actions repository secrets** under Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Production project's **Session pooler**, port **5432**, PostgreSQL connection string from Dashboard → Connect. Percent-encode the database password. Session mode supports IPv4 GitHub runners; do not use transaction mode on 6543. |
| `SUPABASE_URL` | The same project's HTTPS API URL, such as `https://PROJECT.supabase.co`. |
| `SUPABASE_SECRET_KEY` | That project's server secret key (`sb_secret_…`), or its legacy `service_role` key. This can read the private photo bucket. Never use a publishable/anon key. |
| `BACKUP_PASSPHRASE` | A randomly generated passphrase of at least 32 characters, without line breaks. |

Store the passphrase in a password manager **separately from GitHub**, retaining old passphrases while their backups exist. Losing it makes recovery impossible. No Supabase access token is needed. The workflow's GitHub token has only `contents: read`; artifact upload uses GitHub's artifact service credentials. Missing secrets fail before checkout or dependency installation.

Enable Actions and ensure repository/organization artifact retention allows **90 days**. Run a manual backup after setup, check that the run succeeded, download its single artifact, and rehearse the restore below on a new disposable project before relying on it. No live backup or restore was run during implementation.

## Contents and guarantees

Each successful run uploads one `weekly-backup-RUN_ID-ATTEMPT` artifact containing only `backup.tar.gz.gpg`. It is GPG symmetric AES256 encrypted, decrypted and byte-compared locally before upload. Retention is requested for 90 days. A failure in any export, hash check or encryption step prevents upload. Plaintext SQL, photos, archive and GPG working files are removed on exit, with an additional always-run workflow cleanup. Use GitHub-hosted ephemeral runners; cancellation/host loss can prevent cleanup commands from running.

The decrypted archive contains `payload/` with:

- `repository.bundle`: full reachable Git history, branches and tags. Remote-tracking branches from the full checkout are also made ordinary branches in a temporary mirror, so a normal clone recovers them. It contains Git objects and refs, without the checkout's `.git/config` or authentication headers.
- `database/roles.sql`, `schema.sql`, `data.sql`: Supabase CLI logical exports. Data includes application, Auth and Storage records; the managed schemas' definitions and platform migration tables are intentionally omitted by the CLI. Unused Storage vector tables are excluded following Supabase's guide; Linky does not use vectors.
- `database/history-schema.sql`, `history-data.sql`: explicit `supabase_migrations` history exports.
- `storage/manifest.json` and `storage/objects/*.bin`: every recursively listed `profile-photos` object, paginated in name order, exact original key, MIME type, cache lifetime, source timestamps/ID, byte count and SHA-256. Disk filenames are hashes of keys, not user-controlled paths.
- `manifest.json`: provenance, export window, every payload file's size and SHA-256, and photo counts/bytes. It excludes its own hash; GPG provides encrypted-message integrity.

The database is dumped **before** photos are listed/downloaded. Linky currently uploads photos before saving their document references, never overwrites them, and has no delete flow. Thus later uploads may be harmless extras. This is **not an atomic cross-service snapshot**: the separate SQL dumps also use separate snapshots. Concurrent schema changes, future object deletion/upsert, or out-of-band writes can break consistency; pause writes for an exact recovery point and revisit this workflow when those behaviors change.

Git backups cover committed reachable history, including any secrets accidentally committed in the past. Uncommitted/untracked/ignored files, Git LFS bytes, submodule repository contents, external image URLs, other Storage buckets, hosted Edge Function deployments, Dashboard Auth/API/SMTP settings, environment secrets, encryption root keys and other external service configuration are not included. Keep required configuration and credentials in your password manager/infrastructure records. Review backup scope when adding services or buckets.

GitHub schedules may be delayed or dropped; inactive public repositories can have schedules disabled. Monitor failed/missing weekly runs and artifact storage usage. The archive shares GitHub's account/repository failure domain: repository deletion or loss of GitHub access may also lose the backups. Download encrypted copies to separately controlled storage if that failure must be covered. See [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [artifact retention](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).

## Restore: decrypt, verify and recover Git

Use Bash, GPG, Git, Node 24 and PostgreSQL 17 `psql` on a trusted machine with enough private disk space. Download/unzip the successful run's artifact into an empty recovery directory, then:

```bash
umask 077
read -r -s -p 'Backup passphrase: ' BACKUP_PASSPHRASE; printf '\n'
gpg --batch --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 \
  --decrypt --output backup.tar.gz backup.tar.gz.gpg 3<<< "$BACKUP_PASSPHRASE"
unset BACKUP_PASSPHRASE
tar -xzf backup.tar.gz
export BACKUP="$(pwd)/payload"
git clone "$BACKUP/repository.bundle" linky-restored
cd linky-restored
git bundle verify "$BACKUP/repository.bundle"
git fsck --full
git branch -a
git tag --list
npm ci
node scripts/backup-storage.mjs verify "$BACKUP"
```

Stop on any decryption, Git or checksum error. Compare `manifest.json`'s commit/run/export times with the desired recovery point. Clone checks out the bundle's default branch; other branches appear as `origin/BRANCH` and are available via `git switch --track origin/BRANCH`. Tags are restored too. The bundle has no GitHub remote credentials; configure a new remote separately when authorized. Do not put decrypted backups in the restored repository.

## Restore: database and private photo bytes

Create a **new empty Supabase project**, using compatible Postgres 17 and Auth/Storage versions. Keep the app offline until verification finishes. Enable any required extensions first. Do not apply the app migrations before restoring schema, or run complete old migrations afterward: they duplicate tables/functions/bucket inserts. Dashboard settings, keys, site/redirect URLs, SMTP and Auth templates must be configured separately from the recovered Git configuration.

The default schema export omits `auth` and `storage` definitions because Supabase provisions them. For this revision, the only application-owned customization on those schemas is the restrictive photo policy shown below. If the source later adds managed-schema policies/triggers, add their definitions to the backup and restore procedure before relying on it. See [Supabase's backup/restore guide and managed-schema considerations](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Set libpq environment variables for the **destination** session-pooler connection; read the password without putting it in shell history:

```bash
export PGHOST='aws-REGION.pooler.supabase.com' PGPORT=5432
export PGUSER='postgres.DESTINATION_PROJECT_REF' PGDATABASE=postgres PGSSLMODE=require
read -r -s -p 'Destination database password: ' PGPASSWORD; printf '\n'
export PGPASSWORD
export RESTORE_SQL="$(dirname "$BACKUP")/data-for-restore.sql"
node scripts/backup-storage.mjs prepare-restore "$BACKUP/database/data.sql" "$RESTORE_SQL"
psql -X --single-transaction --variable ON_ERROR_STOP=1 \
  --file "$BACKUP/database/roles.sql" \
  --file "$BACKUP/database/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$RESTORE_SQL"
psql -X --single-transaction --variable ON_ERROR_STOP=1 \
  --file "$BACKUP/database/history-schema.sql" \
  --file "$BACKUP/database/history-data.sql"
```

`data.sql` is preserved intact, including original `storage.objects` rows. `prepare-restore` writes a separate SQL file omitting **only** that table's COPY block, leaving bucket rows and application/Auth data intact. Uploading files then creates destination object metadata tied to real bytes. Do not import the original object rows afterward: they contain source backend versions/IDs and can leave phantom objects. Exact object keys, MIME and bytes are preserved; object IDs/timestamps and backend metadata are regenerated. Linky references keys, not Storage row IDs. Original metadata remains recoverable in the SQL archive. Keep derived SQL outside `payload/` so integrity verification remains valid.

If any SQL command fails, stop and inspect the destination privately; do not ignore errors or repeat a partial restore into an existing database. The current app has no custom login roles. If future roles require passwords, reset them separately. Supabase's linked guide describes provider role/ownership incompatibilities that may require reviewing the SQL on a private copy.

Recreate the policy from `supabase/migrations/20261024010143_profile_photos.sql` alone, and verify that the restored bucket is private:

```bash
psql -X --single-transaction --variable ON_ERROR_STOP=1 <<'SQL'
create policy profile_photos_server_only on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'profile-photos') with check (bucket_id <> 'profile-photos');
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'profile-photos';
select policyname, permissive, roles, qual, with_check
from pg_policies where schemaname = 'storage' and policyname = 'profile_photos_server_only';
select count(*) as objects_before_upload from storage.objects where bucket_id = 'profile-photos';
SQL
```

Expect `public = false`, limit `3145728`, MIME `{image/webp}`, a `RESTRICTIVE` policy for `anon,authenticated`, and zero object rows. The bucket row comes from the data export, so do not recreate it with the full migration.

Set the **destination** Storage API URL and server secret in your terminal, then upload:

```bash
export SUPABASE_URL='https://DESTINATION_PROJECT_REF.supabase.co'
read -r -s -p 'Destination server secret: ' SUPABASE_SECRET_KEY; printf '\n'
export SUPABASE_SECRET_KEY
node scripts/backup-storage.mjs restore "$BACKUP"
unset SUPABASE_SECRET_KEY PGPASSWORD
```

The restore helper verifies the whole manifest before writing, requires an empty destination bucket, uploads every file at its exact key with recorded MIME/cache lifetime and `upsert: false`, then downloads each upload and verifies SHA-256. It does not overwrite existing files. If an upload fails partway, keep the app offline and restart recovery in a fresh disposable project; the helper intentionally refuses a partially populated bucket.

Before cutover, compare the destination's `storage.objects` count with `photoCount` in `manifest.json`, check private account/profile/draft/publication counts against the restored SQL, and verify sign-in, draft reads, published pages and their photos. Confirm anonymous direct bucket reads remain denied and the application photo route still enforces publication/owner access. Review restored migration history before applying only newer migrations. Update app credentials only after those checks. Securely remove decrypted recovery files when finished; retain the encrypted archive and its separately stored passphrase.

## Local checks

```bash
node --test tests/backup.test.mjs
npx --no-install eslint scripts/backup-storage.mjs tests/backup.test.mjs
bash -n scripts/backup.sh
actionlint .github/workflows/weekly-backup.yml
```

Tests use fake Storage clients and temporary Git fixtures, including more than 100 nested objects/folders, failure paths, traversal, checksums/counts, exact-key restore, COPY filtering, and recovery of a remote-only second branch/tag. They never connect to the user's Supabase database. A real GitHub run and disposable Supabase restore rehearsal are still required after setup.
