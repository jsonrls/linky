# Linky: milestone one

A Next.js 16 / TypeScript application with real Supabase email OTP, multiple owner profiles, private link and plain-text drafts, and immutable published pages at `/@handle`. The approved Warm Editorial prototype informs the interface. Existing `docs/` and `plan/` sources are reference material; later milestones are not implemented.

## Local setup

Use Node **24.22.1 LTS** (`.nvmrc`, `engines: 24.x`) and Docker. Dependencies and Supabase CLI **2.121.0** are exact versions in `package-lock.json`. Do not use a global Supabase CLI or select a remote project for local setup.

```sh
nvm use
npm ci
npm run db:start
npm run local:env
npm run dev
```

On a Node 25 host, keep global Node unchanged and run commands through the task-local LTS:

```sh
npx --yes --package=node@24.22.1 -c 'npm ci'
npx --yes --package=node@24.22.1 -c 'npm run db:start'
npx --yes --package=node@24.22.1 -c 'npm run local:env'
npx --yes --package=node@24.22.1 -c 'npm run dev'
```

The setup helper writes `.env.local` with local keys, mode `0600`, and refuses to overwrite an existing file. `.env.example` documents every variable. Open **http://127.0.0.1:3000/login**, send a code, then read it in **http://127.0.0.1:54324** (Mailpit). Paste the six digits into `/auth/verify`. This uses real GoTrue email OTP; no magic-link redirect or mock authentication is involved. Studio is on port 54323 and Postgres on 54322.

Use the configured canonical origin exactly. `localhost:3000` and `127.0.0.1:3000` are different origins. Requests must match both `APP_ORIGIN` and its Host; untrusted forwarded headers do not establish an allowed origin. Each preview environment requires its own explicit `APP_ORIGIN`.

The repository's `supabase/config.toml` exposes only `public` RPC wrappers. It enables confirmations and code templates containing `{{ .Token }}` for both signup and returning-user emails. Codes expire after one hour; resend frequency is 60 seconds. UI cooldowns match that config. Local email rate limits support isolated test accounts; production delivery limits and SMTP must be configured separately.

`npm run db:stop` stops only this project's stack and preserves its volumes. `npm run db:reset` **destroys this project's local data**, reapplies migrations and seed, and is for an explicitly disposable database. Do not reset while another reviewer uses the app. Unrelated containers must remain untouched.

### Runtime troubleshooting

The first start downloads several images and can run while source work continues. On the implementation host, the Kong ARM image had an empty `/etc/passwd` and could not start. Pulling the same upstream Kong image for AMD64 and starting with `DOCKER_DEFAULT_PLATFORM=linux/amd64 npm run db:start` worked. This is a host image workaround, not an application requirement.

Supabase CLI uses standard Docker port bindings on all host interfaces. The application binds `127.0.0.1`, and this setup uses localhost URLs for every service. No global Docker, network or firewall settings were changed, and no remote project was selected or provisioned.

## Code and data boundaries

- `src/app/` contains framework routes and shared layouts. `/app/profiles` lists summaries; selecting a profile fetches that draft alone. Failed workspace loading has an error state rather than an empty list.
- `src/features/auth/` handles the shared OTP flow. Next `proxy.ts` refreshes request and response cookies with `@supabase/ssr`; server authorization trusts `getClaims()`, never a client-supplied owner ID or `getSession()`.
- `src/features/profiles/` defines explicit document contracts and server reads. `src/features/editor/` owns autosave, pending operation receipts, conflict recovery and publication confirmation. Unsaved content stays mounted during reauthentication; Copy unsaved work includes all editable fields and offers selectable text when clipboard access fails.
- `src/features/public-profile/ProfileRenderer.tsx` renders both private preview and public snapshots. Plain text is escaped by React. Public links allow only HTTP(S), ASCII DNS names, IPv4 or bracketed IPv6, ports 1–65535, and no credentials. Direct RPC publication repeats validation in Postgres.
- `supabase/migrations/` owns all domain tables in the unexposed `private` schema. RLS is defense in depth; browser roles have no table privileges. Narrow invoker wrappers call fixed-search-path definer functions that require a verified `auth.uid()` and an active account. The public lookup RPC is server-only.

Every mutation locks the account before profiles, checks an exact request ID, then checks its expected revision. The account lock serializes slot counts. Reusing an ID with a different body fails; replaying a historical receipt never changes current state. Creation reserves handles atomically. A handle freezes on its first publication, including while unpublished. Accounts default to 30 total profiles and two published profiles.

Publication snapshots contain only allowlisted public document fields and visible blocks. Draft changes never modify a snapshot; unpublish clears the current pointer and frees the slot. Public lookup also checks current account status. Metadata and HTML share the same request-scoped snapshot read; there is no persistent public, draft or session cache. Metadata streaming is disabled so neutral not-found responses can return real HTTP 404 before rendering begins. Both encoded and decoded `@` route parameters are supported.

## Profile photos

Appearance → Profile images includes an optional device photo picker, replacement, draft removal with Undo, and a collapsed HTTPS image URL alternative. JPEG, PNG and still WebP files up to **3 MiB** (shown as 3 MB) and **20 million decoded pixels** are accepted. The server checks the claimed type, signature and complete decode, rejects animations and unsupported formats, applies EXIF orientation, resizes inside 1024 × 1024 without enlarging, and re-encodes to WebP with metadata removed. Sharp **0.35.5** is pinned as a direct runtime dependency; deploy using the Node runtime with its platform-specific Sharp packages installed.

