# Profile photo upload verification

Status: **ready**. Local implementation and verification are complete. Parent reported independent backend and frontend review passed, final integration accepted, and Design final signoff passed all narrow states with no P2 findings. No deployment was performed.

## Completed behavior

- Appearance has a compact 64px profile photo control with native JPEG/PNG/WebP picker, Upload/Replace/Remove, reversible Undo, upload status, inline errors, and an optional collapsed HTTPS URL fallback with Apply URL.
- Existing photo remains visible during upload or failure. Functional draft updates preserve concurrent name, bio, theme, and other edits. Upload completion is ignored after editor/profile unmount. Upload and publication guards prevent publishing until upload and autosave finish; other editing remains available.
- Server upload checks origin and host, authenticates the active owner through `read_profile`, bounds the binary body to 3 MiB, verifies MIME/signature/decode, rejects animation and images over 20 million pixels, applies EXIF rotation, resizes inside 1024px without enlargement, strips metadata, and encodes WebP using pinned Sharp 0.35.5.
- Private `profile-photos` bucket stores unique immutable UUID objects without upsert. The persisted URL is exactly `/api/profile-photos/{profileUuid}/{assetUuid}`. Only the avatar field accepts that managed relative path; cover and link images remain HTTPS only.
- Photo GET checks canonical IDs and a least-privilege RPC before server-only private download. Active owner or the exact current published avatar can read it. Anonymous drafts and other owners are denied. Replacement draft leaves the old published photo accessible until republish; republish and unpublish revoke the old public access. Responses use private/no-store and nosniff; denied/missing/malformed GETs return 404 without login HTML redirects.
- Existing publication transaction semantics and immutable payload copying are unchanged. Direct browser Storage access is blocked by a restrictive bucket policy. No metadata table or signed tokens were added.

## Changed feature files

All existing repository work was untracked when assigned. Changes were confined to the authorized feature and integration points; existing templates, Profile Desk, compact editor, publishing, auth, and recovery work were preserved. Existing-file snapshots used during implementation are under `/tmp/linky-photo-original/` (temporary, not a durable deliverable).

New application files:

- `src/features/profile-photos/paths.ts`
- `src/features/profile-photos/image.ts`
- `src/app/api/profiles/[id]/photo/route.ts`
- `src/app/api/profile-photos/[profile]/[asset]/route.ts`
- `src/features/editor/useProfilePhoto.ts`
- `src/features/editor/ProfilePhoto.tsx`

Existing application integration:

- `src/lib/http.ts`: reuse origin/host and bounded-stream checks for JSON and binary bodies.
- `src/features/profiles/model.ts`: avatar-only managed URL validation.
- `src/features/public-profile/ProfileMedia.tsx`, `TemplateHeader.tsx`, `ProfileRenderer.tsx`: safe managed avatar rendering across templates.
- `src/features/editor/useDraft.ts`: functional updates against the latest draft.
- `src/features/editor/Editor.tsx`, `editor.css`: photo control, upload/publication guards, compact responsive styles.
- `src/types/database.ts`: permission RPC type.

Database, configuration, dependencies, and documentation:

- `supabase/migrations/20261024010143_profile_photos.sql`: additive validator replacement, private permission function/public invoker wrapper, restricted grants, private bucket and browser denial policy.
- `supabase/config.toml`: local Storage enabled.
- `package.json`, `package-lock.json`: direct exact `sharp: 0.35.5`; npm-generated required dependency graph retained and lockfile dry-run verified.
- `README.md`: configuration/migration/deployment preparation, limits, access lifecycle, and retention.

Tests:

- New `src/features/profile-photos/image.test.ts`, `paths.test.ts`.
- New `tests/fixtures/managed-avatars.json` and `tests/integration/profile-photos.test.mjs`.
- New `tests/e2e/photo-upload.spec.ts` with four focused cases.
- Updated `tests/e2e/templates.spec.ts` for the intentional collapsed URL fallback and Apply URL action, preserving its original functional assertions.
- Updated one `supabase/tests/milestone_one.test.sql` assertion for intentional narrow private-schema function usage while retaining denial of direct profile reads.

## Local Storage and migration

The installed Supabase CLI 2.121.0 `migration new --help` was read before generating `20261024010143_profile_photos.sql`. `supabase migration up --local` successfully applied only this forward migration; see [migration.log](migration.log).

Storage was initially disabled. Local Supabase was stopped with its normal backup/volume-preserving behavior and restarted after enabling Storage. The first startup hit the local Kong ARM image failure resolving the `kong` user in `/etc/passwd`. Pulling the same upstream Kong 2.8.1 image for `linux/amd64`, then starting with `DOCKER_DEFAULT_PLATFORM=linux/amd64`, recovered the local stack. Storage and Kong became healthy; parent independently confirmed container health. See [storage-start.log](storage-start.log), [kong-platform.log](kong-platform.log), and [storage-start-amd64.log](storage-start-amd64.log). Startup logs were sanitized to redact local credential fields.

