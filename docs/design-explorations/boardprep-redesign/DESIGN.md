# Linky — BoardPrep-inspired whole-app redesign

Status: design handoff ready; dashboard direction selection pending. Date: 2026-10-24.
Endpoint: design specification and three visual alternatives. No production changes authorized by this document.
Goal: make Linky feel welcoming and coherent while keeping profile management and repeated link entry efficient.

## Evidence and boundaries
- Inspected current routes, Dashboard, Editor, OTP, shared components, public renderer, model, and styles.
- Visually inspected reference-home.png, reference-sections.png, and current-dashboard.png in this folder.
- Reference: https://www.myboardprep.org/ — visual inspiration only; do not reuse its copy, logo, photographs, or assets.
- Adopt white space, faint blue grid, navy headings, cobalt emphasis, curved blue actions, and pale-blue surfaces.
- Preserve sans-serif-only typography, compact editing, real colored brand SVGs, URL-first detection, and existing data contracts.
- No new analytics, templates, billing, photo uploads, navigation destinations, or profile capabilities.
- Raster concepts illustrate direction; omissions or generated text never override the requirements below.

## Shared visual system
- Keep the existing system sans stack; use 700–800 weight headings and 400–600 body/control text.
- Canvas white; secondary canvas #F8FAFC; main ink #0F172A; secondary text #475569.
- Cobalt #1D4ED8; hover #1E40AF; focus #2563EB; pale panel #EFF6FF.
- Divider #CBD5E1; essential input boundary #64748B; error #B91C1C; success #166534.
- Primary actions may use a restrained #2563EB to #1D4ED8 gradient with white text; verify every stop.
- Parent reports token contrast verification; rendered combinations, hover states, and public themes still require checking.
- Body/input 16px; labels and secondary copy 14px; dashboard heading 36–44px desktop/28–32px mobile.
- Editor headings 20–24px; public name 28–36px with wrapping; never shrink long names to fit one line.
- Spacing scale 4/8/12/16/24/32/48px. Editor primarily uses 8/12/16px; dashboard/auth may use 24/32px.
- Controls minimum 44px height and 44px interactive width; 12px control radius, rounded primary actions.
- Panels 16–24px radius, editor disclosures 12px; public shape choices retain their own semantics.
- Faint grid belongs only in dashboard/auth introductory backgrounds, not behind fields, dense lists, or text.
- Use borders and grouping before shadows; reserve restrained elevation for navigation and dialogs.
- Reuse one Field, button vocabulary, notice treatment, Dialog, owner shell, and ProfileRenderer across surfaces.

## Three dashboard compositions — choose one
1. **Open Canvas — 01-open-canvas.png:** compact rounded top navigation, asymmetrical intro, horizontal profile rows.
   Best continuity with current behavior; generous identity above a practical list. Recommended lowest-risk direction.
2. **Workspace Rail — 02-workspace-rail.png:** narrow desktop account/navigation rail and two-column profile tiles.
   Each tile is one real profile, not a fabricated preview; rail contains only existing Profiles/account/sign-out actions.
   On mobile, rail becomes a compact header and tiles become a single column in existing order.
3. **Profile Desk — 03-profile-desk.png:** compact top header, profile index left, published-preview pane right.
   Preview is OPTIONAL NEW UI, not existing behavior: needs explicit row selection and public-snapshot loading.
   Never substitute an owner's draft for a pane labelled Published page; private profiles need an explicit empty state.
   If selected, reconcile this dependency before coding; no implied approval to add backend endpoints or features.
- All alternatives retain search, publication filters, profile count, actual published-slot usage, and create action.
- Images 01 and 02 omit the unpublished-changes annotation: implementation MUST restore it.
- PROMPTS.md contains the exact three generation prompts and limitations; do not generate replacements for this handoff.

## Route and surface coverage
| Route/surface | Required redesign and preserved behavior |
| --- | --- |
| `/` | Preserve redirect to profiles and existing authentication routing; do not introduce a marketing homepage. |
| `/login` | White open canvas, restrained grid behind short navy/cobalt introduction, clear email form, Send code action. |
| `/auth/verify` | Same auth layout; show destination email, one six-digit input, Verify, Change email, and resend countdown. |
| `/app` owner layout | Shared Linky/account/Sign out treatment from chosen direction; no extra navigation or upgrade prompts. |
| `/app/profiles` | Chosen dashboard composition; preserve search/filter query state and return path from editor. |
| `/app/profiles/[id]/edit` | Compact operational layout below; preserve Content, Appearance, Settings and private preview. |
| `/@handle` via `[publicHandle]` | Existing published snapshot only; refresh typography/surfaces while retaining appearance settings and block order. |
| Profiles loading | Stable shell and concise Loading profiles status; optional static placeholders, no invented profile content. |
| Global error | Plain recovery heading, brief explanation, Retry action using existing reset; no loss of recovery affordances. |
| Not found/unavailable | Neutral unavailable message; do not reveal whether a page is private, unpublished, missing, or unauthorized. |
- API routes keep existing behavior and contracts; they receive no new UI or visual-only functional changes.

## Dashboard, creation, and authentication
- Show owner-only label as profile title; public name and handle remain distinguishable secondary information.
- Preserve statuses verbatim: Private draft; Published; Published · unpublished changes; Unpublished.
- Show Edit profile for every profile and View live only when published; retain edited time and its timezone.
- Distinguish empty workspace with Create your first profile from no search matches with Clear filters.
- Creation dialog retains owner-only label, public name, handle, Check availability, Cancel, Create private draft.
- Availability is not a reservation; retain explanatory copy, handle conflicts, limits, pending and uncertain outcomes.
- Authentication retains email/code validation, expired or invalid code errors, throttling, resend cooldown and safe return path.
- Keep the OTP as a single paste/autofill-friendly field; do not introduce six separate focus targets.
- Pending actions use stable-width text, prevent duplicate submission, and preserve entered values on failure.
- Long account email must not produce a tall mobile header; wrap deliberately or visually truncate with accessible full text.

