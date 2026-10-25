# Linky · Warm Editorial design prototype

Open `index.html` in a modern browser, or serve this folder with a local static server. No dependencies, build, remote fonts, API calls, or production backend. All names, content, destinations, and artwork labels are demo material.

## Routes

- `#/profiles`: profile list, search, publication filters, create dialog, reset.
- `#/edit/mara`: content editor and private draft preview.
- `#/@mara-ellis`: the last published local snapshot, with a demo inquiry form.
- `#/edit/sunday` and `#/@sunday-table`: a second published fictional profile.
- `#/edit/field`: an unpublished draft. `#/@field-notes` is unavailable until demo publication.

## Review the interaction

1. Edit Mara's name, bio, or a link. The preview changes immediately. Saving happens after a short idle period and reports success only after browser storage accepts it.
2. Open View live demo. The published snapshot retains the old content. Return to the editor, choose Publish demo changes, and confirm. The local public view now uses the new snapshot.
3. Open a content block to edit it. Move up/down, hide/show, remove/undo, and Add link work with native buttons. Hidden blocks stay editable and are omitted from the preview and snapshot. Only links can be added in this bounded prototype; existing text, artwork placeholders, and inquiry blocks can be edited.
4. Appearance offers Warm paper / Evening ink, Editorial / Concise spacing, and Soft / Square link corners. These change the draft only until publication.
5. Settings edits the owner-only label and the handle before first publication. Unpublish requires confirmation, retains the draft, and makes the local public route unavailable.
6. Share copies the local demo URL. If clipboard access is unavailable, it selects the URL and explains manual copying. The URL works only with the local files/server and matching demo data in that browser. It is not internet publishing.
7. Submit the public demo form empty or with an invalid email to see inline errors. Valid fictional details produce “Demo submission complete. Nothing was sent.” Inquiry details are neither stored nor delivered.
8. Public destinations open a local information dialog. No dummy links navigate to the internet.

Prototype review states are in the footer: dashboard loading, empty workspace, list failure, and editor save failure. Retry exits the simulated failure. These are explicit review controls, not service simulations.

## Demo storage and boundaries

Only fictional profile content is stored under `linky-warm-editorial-demo-v1` in `localStorage`. Reset demo requires confirmation and replaces only this prototype's key. Storage errors remain visible; unsaved navigation offers staying or discarding. A storage change from another tab prompts reloading rather than silently overwriting it. This is a browser demonstration, not a transactional multiuser system. Direct file storage behavior can vary by browser; a local static server gives a consistent origin.

There is no authentication, backend, upload, payment, QR generation, billing, analytics, moderation service, real inbox, or real publication. The production requirements remain a separate future implementation. Do not enter personal or confidential information. The demo caps itself at 30 profiles and 30 blocks per profile to keep local state bounded.

## Visual decisions

- Warm cream and dark ink make the workspace feel like an editorial desk; burnt orange identifies the primary action.
- Georgia gives identities and section titles a considered printed voice; Optima/Segoe UI/system type keeps controls readable without remote fonts.
- The dashboard is a ruled list because profiles are identities to find and open, rather than metrics to compare.
- Numbered editing sections and public link indices repeat a quiet editorial motif and communicate order.
- Spacing separates identity, destinations, artwork, and inquiry content; the public column stays at 560px maximum.
- A 420px desktop preview pane holds a 360px preview. Below 1024px, Edit and Private preview are separate views. Mobile gutters are 16px and dialogs fill the screen below 480px.
- Flat surfaces and 8/12/16px radii distinguish controls, content groups, and dialogs without floating cards.
- Initials and labeled artwork placeholders reserve identity and image space honestly. There are no generated visual assets.
- Destination arrows appear only on public link controls to signal the destination action. Other actions use explicit text.
- Motion is limited to hover/pressed feedback. The fixed warm workspace follows the selected direction; the optional dark profile theme demonstrates an appearance choice.
- Dials: ENERGY 2 / RHYTHM 2 / MOTION 1. The profile name is the public focal point; the create action anchors the dashboard and the identity form anchors editing.

## Verification and delivery gate

`node --check docs/designs/app.js` passed. A source review checked HTML escaping, HTTP/HTTPS destination validation, separate cloned draft/snapshot state, local-only storage, input labels, native dialogs, focus outlines, keyboard reorder controls, and explicit demo feedback. No packages were installed.

A nonbrowser Node VM smoke check with minimal DOM stubs passed the dashboard, editor, published profile, and unavailable profile render paths. It also exercised a name edit, immediate preview update, local save on navigation, and confirmed that the public output and stored snapshot retained the original name while the stored draft held the edited name. This is a logic smoke check, not rendered UI testing.

Antislop source gates:

- Hard gate, source checks PASS: explicit demo labels, honest placeholders, existing hash destinations, working event handlers, empty/loading/error review states, no remote calls, fabricated metrics, testimonials, generated assets, or em-dash copy.
- Purpose gate PASS: visual choices and their functions are recorded above; no gradients, glows, decorative icon sets, floating card grid, or animation stack.
- Liveliness source gate PASS: declared direction and dials, serif motif, numbered order, selective accent, and content-driven list/editor/reading compositions.
- Craftsmanship source gate PASS: one shared public/preview renderer, constrained presets, explicit action labels, recoverable local save feedback, and clearly disclosed limits.

Parent-reported supported-browser verification is recorded in [REVIEW.md](REVIEW.md). Dashboard, editor, and public views were inspected at 320, 390, 768, and 1440 CSS-pixel widths with no horizontal overflow. Verified interactions included dashboard search; profile creation; adding, editing, hiding, showing, removing, and restoring a link; private draft/public snapshot separation followed by confirmed demo publication; an unaffected second profile; successful share copying; Evening ink in the mobile preview; empty inquiry errors and a valid no-send demo submission; save-failure protection during profile switching with the correct active handle and successful retry; skip-link activation with Enter retaining the current route and focusing main; and dialog dismissal with Escape. The parent reported no browser errors or warnings and a passing JavaScript syntax check.

Review exports in [screenshots/](screenshots/) are viewport-only captures. The browser's full-page export cropped the image; this is an export limitation, not evidence of a layout crop.

This is a bounded verification record, not a complete control-suite pass. Native browser zoom, the mobile on-screen keyboard, reduced-motion behavior, and a comprehensive keyboard/accessibility audit were not verified in the reported checks. The source gates do not establish a complete rendered delivery-gate pass. No accessibility certification or production readiness is claimed. Review assets and the independent review record belong to the parent.
