# Crop flow integration review

Scope: device-photo adjustment before upload. Existing publication and storage behavior is preserved. No deployment or database change.

Accepted after independent source review, Design screenshot review, and parent browser checks. Parent used a synthetic four-color image, changed zoom to 300%, moved it, reset to 100%, and canceled. Focus returned to Upload photo and the existing profile remained unchanged. Evidence: `parent-dialog.png`.

Checks inspected: 48 focused unit tests; 10 Chromium browser tests; 7 WebKit tests with 3 existing Chromium-only cases skipped; 4 affected responsive/session cases rerun across Chromium and WebKit after the layout fix. Final lint, type check, and build logs pass. Firefox was not tested in this change. Earlier failed logs are superseded by the final/complete logs; they are retained as investigation history.

Review corrections: known session expiry now prevents crop submission; short screens use nonshrinking content in a scrolling body, keeping footer actions available. Design reviewed 11 regenerated captures and accepted the scrolling tradeoff. No remaining blocking findings.

## Scoped UI delivery gate

- PASS R-02/R-16: task-specific control copy, no new marketing language or em-dash copy.
- PASS R-03/R-32/C-4: responsive checks and regenerated 320px/short-height screenshots show no overlapping controls or horizontal overflow; keyboard, focus restoration, and scrolling controls were exercised.
- PASS R-17/R-18/R-23/R-36/R-38/C-5: no invented customer content or claims. All generated images are clearly test fixtures.
- PASS R-24/R-26/R-27/R-28/R-35/C-2: no new navigation or FAQ; choose, cancel, reset, move, zoom, upload, retry, decoding, loading, and session-error paths have implemented behavior and browser coverage; production build passes.
- PASS R-25: existing navy/white/blue text and action palette retained; Design reviewed actual renders. This is scoped visual review, not a whole-app accessibility certification.
- PASS R-33/R-34: feature is implemented in application source; no runtime source patching or new theme toggle.
- PASS R-37: approved compact editor direction, ENERGY 1 / RHYTHM 1 / MOTION 1. The square preview is the focal point; spacing groups controls, blue identifies the primary action, and the existing sans typography and outlined controls preserve identity.
- PASS R-01/R-04/R-06/R-07/R-08/R-09/R-10/R-12/R-13/R-14/R-19/R-22: no new decorative gradients, glows, badges, grids, glass, illustrations, or animation. Direction arrows operate image movement; modal elevation separates the active task. Typography follows the existing product.
- PASS R-05/R-11/R-15/R-20/R-21/R-29/R-30/R-31/C-1/C-3: one focused adjustment dialog, explicit action labels, existing radii and palette, no filler sections or copied product redesign. Controls exist to adjust or confirm the selected image.

The uploaded photo remains private until the profile is published. Cancel never starts an upload. Original bytes still pass server validation before the selected square is extracted and encoded.
