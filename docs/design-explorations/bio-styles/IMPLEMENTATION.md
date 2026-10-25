# Twenty public profile templates — implementation design

Status: ready for UI implementation; all 20 concepts are selected. No further option-selection gate.
Scope: actual responsive public/preview layouts and compact Appearance selection; no dashboard redesign.
Evidence: README, all 20 concept images reviewed during this session, current ProfileRenderer and strict document model.
This document supersedes the pending BoardPrep direction gate for this task. Only this document was edited.

## Three governing rules
- Render author content as semantic DOM: name, bio, visible link/text blocks, and supplied images. Never render a full concept PNG as the public page or copy fictional marketing content, professions, subtitles, contact details, or photographs into it.
- Switching is non-destructive: keep every block ID, value, visibility, order, image URL, density and shape setting. Text blocks remain full-width at their existing position and break adjacent link grids; never group social links into a separate footer or promote a link across preceding text.
- Structure makes the templates distinct even without media. Preserve sans-serif typography, original brand SVG colors/backings, 44px targets, accessible focus, and readable wrapping; fidelity never requires copying the reference's tiny type or low-contrast text.

## Content mapping and template registry
IDs are the slugs below, in README order. Missing template or `original` retains the current renderer and current theme.
Each new template supplies its palette; preserve the saved legacy theme and show its control only for Original, with brief explanatory text for new templates.
Density still controls spacing and minimum row/card padding; Square removes link-card rounding, Soft uses the template's curved treatment. Neither changes grid/reading order.
“First link” means first visible link styled in its existing position; never duplicated. Every later link is rendered, including after the mock's pictured count.
Default palette names below are direction targets; implementation must choose contrast-verified values. Images never determine foreground contrast.

| # / name / ID | Distinct composition and mapping | Media and empty-media behavior |
| --- | --- | --- |
| 01 Electric Index / `electric-index` | Acid-yellow field; oversized name beside small portrait; large numbered directory rows with thin rules and circular arrows. | Avatar beside name, optional cover between bio and blocks; without media, full-width typographic masthead. |
| 02 Soft Motion / `soft-motion` | Peach/espresso split introduction, name/bio left and tall portrait right; first link broad feature panel, subsequent links shallow horizontal cards. | Avatar in arched slot, cover beneath intro; first link image within its own panel. Collapse missing slots, retain asymmetric type and feature hierarchy. |
| 03 Contact Sheet / `contact-sheet` | Monochrome compact masthead; successive links in equal two-column photo-sheet cells with consistent bottom label strips; text breaks the grid. | Each cell uses its own link image; empty cells become deliberate high-contrast title/icon tiles, never borrowed photos. Optional cover above grid. |
| 04 Cobalt Objects / `cobalt-objects` | Cobalt poster header with massive white name; consecutive links repeat a 3:2 pair then a full-width band, keeping row-major order. | Cover is header's object image, avatar small near bio; missing cover leaves compact bold type. Link images occupy their own tile tops. |
| 05 Studio Index / `studio-index` | Chalk/black with yellow accents; narrow vertical name rail plus main directory column on wide screens; ruled project rows with large arrows. | Avatar and cover share intro area only if supplied. At mobile width, name rail becomes horizontal above content to protect readable width. |
| 06 Sunday Kitchen / `sunday-kitchen` | Cream/tomato; wide cover followed by oversized name on solid cream; first link full-width filled action, subsequent links thumbnail-and-label rows. | Missing cover removes image band; thumbnail rows reflow to text/icon rows. No overlay text dependent on image color. |
| 07 Quiet Cadence / `quiet-cadence` | Mist-blue; landscape header, modest spaced name; first link pale-lime horizontal feature with square image, later links airy ruled entries. | Cover leads, avatar small by identity; missing media keeps quiet title hierarchy. No fake player, durations, or social-only footer. |
| 08 Lift Log / `lift-log` | Graphite/orange/peach; condensed nameplate, portrait/bio split; numbered training-sheet links with narrow top rule and broad label band. | Avatar/cover fill intro if supplied; otherwise full-width bio under nameplate. Numbers are decorative order cues, not invented metrics. |
| 09 Open House / `open-house` | Concrete/white/cobalt; panoramic cover, restrained identity, then oversized first-link label beside a narrow image; remaining links simple thin-rule rows. | First-link image stays attached to that link; absent image expands label column. No vacant architectural image frame. |
| 10 Garden Dispatch / `garden-dispatch` | Pale-yellow/forest/clay; centered stacked name; links resemble seed packets with small image column, strong label and inner divider. | Cover is top panorama; missing thumbnails yield full-width packet typography. No invented descriptions beneath labels. |
| 11 Night Shift / `night-shift` | Black/lime; huge name and bio at top, first link filled and others outlined; portrait/cover is a closing visual below all blocks. | Closing image uses cover, otherwise avatar; with neither, omit it. Keep links above media; no artificial cutouts or background removal. |
| 12 Route Postcard / `route-postcard` | Sky/navy/coral; framed cover over centered identity; link cards sit beside a decorative vertical route line with sequential nodes. | Own link thumbnails appear within cards; no inferred locations, stamps, or place names. Empty cover removes postcard frame. |
| 13 The Big Question / `the-big-question` | Cream/navy/orange; bio is the dominant opening statement, name/avatar a compact byline; plain broad links below. | Empty bio promotes name to the main visual role; optional cover closes page. Full 300-character bio wraps, never truncates or rewrites as a question. |
| 14 Objects and Hands / `objects-and-hands` | Clay/cream/espresso; name/bio beside a staggered two-image header, then wide collection-style links with first filled and later outlined. | Avatar and cover provide the two images; one image uses one slot, none yields offset name/bio typography. No repeated name required to fill space. |
| 15 Distance Club / `distance-club` | Chalk/cobalt/lime; compact centered identity, large cobalt poster field containing the actual bio, then alternating outlined/filled link bands. | Avatar above name; cover can sit within poster without obscuring bio. Never insert “GO OUTSIDE”; omit poster if bio and cover are both absent. |
| 16 Screening Room / `screening-room` | Burgundy/pink; cinematic cover, tall condensed name; first link poster panel with separate solid label band, later links slim ruled rows. | First link image supplies poster; no play control or invented film credits. Without images, text-led marquee and prominent first-link panel remain. |
| 17 Type Practice / `type-practice` | White/black/orange; large initials beside name/bio; first link full-width contrasting specimen panel, later adjacent links equal modular grid cells. | Initials derive from actual name, never mock “KE MERCER”. Optional cover after identity; link images fit grid cells without adding fake specimen text. |
| 18 Soft Power / `soft-power` | Lavender/plum; small name and avatar in upper corners, large bio statement below, quiet filled/outlined pill links. | Missing avatar gives name full width; optional cover below bio. No fabricated email/footer CTA; contact links remain normal ordered blocks. |
| 19 Culture Receipt / `culture-receipt` | Yellow surround, narrow cream receipt column; centered identity and numbered links separated by dotted rules; compact typography and round arrows. | Avatar at receipt top, optional cover below bio; no fabricated receipt totals, barcode, professions or closing slogan. |
| 20 Coastal Assembly / `coastal-assembly` | Seafoam/navy/orange; wide name, panoramic cover; successive links repeat 3:2 stepped pair then full-width journal band. | Own images stay inside corresponding cards; missing images retain varied solid panels. Use dark text on orange/seafoam; decorative angles never rotate text or targets. |

