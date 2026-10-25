#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

# Fixed runner-owned paths let the always() workflow cleanup handle cancellation too.
: "${RUNNER_TEMP:?Run this script on an ephemeral GitHub Actions runner.}"
work="$RUNNER_TEMP/linky-backup-work"
output="$RUNNER_TEMP/linky-backup-output"
stage='validate backup configuration'
complete=false
cleanup() {
  result=$?
  trap - EXIT
  rm -rf -- "$work"
  if [[ "$complete" != true ]]; then rm -rf -- "$output"; fi
  if (( result != 0 )); then
    printf '::error::Backup failed during: %s. No complete artifact was produced.\n' "$stage"
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

node scripts/backup-storage.mjs validate
for command in git tar gpg; do command -v "$command" > /dev/null; done
[[ ! -e "$work" && ! -e "$output" ]]
mkdir -p "$work/payload/database" "$output"
export BACKUP_STARTED_AT
BACKUP_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME"

stage='create full Git history bundle'
node scripts/backup-storage.mjs bundle "$work/payload" "$work/git-mirror"

# Suppress CLI output: failures can include connection strings or database records.
dump() {
  local filename="$1"
  shift
  stage="export $filename"
  node_modules/.bin/supabase db dump --db-url "$SUPABASE_DB_URL" \
    --file "$work/payload/database/$filename" "$@" > /dev/null 2>&1
  [[ -s "$work/payload/database/$filename" ]]
}
dump roles.sql --role-only
dump schema.sql
dump data.sql --data-only --use-copy \
  --exclude storage.buckets_vectors --exclude storage.vector_indexes
dump history-schema.sql --schema supabase_migrations
dump history-data.sql --schema supabase_migrations --data-only --use-copy

stage='export every profile photo'
node scripts/backup-storage.mjs export "$work/payload"
stage='write and verify integrity manifest'
node scripts/backup-storage.mjs manifest "$work/payload"
node scripts/backup-storage.mjs verify "$work/payload"

stage='encrypt archive'
tar -C "$work" -czf "$work/backup.tar.gz" payload
# GPG reads the passphrase from fd 3; neither arguments nor files contain it.
gpg --batch --yes --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 --compress-algo none \
  --output "$output/backup.tar.gz.gpg.partial" "$work/backup.tar.gz" \
  3<<< "$BACKUP_PASSPHRASE" > /dev/null 2>&1
stage='verify encrypted archive roundtrip'
gpg --batch --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 \
  --decrypt --output "$work/roundtrip.tar.gz" "$output/backup.tar.gz.gpg.partial" \
  3<<< "$BACKUP_PASSPHRASE" > /dev/null 2>&1
cmp -s "$work/backup.tar.gz" "$work/roundtrip.tar.gz"
mv "$output/backup.tar.gz.gpg.partial" "$output/backup.tar.gz.gpg"
complete=true
printf 'Backup complete: verified encrypted archive ready for upload.\n'
