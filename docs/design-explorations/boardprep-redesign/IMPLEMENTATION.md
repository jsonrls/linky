# Profile Desk: resolved whole-app implementation contract

Status: ready for Astra manager assignment to Sol Coder. Date: 2026-10-24.
Design owns this document only. The user has selected option 3 and authorized whole-app implementation; no further selection gate applies.

## Summary and precedence

Recreate the composition of `03-profile-desk.png`: white workspace, compact top navigation, bold navy sans-serif hierarchy, cobalt Create profile action, quiet profile rows with a pale selected background, and a pale-blue published-preview pane on the right. Help owners find, edit, and inspect their published profiles without confusing private edits with live content. Apply the same restrained visual language to authentication, shared navigation, compact editor chrome, dialogs, and recovery states.

This document supersedes selection-pending language and obsolete public-appearance/media restrictions in `DESIGN.md`. The remaining behavioral safeguards in that document still apply. All twenty shipped templates, Original, optional avatar/cover/link-image URLs, and saved theme/layout/shape choices must survive. The public renderer's default output and template palettes are not redesign targets. Preserve `design-qa.md`, `docs/design-explorations/bio-styles/IMPLEMENTATION.md`, and existing template QA evidence. Do not replace them with this redesign's results.

## Evidence and established constraints

- Visually inspected the selected 1487 × 1058 PNG. It is the authoritative composition, not its sample identities or generated copy. Actual profile content replaces sample content.
- Read `DESIGN.md`, `src/features/profiles/Dashboard.tsx`, owner/root layouts, profiles route, profiles server helpers, shared `ProfileRenderer.tsx`, template registry/picker, media field, editor appearance/settings sections, shared Dialog, tokens, public route, and existing template QA summary.
- Dashboard currently filters by owner label/name/handle and publication state, displays edited time in UTC, count and published-slot usage, and carries a back URL into the editor. Preserve all of these.
- Existing `readPublicProfile(handle)` calls the public snapshot RPC server-side. Use it for the selected owned profile only. No new API endpoint, database migration, private-draft fallback, or client-side draft-to-published conversion.
- Existing renderer is named `ProfileRenderer`, not `sharedProfileRenderer`. Its `preview` mode disables links but currently hardcodes private-draft footer and empty guidance. Add the smallest explicit label/context distinction needed for published previews; preserve defaults for public, editor, and picker callers.
- Research/manager resolution: preserve current recently-updated order. Selection/default/fallback and publication identity handling below are resolved decisions.
- Installed Next is 16.4.2, React 19.3.1. Sol must consult relevant bundled Next guides before route/component code changes. This design handoff does not claim external API documentation verification or new runtime testing.

## User flow and selection contract

1. Open Profiles. Retain the existing filtered order. Resolve `selected` GET query parameter against visible owned profiles. If absent, unknown, stale, or filtered out, select the first published visible profile; if none is published, select the first visible profile. With no visible profiles, selection is empty.
2. Search/filter via existing GET behavior. Preserve `q`, `filter`, and `selected` where selection remains visible; otherwise use the same fallback. Invalid selection never triggers lookup of an arbitrary/non-owned handle. Resolve the public handle from the selected workspace row.
3. Each row has an explicit selection control separate from Edit profile and View live. Use a GET submit button named `selected`, labelled visibly “Preview” (selected state “Selected”), with accessible name including the owner label and a non-color selected indicator. `aria-pressed` communicates selection. Do not make the whole row a button, nest links inside it, or use listbox semantics around links. Initials may remain decorative.
4. Selection updates the right pane without opening the editor or public page. Preserve scroll and focus on the triggering control during enhanced navigation. Announce a short status such as “Published preview loaded for [name]”; never make the full rendered profile an assertive live region. Browser Back/Forward restores query-derived selection.
5. Edit profile preserves selection and search/filter in the existing safe back URL. View live remains an independent link shown only for published rows. Selection does not publish, save, change order, or mutate the profile.
6. Creation retains the current dialog, handle check, duplicate-operation protection, uncertain-outcome recovery, and transition into editing. Published quota counts all published workspace profiles, not only filtered rows. Private drafts do not consume published slots.

## Preview data, language, and states

The preview wrapper heading is “Published preview”; helper: “The last published version. Links are disabled.” It must not claim to show unsaved changes. Show selected owner label/handle outside the renderer if needed for context; never insert owner-only labels into public content. The rendered document comes exclusively from the public snapshot.