## Compact picker and editor flow
- Appearance begins with one “Template” row: small current thumbnail, name, and 44px “Change template” button; do not inline 20 tall previews.
- Change opens a labelled searchable dialog/popover: constrained desktop panel, full-screen mobile dialog; search stays above independently scrolling results.
- List all 20 plus Original. Use labelled radio choices in compact thumbnail tiles, 2–3 columns desktop and 1–2 mobile as readable width permits; no horizontal carousel.
- Search matches names and simple style tags; show result count, clear-search action and “No matching templates” state. Original remains discoverable by name.
- Selecting a candidate updates a temporary preview of the current draft; “Use template” commits to normal draft autosave. Cancel/Escape discards candidate only.
- Keep actual user preview distinct from concept thumbnails labelled “Example design”; sample photos never transfer to the profile.
- Keyboard: focus search on open, native radio navigation within results, accessible selected state, visible focus, Escape closes, focus returns to Change template.
- Use template closes the picker, announces the chosen name, and preserves Content state, scroll, existing custom labels, and image values. Publication remains a separate explicit flow.
- Do not render 20 live profiles at once; picker thumbnails may use the existing mock PNGs, while the candidate uses the shared real renderer.

## Optional media — resolved product decision
- Persist optional `appearance.avatarUrl`, `appearance.coverUrl`, and link `imageUrl`; HTTPS-only render/publish. Model/SQL compatibility is owned by parent/Research/Coder.
- Appearance → collapsed “Profile images (optional)” reveals Avatar URL and Cover URL; each has a small preview, replace/edit field, and Remove image action.
- Expanded link details retain URL-first/select layout; collapsed “Link image (optional)” reveals its image URL. Never add media fields to the default fast Add flow.
- Empty URL is valid and selects the documented fallback. Keep invalid drafts editable with associated errors; prevent invalid images from rendering or publishing.
- Loading reserves the intended image ratio; failed loads use the same image-free layout with an editor-only “Could not load image” message. Do not block navigation through links.
- No remote image discovery or reference-photo cropping. Use user-supplied URLs only; use centered crops without face detection and preserve images that a template does not currently display.
- These images are decorative supplements to visible name/link/bio text: empty alt prevents duplicate announcements. Essential meaning must stay in editable text; no new unrequested caption fields.

## Responsive, state, and acceptance requirements
- Public renderer and private preview use identical template logic; preview links stay disabled, public links work normally, and unavailable publication behavior remains unchanged.
- All 20 must show structural differences with the same name/bio/links and no images; screenshots of palette swaps on one shared layout fail acceptance.
- Validate at 320, 390 and wide desktop sizes plus the narrow preview pane; use container width, not viewport alone. Two-column links collapse when labels cannot remain readable.
- DOM, keyboard and visual order must agree. No CSS dense packing, masonry reordering, truncation, fixed page heights, or overflow clipping of long author content.
- Maintain 44px targets, body text at least 16px, secondary labels at least 14px, visible focus, 4.5:1 normal text contrast and non-color selection cues; verify rendered combinations.
- Decorative brand icons keep original colors and current contrast backings in every template, even monochrome designs. Generic icons inherit readable foreground color.
- Test 0/1/2/20/100 blocks; interleaved text; hidden first link; long name/bio/label; no media, partial media, broken media; both shapes and densities; keyboard and reduced motion.
- Switch Original → every template → Original and reload: content/media/order unchanged; legacy colors restored; draft/public snapshot isolation intact. Unknown template ID must safely render Original without erasing stored content.
- No-image fallback is intentional, not pixel parity with photographic mocks. Refine 05's mobile width, 17's generated-copy artifact, and 20's contrast in implementation.
- UI coder may start from this contract; parent resolves strict model/SQL compatibility and safe media handling before dependent integration. No production implementation performed by Design.
- Return a labelled contact sheet of all 20 actual rendered templates plus representative image-free/mobile cases for Design review; manager owns integration, runtime checks and final delivery.
