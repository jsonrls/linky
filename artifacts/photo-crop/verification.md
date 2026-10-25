# Profile photo crop verification

Status: ready. Implementation and targeted verification are complete. The parent accepted code review and reported Design signoff after reviewing 11 regenerated renders. No blocking findings remain.

## Behavior and contract

- Selecting an original JPEG, PNG, or WebP up to 3 MiB opens a local native dialog. Selection, adjustment, Reset, Cancel, Escape, close, preparation failure, and known session expiry send no photo POST.
- `X-Photo-Crop` contains exactly `{centerX, centerY, zoom}`. Centers are normalized against the auto-oriented original; zoom is 1–3. The header is limited to 256 characters. Malformed JSON, extra/missing fields, nonfinite values, invalid ranges, and crops beyond the oriented bounds are rejected with `invalid_photo_crop` (400).
- The browser sends the original File unchanged, with crop metadata separately. No canvas output replaces original validation. Server authentication, ownership, origin/host, byte limit, signature/type, 20 MP, still-image checks, private immutable storage, publication permissions, and response protections remain in place.
- Sharp 0.35.5 derives dimensions from `metadata.autoOrient`, runs `autoOrient()` before integral square extraction, then preserves the existing maximum-1024, no-enlargement, metadata-free WebP normalization. Omitting crop metadata retains the existing raw upload API.
- The preview clamps movement without empty edges. Mouse and touch dragging, arrows and Shift+arrows, four named direction buttons, native 100–300% Zoom, and Reset share the same normalized crop geometry.
- The mobile dialog uses full available width. Its body scrolls with nonshrinking children on short screens; its footer stays reachable. Instructions receive initial focus. Decode/upload errors receive focus without stealing it from an open recovery dialog. Cancel restores the stable trigger, with status as the fallback when it is disabled. Confirmation focuses upload status and successful completion announces the draft update.
- An autosave 401 while adjustment is open disables confirmation, explains recovery, keeps the adjustment visible, and leaves Cancel available. Existing publication, autosave, concurrent-editing, undo, URL fallback, and late-response guards are preserved.

## Changed source and tests

- `src/features/editor/ProfilePhoto.tsx`
- `src/features/editor/PhotoCropDialog.tsx` (new)
- `src/features/editor/useProfilePhoto.ts`
- `src/features/editor/Editor.tsx`
- `src/features/editor/editor.css`
- `src/features/profile-photos/crop.ts` (new shared contract and geometry)
- `src/features/profile-photos/crop.test.ts` (new)
- `src/features/profile-photos/image.ts`
- `src/features/profile-photos/image.test.ts`
- `src/app/api/profiles/[id]/photo/route.ts`
- `tests/e2e/photo-crop.spec.ts` (new)
- `tests/e2e/photo-upload.spec.ts`

Existing repository work was untracked at assignment. Edits were confined to this bounded feature. No dependency, schema, migration, permission, cloud, deployment, publishing of existing profiles, or merge changes were made. Browser tests used disposable local owners and cleaned up their Storage objects and owners. The existing reviewer fixture was not mutated by implementation tests.

## Actual checks

| Check | Result | Evidence |
| --- | --- | --- |
| Crop/image/path Vitest tests | 48 passed, 3 files | [unit.log](unit.log) |
| Chromium crop + existing photo-upload E2E | 10 passed | [e2e-chromium-final.log](e2e-chromium-final.log) |
| WebKit crop + existing photo-upload E2E | 7 passed, 3 deliberately Chromium-only cases skipped | [e2e-webkit.log](e2e-webkit.log) |
| Final affected responsive/session cases in both browsers | 4 passed after the nonshrinking-body fix; includes row geometry, square preview, fully reachable controls, and Chromium touch drag | [e2e-responsive-final.log](e2e-responsive-final.log) |
| ESLint | Passed; final added test assertions also passed targeted ESLint | [lint-complete.log](lint-complete.log), [lint-tests-complete.log](lint-tests-complete.log) |
| TypeScript | Passed | [typecheck-complete.log](typecheck-complete.log) |
| Final production build | Passed, including TypeScript and both photo routes | [build-complete.log](build-complete.log) |
| Scoped contrast formula checks | All 7 pairs passed | [contrast.json](contrast.json) |