Uploads authenticate an active owner through `read_profile` before reading file bytes. Both Origin and Host must match `APP_ORIGIN`; uploads use a bounded binary POST to `/api/profiles/{profileUuid}/photo`. Objects have unique immutable keys in the **private** `profile-photos` bucket and are never upserted. Browser Storage reads and writes are denied, including for owners. The server-only service credential performs Storage operations after application authorization.

Only `appearance.avatarUrl` accepts the exact managed relative path `/api/profile-photos/{canonicalLowercaseProfileUuid}/{canonicalLowercaseAssetUuid}` in addition to existing HTTPS URLs. Cover and link images still require HTTPS. The image route checks the permission RPC before downloading: an active owner can read their profile's assets, and anyone can read the exact avatar referenced by that profile's current publication. All image responses, including missing or unauthorized requests, use `private, no-store` and `nosniff`. Private or invalid requests return 404, with no login redirect. A draft replacement leaves the old published photo accessible until republishing; republishing revokes public access to the old photo, and unpublishing revokes access to the current photo. A suspended account's assets are inaccessible through this route.

For an existing local database, enable Storage using the checked-in config, stop and restart only this project's stack with volumes preserved, then apply the forward migration:

```sh
npx supabase stop --project-id linky
npx supabase start
npx supabase migration up --local
```

Do not reset a database containing work. For a separately authorized deployment, enable Storage and apply `20261024010143_profile_photos.sql` through the target's reviewed migration workflow before enabling uploads. The migration creates the private bucket, restrictive browser policy, exact avatar validator and permission RPC. Keep the service credential server-only and preserve the RPC's explicit grants. Existing documents and immutable publication payloads are not rewritten.

MVP retention is deliberate: removed photos, replaced historical photos, abandoned uploads and uploads whose response was lost remain stored. There is **no automatic deletion or irreversible cleanup**. Access follows the current publication rather than object retention. Plan a separately reviewed retention process if storage volume warrants it. A storage outage leaves the previous draft photo intact and permits selecting the file again. Photo actions and publication wait while uploading; the resulting draft then follows the existing autosave and recovery flow.

Autosave serializes writes and retains the original operation ID across unreadable success responses, network errors and 401s. Opposite publication intents remain disabled until an uncertain original action is reconciled. On reauthentication, the same owner is verified and an unresolved save is replayed before comparing revisions; newer local edits then save separately. Conflicts stop autosave and require an explicit discard before reloading. Closing or refreshing a tab can still lose unsaved memory; the native unload warning and Copy unsaved work protect that transition.

## Verification

Start local Supabase and the app first, then run:

```sh
npm run lint
npm run typecheck
npm test
npm run db:test
npx supabase db lint --local --schema public,private --fail-on warning
npm run test:integration
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

Integration and browser fixtures refuse non-local Supabase URLs and delete only their own test users. SQL pgTAP fixtures run in a rolled-back transaction. Do not point `TEST_DATABASE_URL` at a shared or production database. Browser tests use real Mailpit OTP; deterministic recovery tests inject lost responses after real database commits. The session recovery case removes browser cookies and restores the same owner with real OTP. Chromium runs recovery fault injection; all three engines run the real owner/public journey. Screenshots cover 320/390/768/1440 editor widths; traces are retained on failure in `test-results/`.

CI runs the pinned CLI locally, SQL/API tests, lint, unit tests, typecheck, production build and browser suites. It does not link, deploy or provision any cloud project. Browser artifacts are retained for seven days and may contain only the generated test content. See `artifacts/verification.md` for actual run results and outstanding gates; configuration alone is not proof of a successful CI run.

See [weekly maintenance](docs/weekly-maintenance.md) for scheduled tests, dependency audits, and read-only issue inventories, and [weekly backups](docs/weekly-backup.md) for encrypted repository, database, and photo backups. Scheduling requires the workflows on the GitHub default branch and the documented setup.

## Deployment preparation

The app uses the standard Next.js build and server runtime supported by Vercel, with Node 24.x declared in `package.json`. No Vercel account, project, domain or deployment was created. Before any separately authorized staging deployment:

1. Configure the canonical HTTPS `APP_ORIGIN`, Supabase URL, publishable key and **server-only** secret key using `.env.example`; never expose the secret through a `NEXT_PUBLIC_` variable.
2. Apply the reviewed migration to the intended database through its approved workflow. Keep `private` outside the exposed Data API schemas and preserve the explicit grants. Generate database types after approved schema changes using `npm run db:types`.
3. Configure custom SMTP, the exact code templates and auth limits in the target Supabase project. Verify delivery to non-team addresses; local Mailpit is not evidence of production delivery.
4. Run the acceptance suites against the staging environment with an appropriately isolated test strategy. Local integration tests intentionally refuse remote targets.

Production email delivery, hosted persistence, Vercel runtime behavior, custom domains and cloud operational monitoring remain unverified because cloud work was outside this assignment. The source supports milestone one plus a social link picker, profile photo uploads and packaged brand icons; see [icon attribution](docs/icon-attribution.md). It contains no billing, analytics, contact or QR controls. Photo verification evidence is in `artifacts/photo-upload/`.
