# Milestone one verification

Implementation worker handoff, 23 October 2026. Status: **ready for independent review**. Scope is TASK-001 through TASK-006, with local services only. No commit, cloud project, deployment, external message or production database mutation was made. Existing plan, requirements, design direction and prototype files were not edited. Parent-owned screenshots in `docs/milestone-one-review/` were preserved.

## Runtime and actual checks

Node 24.22.1 ran through task-local `npx --package=node@24.22.1`; global Node 25 was unchanged. Installed versions are pinned in `package-lock.json`: Next 16.4.2, React 19.3.1, Supabase JS 2.118.0, SSR 0.12.7 and CLI 2.121.0. CLI help was inspected before local setup, migration creation, type generation and database tests. Generated public RPC types are in `src/types/database.ts`.

| Check | Actual result |
| --- | --- |
| ESLint | Pass, exit 0 |
| TypeScript `tsc --noEmit` | Pass, exit 0 |
| Vitest | **19 passed**, 3 files, no failures |
| Supabase pgTAP | **28 passed**, 1 SQL file; transaction rolled back |
| Supabase database lint, public + private | Pass; no schema errors or warnings |
| Supabase security advisors, warning level | Pass; `results: []`, “No issues found” |
| Real Supabase RPC/API integration | **6 passed**, no failures; isolated test users cleaned up |
| Next production build | Pass; owner/auth/API/public routes dynamic, framework pages build normally |
| Production Playwright, Chromium + WebKit | **7 passed, 5 intentionally skipped**, no failures, 33.8 seconds |
| Full local browser matrix before production run | 7 passed, 10 intentionally skipped, 1 Firefox launch failure before app access |
| Firefox bounded retry using dedicated `/tmp/linky-playwright` | Same launch failure: “Could not find profile folder”; no app test executed |
| Production-only dependency audit | **0 vulnerabilities** |
| Full dependency audit | 5 high dev-tool transitive findings through `braces` / `fast-glob` / Next ESLint; no published compatible fix applied |
| Hosted CI workflow | Written, not executed in GitHub |

The final production browser run used:

```sh
APP_ORIGIN=http://127.0.0.1:3001 npx --yes --package=node@24.22.1 node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001
APP_ORIGIN=http://127.0.0.1:3001 npx --yes --package=node@24.22.1 node node_modules/@playwright/test/cli.js test --project=chromium --project=webkit --output=test-results-production
```

The project stack is currently on the task-created `linky-local` Docker network, so its final pgTAP invocation was `npx supabase test db --network-id linky-local`. A fresh standard `npm run db:start` uses the CLI's default project network and `npm run db:test`. An initial plain test invocation against this custom-network stack failed because the default network did not exist; rerunning with the actual network passed. No database reset was performed during parent review.

## Observable acceptance evidence

- Real UI email OTP through local GoTrue and Mailpit, new account and same-owner session recovery. Code input remains a string and uses one-time-code autofill.
- Two owner isolation, no direct private-schema/table reads, narrow function grants, summary-only workspace listing and neutral inaccessible resources.
- Exact one-winner normalized handle race; published-slot race stays within two slots; concurrent save conflicts and stale publication fail atomically.
- Idempotent retries reject changed payloads. Historical publish and unpublish receipts replayed after intervening saves/publications do not change current state.
- Direct RPC rejects JSON-null appearance enums and `block.type: null`. Direct publication rejects malformed hosts, IPv6, ports and credentials; legitimate host forms are accepted.
- Shared preview/public renderer, two independent profiles, hidden-block and owner-label snapshot privacy, private draft rename leaves public HTML and metadata unchanged, handle freezes after first publication, unpublish produces a real neutral 404 and leaves the other profile live.
- Lost committed publish/unpublish responses keep the original operation kind and ID. New/opposite intent stays disabled until reconciliation; newer private edits require a fresh publication confirmation.
- An unreadable committed save retains its receipt across actual cookie removal and a real 401. Same-owner OTP recovery replays the original save before saving newer local work separately.
- Two tabs produce a visible conflict without overwrite. Autosave pauses; clipboard-denied fallback contains the full local document; reload requires explicit discard with safe focus first.
- Invalid publish closes confirmation, expands the affected block, associates its error and focuses its field. Keyboard undo focuses the restored block summary and announces its position. Search and Enter preserve the selected dashboard filter; filter switches preserve the query.
- Editor screenshots and horizontal-overflow assertions at 320, 390, 768 and 1440 pixels. Mobile recovery dialog geometry asserts width 390px and x=0 at a 390px viewport. Final capture uses a viewport screenshot.

