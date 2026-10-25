# Compact editor verification

Ready for parent Astra review and Design screenshot review. Production files: Editor.tsx, LinkLabelField.tsx, new editor.css (all selectors editor scoped). Existing global CSS, public renderer, registry, dependencies and schema untouched. Updated helpers and affected editor browser journeys; added compact-editor.spec.ts. Source patch compares task-start copies because repository remains untracked.

Native exclusive details groups close prior blocks; Add opens the new appended block and requests start alignment of its summary, then focuses URL/text without scrolling again. Native scroll clamps at document end, keeping the new URL/platform/actions visible without adding a blank spacer. Undo/reorder/validation retain nearest scrolling; removal focuses adjacent summary or Add when empty. ResizeObserver supplies the actual sticky toolbar height, including wrapping.

## Runtime measurements (CSS px, document Y)

| Viewport | Add before → after | First URL before → after | 20-card list before → after |
| --- | --- | --- | --- |
| 1440×900 | 914.6 → 311.4 | 1118.0 → 555.8 | 9668 → 1388 |
| 390×844 | 1140.4 → 545.2 | 1363.8 → 789.6 | 11548 → 1388 |

Before/after JSON files retain exact measurements. At 320px, no overflow and focused-field clearance pass; first URL may require native scrolling. At desktop/390px the initial Add is in viewport and first URL is visible after Add. The 20th Add now shows the platform and all actions as well.

## Actual checks

- lint and typecheck passed, repeated after final Add scrolling change.
- Unit suite: 87 passed / 5 files.
- Affected Chromium run: 15 passed, 2 test assumptions failed (320px document-position overconstraint; paste attempted in restored closed disclosure). Both test assumptions corrected; only those 2 rerun, both passed.
- Final Add scrolling change: 1440/390/320 compact journeys rerun with new assertions that platform and all actions fit in viewport; all 3 passed.
- 17 distinct affected browser cases verified across runs: compact layout/20th Add/keyboard/clearance/cap, validation, full OTP and publication journey, detection, save/reload, explicit Custom cache, hide/remove/undo/reorder, conflict discard, unreadable receipts and real OTP reauthentication.
- Test results: test-results/compact-editor, compact-editor-targeted, compact-editor-add-scroll. No broad DB suite or build rerun. Temporary baseline fixture initially failed missing Origin request header; corrected fixture passed. Test accounts cleaned up with existing local-only helpers.

Screenshots: before-1440.png / before-390.png; after-initial-1440.png / after-initial-390.png; after-twentieth-1440.png / after-twentieth-390.png / after-twentieth-320.png. Desktop initial and mobile twentieth captures opened and inspected; final mobile capture includes all fields/actions. Parent also captured docs/milestone-one-review/compact-editor.png.

Verified platform references: installed Next 16.4.2 local CSS/use-client guides; native details grouping/open behavior in https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element; ResizeObserver https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver.

No unresolved implementation blocker found. Next: parent completes independent Astra review and Design visual review, reconciles findings, then delivers.
