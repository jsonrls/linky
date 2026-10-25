# Public profile templates — design QA

Latest workspace redesign: the selected Profile Desk concept passed bounded visual review. See [Profile Desk QA](docs/design-explorations/boardprep-redesign/design-qa.md) for desktop/mobile comparisons, resolved findings, and verification limits. The twenty-template review below is preserved as a separate scope.

final result: passed

Status: bounded visual review complete. No open P0/P1/P2 visual findings in the supplied evidence. This is design signoff, not release approval or full accessibility certification. Design changed review artifacts only.

## Scope and comparison method
- Contract: `docs/design-explorations/bio-styles/IMPLEMENTATION.md`; all twenty source PNGs in that directory are visual references, not literal fictional content to reproduce.
- Inspected all twenty sources alongside final implementation at 320/390/1280 viewport widths in `artifacts/template-review/final-comparisons/01-*.png` through `20-*.png`.
- Final comparison columns: source fitted to 280px; actual mobile at native 320/390px; wide template element fitted to 500px. Wide element itself is 688px inside the 1280px viewport. Original dimensions remain available in the source captures.
- Source images are 853×1844 except Quiet Cadence (1024×1536). Mobile test viewports are 320×900 and 390×844; ordinary captures show full template elements. Long-content captures show viewport regions; additional long-link crops close the below-fold gap.
- Device pixel ratio was not independently measured. Mobile pixel widths support readable comparison, not a density certification.
- Initial comparisons remain in `artifacts/template-review/comparisons/`; successful-media comparisons are in `postfix-comparisons/`. Initial and final evidence are separate.
- Actual fixture: Alex Rivera, multiline biography, five links with an interleaved text block. Reviewed order remains Selected work, Instagram, Studio notes, text, YouTube, Get in touch.
- Differences from source photography, creator names, copy, decorative marks, and hero height are intentional adaptations. No source photos or fictional marketing copy appear in reviewed user-content layouts.

## Findings and resolution history
| Finding | Before evidence | Final evidence and disposition |
| --- | --- | --- |
| P2-01: narrow asymmetric tiles split canonical labels mid-word | Initial `comparisons/04-cobalt-objects.png`, `20-coastal-assembly.png`, and focus crops; intermediate Coastal still split INSTAGRA / M | Final comparisons 04/20 at all widths; `coastal-narrow-preview.png`. Instagram intact; Get in touch wraps at words. Resolved after second Coastal adjustment. |
| P2-02: no-image cards retained empty image compartments | Initial comparisons 03 Contact Sheet and 16 Screening Room | Final comparisons 03/16 at all widths and successful-media versions. Typography now fills absent-image cards; image/caption treatment remains when supplied. Resolved. |
| Picker top crop obscured composition | Initial parent observation and CSS inspection | `picker-desktop.png`, `picker-mobile.png`: full mock fits compact thumbnail with external readable name and Example design. Recommendation implemented. |

## Final visual assessment
- Typography: sans-serif in all twenty. Display hierarchy varies; author text is retained. Ordinary labels readable at mobile widths. Oversized Cobalt long names can break words and occupy more than a viewport; accepted display-style tradeoff without hidden content.
- Layout: directory rows, vertical rail, modular grids, poster, bio-led statement, receipt, route line and featured-card variations remain distinct. These are not solely palette swaps. Text blocks break grids without reordering links.
- Mobile: 320px grids stack where needed; 390px asymmetric tiles retain readable canonical labels after fixes. Studio Index long names use horizontal fallback instead of an unreadable vertical rail.
- Color: concept palettes retained with readable dark Coastal text. Original colored Instagram/YouTube marks and white backings are visible; generic marks inherit the template color.
- Manager artifact `artifacts/template-review/contrast-pairs.json` independently read: 42 explicit static hex pairs, minimum 5.69:1 (Cobalt orange/red band), none below 4.5:1. This does not cover every interaction state, image background, or brand glyph and is not compliance certification.
- Content: no reviewed fixture content loss or unintended rearrangement. Long-name/bio endings “TOGETHE” and “plac” originate in test fixture slicing, not renderer clipping.