No database reset, `--no-backup`, volume deletion, cloud mutation, existing-user data mutation, deployment, merge, or irreversible cleanup was performed. Tests created disposable fixtures, removed only their newly created Storage objects through the Storage API before owner cleanup, and left reviewer/real profile photos untouched.

## Actual verification

Commands below identify the executed checks and focused test selections. Playwright final runs used one worker and distinct output directories to avoid artifact collisions.

| Check / command | Actual result | Evidence |
| --- | --- | --- |
| `npm run test -- --reporter=dot` | 161 passed, 9 files | [unit-tests.log](unit-tests.log) |
| `node --env-file=.env.local --test tests/integration/profile-photos.test.mjs tests/integration/templates.test.mjs` | 6 passed: 2 photo + 4 existing template cases | [integration-final.log](integration-final.log) |
| `supabase test db` | 53 SQL assertions passed, 2 files | [db-tests-final.log](db-tests-final.log) |
| `supabase db lint` against local public/private schemas | No schema errors | [db-lint.log](db-lint.log) |
| Local Supabase security advisors | No issues returned | [db-advisors.log](db-advisors.log) |
| `npm run lint` | Exit 0, no warnings | [lint-final.log](lint-final.log) |
| `npm run typecheck` | Exit 0 | [typecheck-final.log](typecheck-final.log) |
| `npm run build` | Next 16.4.2 production build passed; both photo routes recognized | [build.log](build.log) |
| Chromium: four photo cases plus the two affected existing template media cases, `--workers=1 --output=artifacts/photo-upload/playwright-final` | 6 passed | [e2e-final.log](e2e-final.log) |
| Chromium existing `recovery.spec.ts` | 3 passed | [recovery-tests.log](recovery-tests.log) |
| Chromium affected template validation case after final button ARIA fix, isolated output | 1 passed | [e2e-a11y.log](e2e-a11y.log) |
| Chromium upload race/error/remove/Undo case after final button ARIA fix, isolated output | 1 passed; current error captures regenerated | [e2e-current-error.log](e2e-current-error.log) |
| WebKit photo publication lifecycle | 1 passed; 2 Chromium-specific injection cases intentionally skipped | [e2e-other-browsers.log](e2e-other-browsers.log) |
| Firefox | 3 launch failures before test logic: `Could not find profile folder.` No Firefox product coverage claimed. | [e2e-other-browsers.log](e2e-other-browsers.log) |
| `npm install --package-lock-only --ignore-scripts` then `npm ci --dry-run --ignore-scripts` | Both exit 0; exact Sharp dependency and lockfile consistent | [lockfile-refresh.log](lockfile-refresh.log), [lockfile-check-final.log](lockfile-check-final.log) |

Unit coverage includes all three accepted formats, malformed/signature/type/byte/pixel rejection, still-vs-animated validation, orientation and metadata stripping, resizing/no enlargement, bounded-stream cancellation, exact managed-path fixtures, and rendering across all 20 templates. Integration covers SQL/JS managed-path parity, avatar-only acceptance, active-account ownership, current-publication access, browser Storage denial, existing template snapshot behavior, and least-privilege boundaries.

Chromium exercises actual File binary upload into local private Storage; owner/anonymous/cross-owner reads; save/publish/replace/republish/unpublish; response headers; wrong origin/host; missing auth; unsupported/malformed/oversized files; concurrent editing across tabs; upload/save publication races; prior photo after failure; same-file retry; removal/Undo focus; reauthentication; and ignoring late completion after navigation. This is browser automation, not a physical-device hardware test or formal assistive-technology audit.

The build/typecheck preceded the last removal of unsupported `aria-invalid` from the Upload/Replace button. Final lint and both affected browser cases passed after that change; error association remains via `aria-describedby`, and the URL input retains its appropriate invalid state. No broad suite was repeated after these affected checks passed.

Earlier logs are retained as history, not the final result: the original SQL schema-usage expectation was adapted to the approved function wrapper; an animated fixture was corrected to use distinct frames; recovery now verifies actual normal-header navigation and ignored late upload; a concurrent Playwright output collision was resolved with serial/isolated output; the first lockfile-only minimization lacked required optional dependency entries and was replaced by the successful npm-generated lockfile. `e2e-final-chromium.log`, `db-tests.log`, and `lockfile-check.log` are superseded by the final logs above. Firefox remains an environment limitation and was not repeatedly retried or installed.

## Visual artifacts and scoped UI gate