| State | Required behavior and language |
| --- | --- |
| Published selection, matching publication ID | Render returned snapshot through shared ProfileRenderer with disabled links and published-preview context. Footer: “Published preview. Links are disabled.” Preserve the selected snapshot's template, images, order, density, and corners. |
| Published with unpublished changes | Row retains “Published · unpublished changes”. Pane adds “Private edits are not shown here.” Render the published version only. |
| Private draft or unpublished selection | Do not fetch/render its draft. Show “No published page” and “Publish this profile from the editor to see it here.” Edit profile remains available. |
| No visible profiles | No previous preview or selection survives. Show “No profile selected” with brief search/filter guidance. Empty workspace has Create your first profile; zero matches has Clear filters. |
| Snapshot request pending | Reserve pane space, show “Loading published preview…” and `aria-busy`. Never show the previous selection's content under the new name. Profile actions remain operable where navigation permits. |
| Public RPC returns null | Show “Published preview unavailable” and “This page may no longer be published.” Offer Refresh preview. Never fall back to private data. |
| Snapshot request throws | Inline “Could not load the published preview.” and Retry within the pane; retain query, selected row, and usable list. Do not turn a preview-only failure into the full-page error screen. |
| Returned publication ID differs from row publicationId | Do not display inconsistent snapshot as current. Show “This publication changed. Refresh the preview to see the latest version.” Refresh preview revalidates workspace and snapshot while retaining query. If no longer published, transition to the no-published-page state. |
| Matching snapshot has no visible blocks | Preserve actual published identity and empty content; neutral guidance “No links or text in this published version.” Do not show the editor instruction “Add or show a content block to begin.” |

Retry/Refresh are local recovery affordances in the pane; server refresh/navigation may re-read workspace but must retain query context and must not introduce an API. Repeated failure remains recoverable without duplicate banners. Navigation races must never mix a newer selection label with an older response. Published preview does not embed an interactive public page or enable links, even when media exists.

## Visual direction and layout

Design read: calm, practical workspace with a strong left-side task hierarchy and a distinct right-side inspection surface. ENERGY 2 / RHYTHM 2 / MOTION 1. The repeated navy heading/cobalt action/pale-blue selection language provides identity; the preview supplies asymmetry. No new illustration, generated asset, logo, avatar, or grid asset is required. Omit the faint reference grid.

- At roughly 1440px, use about 48px outer gutters and 32px column gap; about 63% profile desk and 37% preview within available width. Target overall content max width about 1440px, superseding the old 1120px dashboard cap that would compress the selected composition. Preview width about 420–460px at this size. Allow rows to wrap rather than force the screenshot's sparse sample into real data.
- Header about 72px tall: Linky left, a subtle divider and Profiles navigation with cobalt active underline, account email and Sign out right. No extra routes, avatar menu, or decorative account action. Existing initials may be omitted. Profiles is the sole workspace section; editor retains a clear Back to profiles route and no fabricated tab destinations.
- Dashboard begins 40–48px below header. Profiles heading 44–48px, weight 750–800; supporting copy 18px with comfortable line-height. Create profile sits upper-right of the left desk, with actual published usage immediately below. Remove the numbered workspace eyebrow.
- Search and filters remain below the introduction. Filters appear as quiet text controls with active underline; preserve their button semantics and 44px hit area. Keep the profile count, even though the concept omits it.
- Rows are a list, not separate floating cards. Use thin separators, 16px vertical padding, 12–16px internal gap, 56–64px initials. Selected row uses pale-blue fill and 12–16px radius, plus visible “Selected” control. Keep owner label strongest (18–20px, 650–700), public name/handle secondary, full text statuses, edited timestamp including UTC, and independent actions. Added selection/metadata can make rows taller than the mock.
- Outer preview panel uses #EFF6FF with 16–20px radius, approximately 24–32px padding. Its heading is 24–28px navy. Render the profile at the available natural width, with no screenshot scaling, fixed-height clipping, or imposed white surface over a template's own background. The reference's white inner card corresponds to its example appearance only.
- Workspace canvas #FFFFFF; ink #0F172A; secondary #475569; action #1D4ED8 and hover #1E40AF; focus #2563EB; divider #CBD5E1; essential field boundary #64748B. Reuse existing system sans. Body/inputs 16px; secondary text at least 14px. Primary buttons may be rounded; ordinary controls about 10–12px radius. Solid cobalt is sufficient; no gradient needed.
- Scope workspace CSS so public surfaces do not inherit new typography, button radius, spacing, colors, or background. Pay special attention to Original, which uses shared `.button`, `.initials`, and CSS variables. Do not reset persisted `warm`/`ink`, template ID, layout, shape, or media fields.