Unit fixtures independently map source pixels for all eight EXIF orientations, including mirror transforms, then compare the normalized extracted output. Browser tests use asymmetric JPEG fixtures with EXIF 2, 6, and 7 in Chromium and WebKit. The exact original File SHA-256, size, and type are checked at the fetch boundary because browser request protocols can omit binary Blob postData. Stored WebP bytes equal the expected pipeline output. Preview-versus-stored mean absolute channel error is 1.12–1.26 on a 0–255 scale, below the threshold of 4, allowing browser resampling and lossy WebP differences. See `pixels-exif-*.json`, `preview-exif-*.png`, `output-exif-*.webp`, and the original `asymmetric-exif-*.jpg` fixtures.

The existing photo regressions exercise private owner/cross-owner/anonymous access, publish/replace/republish/unpublish, concurrent edits, upload/save publication guards, upload failure retaining the photo, removal/Undo, session recovery, late upload after unmount, request validation, malformed crop headers, and the legacy no-crop API. The new cases prove zero uploads on cancellation, focus behavior, Reset, keyboard and direction controls, pointer capture, native Chromium touch input, preparation cancellation, decode/size errors, object URL cleanup, choosing another file, and autosave expiry during cropping.

Earlier harness failures are preserved in the initial logs: React Strict Mode required holding both decode effects, binary Blob postData was absent in Chromium protocol metadata, and test typing/lint issues needed correction. These were corrected before the passing runs. A rendered short-height overlap was fixed by replacing shrinkable grid tracks with a scrolling flex body and nonshrinking children. The final affected tests and captures were regenerated after that fix.

Firefox was not attempted, per assignment. These checks are browser automation and source review, not a physical-device or formal assistive-technology audit.

## Render evidence

- [Desktop Chromium](dialog-chromium-desktop.png), [desktop WebKit](dialog-webkit-desktop.png)
- [320 × 844 Chromium](dialog-chromium-320x844.png), [320 × 568 Chromium](dialog-chromium-320x568.png), [640 × 360 Chromium](dialog-chromium-640x360.png)
- [320 × 568 lower controls](controls-chromium-320x568.png), [640 × 360 lower controls](controls-chromium-640x360.png)
- Equivalent `dialog-webkit-*` and `controls-webkit-*` captures cover WebKit.
- [Decode error](decode-error-chromium-320.png), [upload error retaining the prior photo](upload-error-chromium-320.png), [preparation](preparing-chromium.png)
- [Session expiry Chromium](session-expired-chromium.png), [session expiry WebKit](session-expired-webkit.png)

The parent also reported an independent native-picker CUA check: instruction focus, Zoom End to 300%, direction button, Reset to 100%, and Cancel restoring upload focus without changing the existing profile. Design reported final signoff on the regenerated renders.

## Scoped design delivery gate

- PASS R-02/R-15/R-16/R-17/R-18/R-23/R-24/R-28/R-36/R-38: specific adjustment copy and synthetic test fixtures; no fabricated product claims, testimonials, assets representing people, or new navigation.
- PASS R-03/R-32/C-4: responsive E2E verifies square geometry, separate control rows, accessible scrolling, footer reachability, 44 px button targets, keyboard control, Escape, and focus restoration.
- PASS R-25: recorded navy, instruction, loading, error, primary, boundary, and focus contrast values all exceed their applicable thresholds.
- PASS R-26/R-27/R-35/C-2: controls have exercised behavior; loading, decode failure, upload failure, cancellation, success, auth lock, and recovery were exercised. Production build passed.
- PASS R-01/R-04/R-06/R-07/R-08/R-09/R-10/R-12/R-13/R-14/R-19/R-22/R-31/C-1/C-3: existing white/navy/cobalt and system sans preserve the editor's identity; the square is the task's focal point; direction glyphs indicate actual movement; spacing separates preview, movement, zoom, and confirmation. No decorative effects or new visual assets were added.
- PASS R-05/R-11/R-20/R-21/R-29/R-30/R-33/R-34/R-37: accepted existing design direction, ENERGY 1 / RHYTHM 1 / MOTION 1; direct source edits; the existing editor palette, typography, button radii, and theme behavior are preserved. No unrelated theme or layout work.

## Handoff

Decisions: use normalized centers plus zoom, original raw bytes, optional metadata for compatibility, and native dialog/range/pointer APIs without new dependencies. No unresolved implementation issues remain.

Recommended next role: primary Astra manager. Concrete assignment: accept the completed independent code/Design reviews, incorporate this verification evidence, and deliver the authorized feature. No additional worker dispatch or deployment is required by this implementation handoff.
