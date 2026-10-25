# Linky: Warm Editorial

Chosen by the user on October 23, 2026 for polished dashboard, editor, and public-profile designs. This direction builds on the wireframe structure; it does not select a production stack.

## Design read

An owner needs to distinguish several identities and publish confidently. The owner interface should feel like an organized studio workspace. A public profile should feel like a small editorial page with room for the creator's personality.

ENERGY 2 / RHYTHM 2 / MOTION 1. Warmth comes from ivory surfaces and expressive serif headings. Rhythm comes from grouped controls, divided profile rows, and a generous public-page opening. Motion is limited to control feedback, respecting reduced motion.

## Tokens and purpose

| Token | Value | Purpose |
| --- | --- | --- |
| Canvas | `#F7F3EB` | Warm ivory workspace |
| Surface | `#FFFCF7` | Editing panels and dialogs |
| Ink | `#24231F` | Primary text |
| Secondary text | `#625D54` | Labels and supporting context |
| Divider | `#D9D0C2` | Grouping rules, not input boundaries |
| Control border | `#81786B` | Distinguishable input boundaries |
| Primary accent | `#A54118` | Burnt-orange primary actions |
| Primary hover | `#873311` | Action feedback |
| Focus | `#175C70` | Keyboard focus |
| Error / success | `#A12D25` / `#326344` | Text-backed feedback |

Georgia provides an editorial display voice without external font downloads. Optima, Segoe UI, and system sans-serif fallbacks keep controls readable. Body text is 16/24px; supporting text is 14/20px. Controls use 8px radii, panels 12px, and dialogs 16px. Shadows are reserved for overlays.

## Composition

- Dashboard: a 1120px workspace with divided profile rows, search, and filters. No invented analytics widgets. Owner label and public handle remain visible together.
- Editor: dedicated content column and phone-width preview on wide screens; separate full-width Edit and Preview below 1024px. Saving remains distinct from publishing.
- Public page: a centered reading column with left-aligned expressive identity, full-width links, editorial text, and an optional contact section.
- Small screens: 16px gutters, wrapping actions, and dialogs sized to the viewport. Check 320, 390, 768, and 1440px layouts.

## Artifact contract

The deliverable is a local interactive design prototype with labeled demo data. Publishing, inquiries, and sharing demonstrate states without external effects. No real photography, testimonials, logos, customer metrics, or backend claims. Use demo initials and explicitly labeled artwork placeholders.

Keep the requirements and grayscale wireframes intact. Production authentication, uploads, billing, analytics, messaging, and moderation are outside this design pass.