## Responsive and accessibility requirements

- Use the two-column desk at 1100px and above when both columns fit. Below that, keep list as the default and expose a compact “Show published preview” toggle immediately above the profile list. The preview is not automatically inserted above all row actions.
- On narrow screens, row Preview selects and opens a modal published-preview sheet; the top toggle opens the current selection. Use the shared native dialog behavior, full available width at 320px, readable heading, 44px Close, and scrollable body within dynamic viewport height. Closing returns focus to the exact trigger and preserves list scroll. Do not auto-open on initial page load or filter fallback. Empty selection disables the toggle with adjacent explanation. Desktop does not need the sheet or toggle.
- A selected private/unpublished row opens the same sheet with its honest empty state. This makes selection predictable while never revealing draft data. Resizing to desktop closes a mobile modal safely and restores the selected inline pane; avoid duplicate focusable previews.
- At 320/390px use 16px gutters, 28–32px page heading, wrapping header with account text truncation that retains its full accessible text. Keep navigation and Sign out operable; email must not force overflow. Stack search input/action where needed; wrap filters. Row actions wrap into a separate line, minimum 44 × 44px each, without icon-only substitutes. Do not shrink text to fit.
- Editor retains desktop private-preview split at its existing 1024px breakpoint and Edit/Private preview switching below it. Dashboard sheet behavior does not replace the editor's established preview interaction.
- Preserve skip link, one page main landmark, heading hierarchy, form labels, keyboard operation, focus-visible outline, and error associations. Non-color cues must identify selected filters, selected row, publication state, errors, and disabled reasons.
- On filter fallback, announce the new selection or no matches without stealing focus. For modal open, focus its heading/close control; Escape and Close restore trigger. For destructive dialogs, preserve safe initial focus and existing busy dismissal rules.
- Aim for 4.5:1 normal text and 3:1 large text/control boundaries/focus. Measure rendered colors. Disable smooth scroll/transitions under reduced motion; use no decorative motion. At 200% zoom switch layout as needed; long labels, handles, email and URLs wrap or break without losing text. No horizontal page scroll.
- Long preview content scrolls naturally on desktop and within the mobile dialog; no hardcoded mock height hiding later links. Broken optional media retains existing fallback/collapse behavior and does not hide content.

## Whole-app coverage and preserved interactions

| Surface | Required visual change and functional protection |
| --- | --- |
| Root/auth routing | Preserve existing redirects and safe return paths; no new marketing homepage. |
| Login / verification | White spacious canvas, navy heading, cobalt action, shared fields/notices. Compact form around 420px max width, 16px mobile gutters. Keep single paste/autofill-friendly OTP, email context, Change email, resend countdown, throttle/expiry/error handling and entered values. No split OTP fields. |
| Owner shell | One shared header/nav pattern across dashboard/editor. Avoid copying shell markup into each route. Long account/email and pending/error Sign out states remain usable. |
| Editor chrome | Compact title/save status, publication strip and Content/Appearance/Settings tabs. Use navy type, white sections, restrained pale-blue selected states. No large hero or background decoration. Preserve draft versus publication distinction and disabled publish explanations. |
| Content editing | Keep Add toolbar before Identity, sticky measured height, n/100, Add link/text, collapsed existing blocks and newly expanded card. Add focuses URL below toolbar without second jump; other recovery/undo focus stays nearest. URL-first detection, explicit manual ownership, saved labels, genuine brand colors/backings, 30 choices, move/hide/remove/undo, text order and limits unchanged. |
| Appearance | Keep all twenty named templates plus Original, searchable picker, example thumbnails, temporary candidate preview, Cancel and Use template. Change only picker/dialog chrome. Preserve original theme controls when appropriate, reading rhythm, corners, optional avatar/cover/link-image URLs, validation/removal and failed-image feedback. Cancel never applies a candidate. |
| Settings / publication | Keep owner-only label, first-publish handle lock, confirmations, unpublish explanation, slot release, draft retention, public URL/copy/live actions, and uncertain operation status checking. No automatic publish or changed lifecycle. |
| Dialogs / recovery | Reuse shared Dialog and Field styles. Clear heading, compact body, separated footer; mobile scrollable content and visible actions. Preserve safe focus, close/Escape rules, copy-work fallback, conflict/reload/discard, leave protection, reauthentication, same-owner instructions, and uncertain create/publish/unpublish recovery using the original operation. |
| Loading / error / unavailable | Stable shell, readable concise status, no fake profiles. Preserve global Retry/reset and unavailable privacy-neutral language. Preview-only error stays local. Loading must not erase unsaved editor work. |
| Public route / private preview | Keep all appearance output and media behavior. Public pages stay on published snapshots; editor/picker keep private draft wording and disabled links. Only the new dashboard context uses published-preview wording. |

