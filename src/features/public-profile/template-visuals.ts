import {
  profileTemplates,
  type ProfileTemplateId,
} from "@/features/profiles/templates";

const tags: Record<Exclude<ProfileTemplateId, "original">, string> = {
  "electric-index": "yellow bold numbered directory acid",
  "soft-motion": "peach espresso asymmetric arch soft wellness",
  "contact-sheet": "black white monochrome photography grid",
  "cobalt-objects": "blue cobalt bold poster modular shop",
  "studio-index": "white yellow studio vertical directory minimal",
  "sunday-kitchen": "cream red tomato food warm",
  "quiet-cadence": "blue mist lime music quiet airy",
  "lift-log": "black orange graphite numbered sport fitness",
  "open-house": "concrete white blue architecture minimal",
  "garden-dispatch": "yellow green forest clay garden packets",
  "night-shift": "black lime dark bold portrait",
  "route-postcard": "sky blue navy coral travel route",
  "the-big-question": "cream navy orange statement editorial",
  "objects-and-hands": "clay cream brown craft staggered",
  "distance-club": "white blue cobalt lime sport poster",
  "screening-room": "burgundy pink dark cinema poster",
  "type-practice": "white black orange typography initials grid",
  "soft-power": "lavender plum purple soft statement pills",
  "culture-receipt": "yellow cream receipt numbered dotted",
  "coastal-assembly": "seafoam navy orange coastal stepped grid",
};
export const templateOptions = [
  {
    id: "original" as const,
    name: "Original",
    tags: "classic white navy simple",
    image: "",
  },
  ...profileTemplates.map((template, index) => ({
    ...template,
    tags: tags[template.id],
    image: `/templates/${String(index + 1).padStart(2, "0")}-${template.id}.webp`,
  })),
];
export function resolveTemplate(id?: string): ProfileTemplateId {
  return templateOptions.find((item) => item.id === id)?.id ?? "original";
}
