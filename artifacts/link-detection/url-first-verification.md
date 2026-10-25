# URL-first link editor followup

Status: ready.

Changed: src/features/editor/Editor.tsx; tests/e2e/link-detection.spec.ts; tests/e2e/social-links.spec.ts.

Destination URL now precedes Link label; Add link focuses the URL input. Existing detection and explicit-label handlers, persistence, and publication-validation focus are unchanged. Updated both prior add-link focus expectations; detection test additionally checks URL focus and Tab order into Link label.

Actual verification:
- npm run lint: passed.
- npm run typecheck: passed.
- Focused Chromium selection: 4 passed (21.8s), covering all three detection journeys plus blank-choice/empty-Custom validation focus, hide and undo. Command: npx playwright test tests/e2e/link-detection.spec.ts tests/e2e/social-links.spec.ts --project=chromium --grep 'clipboard detection|saved empty labels|conflict discard clears automatic|blank choice and empty Custom' --output=test-results/link-url-first --reporter=list
- No broad suite, dependency or schema changes.
- editor-url-first.png captured from real clipboard journey, opened and inspected: fully loaded URL-first form, detected YouTube label/icon, URL retains focus.
- url-first-changes.patch compares actual task-start copies, preserving existing untracked work.

Decisions/assumptions: user field-order direction applied directly. No unresolved issue.
Recommended next role: parent Astra review. Assignment: inspect bounded patch and screenshot; confirm new add-link focus/order and unchanged validation focus, then deliver.