## Editor — protect the compact workflow
- Apply the selected visual language without a dashboard-sized hero, decorative grid, or extra navigation rail inside editing.
- Keep compact profile switcher/save status, publication strip, section tabs, and desktop private-preview column.
- Content toolbar precedes Identity, stays sticky within Content, shows n/100 and Add link/Add text; wraps on mobile.
- Identity defaults collapsed for a named profile and expanded when name is blank; validation reveals invalid fields.
- Existing blocks default collapsed; active/new block expands while other cards stay compact; summaries retain order/icon/status.
- Add appends in public order, positions the new card for editing below the measured toolbar, and focuses URL without a second jump.
- Preserve the approved Add-specific scroll behavior; other focus changes remain nearest, including undo/reorder recovery.
- URL comes first; URL/select share roughly 2:1 columns only with sufficient pane width; stack below 560px pane width.
- Custom label uses the next row. Preserve manual override ownership and automatic detection during typing and paste.
- Known HTTP(S) hosts fill only blank/prior-auto labels; invalid/unknown destinations clear only prior-auto labels.
- Saved/restored labels and explicit selections/custom edits remain protected; no remote fetches or URL rewriting.
- Preserve 30 platform choices, exact-label icon mapping, genuine brand colors, white backings, and Kick/Snapchat tiles.
- Generic icon inherits foreground; icons remain decorative, with visible labels providing accessible names.
- Preserve Move up/down, Hide/show, Remove, Undo, text blocks, 100-block limit, and concise URL guidance.
- Appearance retains Cool white/Midnight navy, Editorial/Concise, Soft/Square; do not reset saved choices or add themes.
- Settings retains owner-only label, handle locking after first publication, and Unpublish with existing confirmation.

## Public page and publishing lifecycle
- Use an open, centered reading column with initials, name, bio, ordered text/links, and Made with Linky footer.
- No invented avatar/photo input, featured-link setting, follow button, analytics, or copied reference imagery.
- Cool white uses navy text/cobalt emphasis; Midnight navy remains dark with legible light text and brand backing tiles.
- Retain 8px Soft and square corners; do not impose workspace pill buttons on the public shape setting.
- Retain Editorial/Concise density distinction, first-link emphasis, hidden-block filtering, and long-label wrapping.
- Preview and public page share rendering; preview remains labelled private with disabled links and empty guidance.
- Draft save state and publication state are separate: saving a draft never visually claims the live page changed.
- Preserve Publish disabled reasons: saving, unchanged publication, failures, busy/uncertain operation; explain relevant reason nearby.
- Publish confirmation identifies profile/handle, snapshot behavior, first-publication handle lock, and later private edits.
- Unpublish explains unavailable public page, retained draft/handle, and released slot; use explicit action label.
- Success retains public URL, Copy link, Back to editing and View live; never show success for an uncertain result.

## Dialogs, recovery, accessibility, and responsive states
- One shared dialog frame: clear title, labelled close, body, stable action footer; mobile may fill the viewport with scrollable content.
- Preserve native modal focus containment, Escape rules while busy, safe initial focus, and return focus to trigger.
- Reload/conflict and leave dialogs retain copy-work recovery, explicit discard warning, and safe Keep editing/Stay here action.
- Reauthentication stays in context with same-owner instruction and retained draft; preserve sign-out pending/error feedback.
- Uncertain create/publish/unpublish shows Check status for the same operation; do not offer duplicate operations as recovery.
- Clipboard failure reveals selectable labelled text; errors are associated with fields and announced, not color-only.
- Desktop dashboard max width about 1120px; editor keeps up to 1440px and switches to Edit/Private preview below 1024px.
- At 320/390px stack rows/actions as needed, avoid horizontal overflow, retain 44px targets and 16px input text.
- Measure wrapped sticky-toolbar height; focused controls/errors must clear it. Software keyboard must not hide the active field.
- Meet WCAG AA targets: 4.5:1 normal text, 3:1 large text and essential control/focus boundaries; verify, do not infer from mocks.
- Preserve semantic headings, labels, keyboard operation, live statuses, non-color selection/state cues, and reduced-motion support.
- Test long names/handles, 120-character labels, multiline bio/text, empty/error/loading/success/disabled states and 200% zoom.

## Acceptance and handoff
- User selects one of the three displayed alternatives before build; selection changes composition, not the functional contract above.
- Source-backed implementation must retain all routes, permissions, model semantics, snapshot behavior, and recovery flows.
- Editor Add stays initially visible at 1440×900 and 390×844 for named profiles; twentieth-link form remains usable without unnecessary scrolling.
- Verify 320/390/1440 layouts, long content, keyboard focus/validation/undo, URL detection/manual protection, OTP and modal recovery.
- Capture dashboard, auth, Content/Appearance/Settings, dialogs, and both public themes; compare preview/public consistency.
- Designer reviews rendered outcomes; parent owns correctness and test assessment. Screenshots alone do not prove accessibility.
- Remaining decision: dashboard selection; Profile Desk additionally requires bounded preview dependency reconciliation.
- Completed: source/reference review and this specification. No application code, dependencies, database, or external state changed.
- Next role: Astra manager presents existing three visuals and obtains selection; then assigns bounded implementation to Sol.
