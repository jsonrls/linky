# URL platform detection verification

Status: ready for independent Astra correctness review and Design evidence review.

Production files: `src/features/editor/Editor.tsx`, `src/features/profiles/link-platforms.tsx`, `src/features/profiles/detect-link-platform.ts`.
Focused tests: `src/features/profiles/detect-link-platform.test.ts`, `tests/e2e/link-detection.spec.ts`.
`source-changes.patch` compares against task-start copies, because this repository was already untracked.

Behavior: on URL edit, fill untouched blank labels (including saved empty labels) or update a prior automatic choice. Explicit platform/Custom choices, including empty Custom and exact brand text, remain manual. Unknown/invalid URLs clear only a prior automatic label. Raw URL/focus preserved. Ownership is local, cleared on explicit reload/discard, retained through remove/undo and autosave. Saved nonempty labels reopen as manual. No schema, dependencies, icon paths, colors or validation changes.

Matching: existing safeUrl syntax acceptance; parsed HTTP(S) hostname; exact domain or dot-boundary subdomain. Credentials, lookalikes and substring matches rejected. All 30 canonical platforms supported. Arbitrary decentralized Mastodon and custom Substack domains remain unrecognized. No redirect resolution/network fetch; unlisted aliases remain generic.

## Actual checks

- npm run lint: passed.
- npm run typecheck: passed.
- npx vitest run src/features/profiles/detect-link-platform.test.ts src/features/profiles/link-platforms.test.ts: 68 tests passed, 2 files (59 matching cases + 9 existing icon cases).
- npx playwright test tests/e2e/link-detection.spec.ts --project=chromium --output=test-results/link-detection --reporter=list: 3 passed, 25.1s.
- Clipboard test uses actual navigator.clipboard + native ControlOrMeta+V in an isolated Chromium context. Fresh/repeated detection, raw URL, unchanged focus, spoof/invalid/unknown clearing, manual/custom protection, hide/remove/undo, save/reload/publication and matching public SVG verified.
- Saved-empty eligibility and explicit-empty Custom protection verified; conflict Discard & reload clears auto ownership verified.
- Test accounts/profiles cleaned up by existing local-only helpers. No existing user profiles edited. No broad suite or build rerun for this bounded change.

## Screenshots

- editor-detected.png: saved YouTube automatic choice with raw youtu.be URL, focused URL field, detection hint, editor + preview icons; manual LINE remains unchanged.
- public-detected-390.png: published mobile labels/icons. The test deliberately edits YouTube's URL to Instagram after reload to verify persisted label is now manual.
- Both images opened and inspected after capture; UI fully loaded.

## Bounded official alias sources

Canonical existing social domains treated stable. Only common uncertain aliases/current host transitions checked:
- YouTube youtu.be: https://youtube.googleblog.com/2009/12/?amp=1 (official December 21, 2009 announcement).
- Telegram t.me / telegram.me: https://core.telegram.org/api/links
- Discord discord.gg: https://support.discord.com/hc/en-us/articles/360034842871-How-do-I-join-a-Server
- WhatsApp wa.me: https://faq.whatsapp.com/5913398998672934/?locale=pt_BR
- Threads threads.net / threads.com: https://about.fb.com/news/2025/04/new-features-threads-web-experience/
- Known Mastodon-host scope: https://blog.joinmastodon.org/2026/07/announcing-new-terms-of-service-for-our-servers/

Next role: Astra Reviewer; inspect state transitions and hostname boundaries against actual source, with Design reviewing screenshots via parent manager. No unresolved implementation issue found.
