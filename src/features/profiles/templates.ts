// Order follows docs/design-explorations/bio-styles/README.md (concepts 1–20).
export const profileTemplates = [
  { id: "electric-index", name: "Electric Index" },
  { id: "soft-motion", name: "Soft Motion" },
  { id: "contact-sheet", name: "Contact Sheet" },
  { id: "cobalt-objects", name: "Cobalt Objects" },
  { id: "studio-index", name: "Studio Index" },
  { id: "sunday-kitchen", name: "Sunday Kitchen" },
  { id: "quiet-cadence", name: "Quiet Cadence" },
  { id: "lift-log", name: "Lift Log" },
  { id: "open-house", name: "Open House" },
  { id: "garden-dispatch", name: "Garden Dispatch" },
  { id: "night-shift", name: "Night Shift" },
  { id: "route-postcard", name: "Route Postcard" },
  { id: "the-big-question", name: "The Big Question" },
  { id: "objects-and-hands", name: "Objects and Hands" },
  { id: "distance-club", name: "Distance Club" },
  { id: "screening-room", name: "Screening Room" },
  { id: "type-practice", name: "Type Practice" },
  { id: "soft-power", name: "Soft Power" },
  { id: "culture-receipt", name: "Culture Receipt" },
  { id: "coastal-assembly", name: "Coastal Assembly" },
] as const;

export type ProfileTemplateId =
  "original" | (typeof profileTemplates)[number]["id"];