Production curl verified `GET /@review-studio` **200**, `GET /@not-an-existing-linky-page` **404**, and `Cache-Control: private, no-store, max-age=0, must-revalidate`. The public `@` segment is normalized for metadata's encoded params and page rendering's decoded params. Temporary public lookup debugging was removed.

Parent independently reported successful OTP/create/save/publish, persisted bio/link revision 2, public 200, private draft rename isolation, second profile independence, and separate lint/typecheck/unit/integration reproduction. Parent's review is additional evidence, not a replacement for the worker's recorded checks.

## Preserved artifacts

- `artifacts/session-recovery-390.png`: corrected full-width mobile dialog, production build, viewport capture.
- `artifacts/editor-validation-390.png`: invalid link field revealed and focused, production build.
- `artifacts/editor-390.png`: Warm Editorial editor, production build.
- `test-results-production/`: generated screenshots across widths; ignored and replaceable by later runs.
- `test-results-firefox/`: bounded Firefox launch failure trace and context; ignored.
- `playwright-report/`: most recent generated report; ignored and replaceable.
- `docs/milestone-one-review/`: parent-owned dashboard/public screenshots, not modified by the coder.

## Decisions, limits and next assignment

Mutation requests use one explicit RPC command surface with strict per-kind contracts rather than four duplicated authorization implementations. Account locking precedes profile locking and slot counting. Domain tables remain private; public reads use a server-only, narrow RPC and immutable current snapshot. UI state is explicit and transient; persistence and auth are real Supabase services. Fields remain disabled until hydration so typing cannot precede React's input handlers.

The local Kong ARM image initially lacked user/group data. The same upstream AMD64 image started successfully; local Docker's standard all-interface port bindings are documented in README. The app binds localhost. The unrelated `boardprep-lms3-dev-localpostgres-1` container was left untouched.

Firefox remains unavailable on this host after two bounded attempts; CI remains configured for Firefox. Cloud deployment/provisioning and production SMTP delivery were outside scope and remain unverified. Full screen-reader, browser zoom and deployed Vercel behavior have not been claimed as tested. The five development-tool audit findings remain recorded; the production audit is clean.

One documented, nonblocking HTTP semantics limitation: API service failures return **503**, but a public Server Component service failure renders Next's distinct error boundary with **500**. It is not converted to a neutral 404. The manager accepted documenting this limitation without expanding implementation. No live Supabase outage was induced while parent used the shared stack.

Recommended next role: **Astra reviewer**, with Design checking the corrected mobile screenshot. Concrete manager assignment: inspect the final source and this evidence, confirm the three bounded Design fixes and retry regressions, and either accept the local milestone with the explicitly recorded verification limits or return specific implementation defects to Sol. Do not advance to later milestone features without a new assignment.

The external SSD briefly unmounted after all recorded checks and artifact writes. After the manager remounted it, the workspace and preserved screenshots were verified accessible, the Node 24 development server was restarted on `127.0.0.1:3000`, and `/login`, `/@review-studio`, local Supabase Auth health, and Mailpit each returned **200**. A missing public handle returned **404**. Supabase containers remained healthy throughout; no reset or database recovery was performed. README was verified to describe standard Docker bindings with no invented loopback gate. No broad suites were rerun after remounting.