Design final signoff was reported by the parent after review of the desktop, 320px, empty, uploading, and failure states. No P2 findings remain.

- [Desktop Chromium control](photo-control-chromium-desktop.png)
- [320px Chromium control](photo-control-chromium-320.png)
- [Desktop WebKit control](photo-control-webkit-desktop.png)
- [320px WebKit control](photo-control-webkit-320.png)
- [320px empty photo](photo-empty-chromium-320.png)
- [320px uploading](photo-uploading-320.png)
- [320px upload error, existing photo retained](upload-error-320.png)
- [Desktop upload error](upload-error.png)
- [320px published Chromium profile](published-chromium-320.png)
- [Desktop published WebKit profile](published-webkit-desktop.png)

The Chromium published capture now sets the public page viewport to 320px before capture. The earlier WebKit published capture was renamed honestly to `published-webkit-desktop.png`; it is not mobile evidence. Fixture photos are deliberately plain generated test images.

Scoped antislop/UI delivery gate (the existing application was not redesigned):

- PASS R-02/R-16: new control copy is direct and task-specific; no marketing claims or em-dash copy.
- PASS R-03/R-32/C-4: 320px captures and browser assertions show no overflow, photo actions meet 44px targets, and Remove/Undo restore focus to the stable Upload/Replace button with preventScroll.
- PASS R-17/R-18/R-23/R-36/R-38/C-5: no invented customers, testimonials, metrics, or security claims; generated images are disposable test fixtures.
- PASS R-24/R-26/R-27/R-28/R-35/C-2: no new navigation or FAQ; picker, Apply URL, Remove, Undo, error/retry, upload, save, and publication behaviors were exercised with visible empty/loading/error states and a successful build.
- PASS R-25 (scoped visual review): control reuses the existing editor text/error palette and final Design review reported no visual defect. No new contrast system or formal whole-app WCAG/AT audit is claimed.
- PASS R-33/R-34: implementation lives in source files; no runtime source patching or new theme toggle.
- PASS R-37 and dials: approved compact editor direction, ENERGY 1 / RHYTHM 1 / MOTION 1. Predictable rows preserve the existing editor identity; spacing separates thumbnail/actions/status; the existing action/focus treatment supplies the accent. No motion beyond existing interaction feedback was introduced.
- PASS R-01/R-04/R-06/R-07/R-08/R-09/R-10/R-12/R-13/R-14/R-19/R-22: no new decorative gradients, icons, typeface, patterns, arrows, badges, glass, shadows, glow, feature cards, animations, or illustrations. Existing typography is reused for continuity and readability.
- PASS R-05/R-11/R-15/R-20/R-21/R-29/R-30/R-31/C-1/C-3: one compact existing-style control replaces the old field; 64px thumbnail gives recognizable feedback without crowding mobile, explicit Upload/Replace/Remove labels describe the actions, and collapsed URL input retains compatibility. Existing palette/radii/typography keep the feature consistent with Linky's editor; no copied product layout, new cards, theme redesign, or filler sections.

## Decisions, limits, and handoff

- Stable relative paths work on local HTTP and production HTTPS; no arbitrary local/http URL relaxation was introduced.
- Service-role Storage operations remain server-only and occur only after the authenticated owner/publication permission gate. No service-key browser client exists.
- There is **no automatic deletion** of uploaded, orphaned, or historical published photo objects in this MVP. Public access is revoked by permission state, while immutable objects remain retained. No orphan cleanup or destructive retention job was added.
- Limits are 3 MiB input, JPEG/PNG/WebP still images, 20 million input pixels, and WebP output inside 1024px. No crop UI was added.
- Deployment still requires applying the forward migration and enabling/configuring Storage in the target environment as documented in README. That work was not performed or authorized here.
- Runtime versions used: Node 24.20.0, Next 16.4.2, Supabase JS 2.118.0, Supabase CLI 2.121.0, Sharp 0.35.5. Installed Next route-handler documentation, the applicable Supabase skill, and official [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/), [resize](https://sharp.pixelplumbing.com/api-resize/), [output](https://sharp.pixelplumbing.com/api-output/), and Supabase private-bucket/access-control/download documentation were read before implementation. Parent-provided current changelog research did not identify an applicable modern-Node blocker.

Unresolved implementation issues: **none**. Known verification limit: Firefox could not launch in this local runtime; no all-browser claim. Retention is intentionally manual/deferred as approved.

Recommended next role: **primary Astra manager, final delivery**. Concrete assignment: use this record and linked evidence to close the accepted local implementation and communicate the Storage migration/configuration requirement, retention policy, and Firefox limitation. Independent code review, frontend review, Design signoff, and integration acceptance have already been reported complete by the parent. No additional feature work, broad testing, deployment, or worker dispatch is requested.