## Acceptance criteria and verification handoff

1. Capture dashboard at 1440px with matching fixture/state beside the selected reference. Confirm compact header, left intro/Create/search/rows, pale selected row and pale-blue right pane. Real metadata/controls are acceptable additions; a generic card grid or full-width intro above both columns is not equivalent.
2. Exercise default selection, all-private fallback, explicit private selection, stale/unknown/filtered selection, no matches, cleared filters, browser history, and edit/back. Assert retained q/filter/selected and current order. Verify quota uses the full workspace and timestamp still says UTC.
3. Verify public snapshot isolation with a published profile whose private draft has different text, appearance and media. Dashboard must show only published data. Null, thrown error, and mismatched publication IDs produce the exact state categories above; Retry/Refresh preserves context. No DB/API additions.
4. At 320/390px, list actions stay visible without scrolling through a full preview. Open sheet by row selection and toggle, close via keyboard and pointer, restore focus/scroll, change selection and resize. No overlapping controls or horizontal overflow; all workspace targets remain at least 44px.
5. Verify preview labels and disabled links in all three contexts: published desk, editor/private picker, and live public page. Published-empty preview must never invite editing directly or call itself private.
6. Recheck all twenty templates and Original against existing QA evidence, including Original warm/ink. Preserve saved choices and test optional media present/absent/broken. Global shared CSS must not recolor, flatten, or reset public layouts. Add redesign evidence separately rather than replacing prior QA.
7. Capture auth, editor Content/Appearance/Settings, creation, template picker, publish and recovery dialogs at desktop/mobile. Verify named-profile Add stays initially visible at 1440 × 900 and 390 × 844; twentieth-link editing, sticky focus, manual/auto label ownership, brand icons, validation, undo and recovery remain usable.
8. Sol runs typecheck/lint/build and relevant existing unit/E2E checks proportional to changed areas, plus meaningful selection/preview-state coverage. Manager reviews correctness and snapshot boundaries. Design reviews actual rendered captures at equal viewport/state and reports bounded discrepancies; screenshots alone do not certify accessibility.

## Tradeoffs, open questions, and return contract

- The screenshot's sparse rows omit real metadata and an explicit selection control. Accessible selection, public name, UTC edit time and full statuses take priority over identical row height.
- Mobile uses an intentional modal preview rather than a long inline preview above/below the list; this preserves task access at the cost of one explicit open/close step. No full-page navigation or new capability is introduced.
- Published preview reflects a narrow viewport of the chosen template, not a desktop screenshot. Native template responsiveness takes priority over reproducing the mock's generic inner card.
- No unresolved product/design questions block coding. Actual responsive rendering, state transitions, focus, contrast and regression results remain verification work. No implementation or usability test has been performed by Design in this handoff.
- Status: ready. Completed: selected-image inspection, source reconciliation, interaction/state/mobile contract and acceptance criteria. Sole artifact: this file. No application code, prior template QA, permissions, dependencies or external state changed.
- Recommended next role: Sol Coder, dispatched by the primary Astra manager. Assignment: implement this whole-app contract using existing shared components and server snapshot helper; preserve all data and editor behaviors; return changed paths, check results, screenshots and known gaps. Then return the rendered implementation to this Design role for visual review and Astra for correctness review. Optional Planner is unnecessary unless new evidence changes dependencies.
- Model routing: this worker cannot change or independently attest its runtime model/effort. Manager retains responsibility for required Astra Medium / Sol High routing; no substitute agent was launched.

## Design-document checks

PASS: exact target identified and inspected; selection and technical dependencies resolved in this contract.
PASS: no invented product features, sample identities, marketing claims, new assets or navigation destinations specified.
PASS: contrast, keyboard, mobile, state and recovery requirements explicit; these are acceptance requirements, not claims of runtime compliance.
PASS: composition, deliberate accent, typography and spacing have written purpose; no decorative filler or unrequested grid generation.
PASS: source-informed public-template/media and compact-editor protections explicit; prior QA retained.
Not applicable to this document-only delivery: application build, click-through and rendered antislop/image-to-code QA gates. They remain mandatory implementation verification, with no application pass claimed here.