## Twenty-template coverage
| Templates | Final visual outcome |
| --- | --- |
| 01 Electric Index; 05 Studio Index; 08 Lift Log; 19 Culture Receipt | Directory, rail, training-sheet and receipt treatments retained; native mobile wrapping acceptable. |
| 02 Soft Motion; 06 Sunday Kitchen; 07 Quiet Cadence; 09 Open House | Distinct title alignment, feature proportions and row treatment retained. |
| 03 Contact Sheet; 16 Screening Room | Grid versus featured poster hierarchy remains; no-media fallback fix verified. |
| 04 Cobalt Objects; 20 Coastal Assembly | Modular and stepped grids remain distinct; ordinary labels fixed; long-link crops readable. |
| 11 Night Shift; 12 Route Postcard; 14 Objects and Hands | Dark link-led, route-line and offset craft compositions preserved without invented imagery. |
| 13 The Big Question; 15 Distance Club; 18 Soft Power | Bio-led statement, contained poster and lighter statement/byline remain differentiated. |
| 17 Type Practice; 10 Garden Dispatch | Initials/specimen grid and centered packet-like links remain recognizable. Actual initials replace source artifact. |

## Media, empty and long-content evidence
- Successful media inspected: `media-{soft-motion,contact-sheet,screening-room,objects-and-hands,coastal-assembly}.png`.
- Intentional abstract SVG test asset appears as avatar, cover and first-link image. It verifies image placement and mixed media/no-media layout, not real portrait focal-point quality or reference-photo fidelity.
- Labels remain separate and readable; source content order retained. No invented photographs are required for the layouts.
- Broken-media inspected: `broken-{soft-motion,route-postcard,objects-and-hands,distance-club}.png`. Empty wrappers collapse; no broken-image icons or vacant image compartments remain in these captures.
- Broken-media fixture intentionally clears biography, verified in test source. Missing biography is expected; relevant empty header/poster states are deliberate.
- Coder reports focused media E2E passed 10.4s and retry A/remove/A plus A/B/A passed 3.1s, including pre-hydration failures, wrapper hiding, editor error focus and public snapshot isolation. These runtime results are attributed, not independently rerun by Design.
- Long-content inspected: Studio Index, Cobalt Objects, Coastal Assembly and Contact Sheet at 320/390/wide; `studio-long-name-wide.png`; `long-links-{cobalt-objects,coastal-assembly}-{390,1280}.png`.
- Long-link crops show complete readable labels with no overlap/clipping; narrow columns become tall as expected. Long fixtures demonstrate compact square treatment alongside ordinary soft/editorial captures.
- Coder reports all20 100-block width/order tests at public widths and narrow editor preview, plus bounded crop test passed 3.8s. Visual inspection samples rendered regions rather than every one of 100 blocks.
- Loading transitions/layout shift were not directly recorded; success/failure stills do not establish temporal stability. No full-media-loading or photo-cropping certification claimed.

## Picker and interaction evidence
- Inspected `picker-desktop.png`, `picker-mobile.png`, `picker-candidate.png`, `picker-empty-search.png` and `coastal-narrow-preview.png`.
- Full-mock thumbnails communicate composition; readable external names, Example design, and Your content / temporary preview distinguish examples from actual content. Search focus is visible, footer actions reachable in the mobile still, empty search offers recovery.
- Parent independently reports desktop1280×720: 21 radios, autofocus search, Coastal filter returns one result, candidate uses current text, Escape restores Original and focus to Change template without changing data; console warning/error logs empty.
- Coder reports keyboard/cancel/apply through all20 plus Original preservation passed 24.1s; renderer width/order test passed 26.1s. Design did not reproduce keyboard traversal or persistence tests.
- No existing review-owner profile was mutated by Design.

## Handoff
- Design status: ready. All required representative visual surfaces supplied and inspected; both actionable P2 findings closed with post-fix evidence.
- Parent retains correctness/integration verification, including existing compact/social regression checks and any test-helper ownership decisions. Coder reports lint/typecheck and 134 unit tests passing; these are not independently rerun here.
- No application code edits or additional feature requests from Design. No further design assignment required unless integration changes rendered behavior.
