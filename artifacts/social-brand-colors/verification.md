# Social brand colors handoff

Status: ready. Changed application files: `src/features/profiles/link-platforms.tsx` and `src/styles/global.css` only. No dependency, schema, label, URL, SVG path, or editor/publication behavior changes.

Every canonical platform has an explicit solid foreground color. Kick and Snapchat instead use black glyphs on their canonical green/yellow tiles, following the supplied Design decision. All brand icons have a 3px backing around their existing 22px SVG; negative margins preserve the effective slot and alignment. White backing separates dark/blue marks from primary-blue and navy surfaces. Custom retains its inherited color and has no backing. Solid monochrome marks are used for brands whose full logo is multicolor; no gradient or reconstructed paths were added.

React Icons does not ship the Simple Icons hex metadata. Browsed the official upstream Simple Icons dataset for 29 platforms. LinkedIn is absent from the current dataset; used its 13.0.0 metadata value `#0A66C2` and checked the official `https://brand.linkedin.com/in-logo` guidance, which specifies blue on white but does not expose a numeric hex in the page text. Meta's Messenger brand page requires login; its solid `#0866FF` is verified in the current Simple Icons dataset. Exact source URLs and metadata values are in `color-sources.json`.

Actual verification: `npm run lint` passed; `npm run typecheck` passed. Chromium rendered the actual shared LinkIcon component with application CSS in a temporary visual fixture, without saving or mutating any profile. Inspected `white-blue-navy.png`: Facebook, GitHub, Kick, Snapchat, YouTube and generic Custom remain visible and aligned on white, primary blue and navy. `rendered-styles.json` records the computed colors, backgrounds, sizes and margins. No tests that mirror the mapping were added; no broad suites were rerun.

Antislop delivery gate delta:

- Hard Gate PASS: scoped changes add no UI copy, claims, navigation or interactive controls; SVGs remain decorative beside accessible text. The inspected screenshot shows visible marks and intact layout on all three requested backgrounds.
- Purpose Gate PASS: source-backed brand colors identify the requested platforms; white backing separates brand marks from theme colors; black on Kick/Snapchat tiles follows the explicit Design direction. No gradients, effects or new assets.
- Liveliness PASS: existing ENERGY 1 / RHYTHM 1 / MOTION 1 and typography/layout retained; brand color is the authorized added recognition cue.
- Craftsmanship/Quality Locks PASS: explicit per-platform data stays in the shared registry, Custom inherits neutral colors, and no behavior changes. The user's explicit request for original brand colors overrides the general palette-count limit for these marks.

No unresolved implementation blocker. Recommended next role: primary Astra manager. Next assignment: review these two source changes and the supplied screenshot, reconcile Design approval, then deliver the bounded color update. Source and dependency routing were not changed and no workers were dispatched.
