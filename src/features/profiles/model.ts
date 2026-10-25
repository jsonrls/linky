import { z } from "zod";
import { profileTemplates } from "./templates";
import { managedAvatar } from "@/features/profile-photos/paths";

export const handlePattern = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
export const reservedHandles = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "help",
  "login",
  "logout",
  "privacy",
  "settings",
  "signup",
  "support",
  "terms",
  "www",
  "linky",
]);
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    handlePattern,
    "Use 3–30 lowercase letters, digits, or hyphens, with a letter or digit at each end.",
  )
  .refine((value) => !reservedHandles.has(value), "This handle is reserved.");
const baseBlock = { id: z.uuid(), visible: z.boolean() };
export const blockSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...baseBlock,
      type: z.literal("link"),
      label: z.string().max(120),
      url: z.string().max(2048),
      imageUrl: z.string().max(2048).optional(),
    })
    .strict(),
  z
    .object({
      ...baseBlock,
      type: z.literal("text"),
      text: z.string().max(2000),
    })
    .strict(),
]);
export const documentSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().max(80),
    bio: z.string().max(300),
    appearance: z
      .object({
        theme: z.enum(["warm", "ink"]),
        layout: z.enum(["editorial", "compact"]),
        shape: z.enum(["soft", "square"]),
        template: z
          .enum(["original", ...profileTemplates.map(({ id }) => id)])
          .optional(),
        avatarUrl: z.string().max(2048).optional(),
        coverUrl: z.string().max(2048).optional(),
      })
      .strict(),
    blocks: z
      .array(blockSchema)
      .max(100)
      .refine(
        (blocks) =>
          new Set(blocks.map((block) => block.id)).size === blocks.length,
        "Each block needs a unique ID.",
      ),
  })
  .strict();
export const createSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(80),
    handle: handleSchema,
  })
  .strict();
export const saveSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    handle: handleSchema,
    document: documentSchema,
  })
  .strict();
export const mutationSchema = z
  .object({
    operationId: z.uuid(),
    expectedRevision: z.number().int().min(0).optional(),
    body: z.unknown().optional(),
  })
  .strict();
export type ProfileDocument = z.infer<typeof documentSchema>;
export type Block = z.infer<typeof blockSchema>;
export type EditableProfile = z.infer<typeof saveSchema>;
export type ProfileSummary = {
  id: string;
  label: string;
  name: string;
  handle: string;
  firstPublishedAt: string | null;
  publicationId: string | null;
  publishedRevision: number | null;
  revision: number;
  updatedAt: string;
};
export type Profile = Omit<ProfileSummary, "name"> & {
  document: ProfileDocument;
};
export type Workspace = {
  ownerId: string;
  publishedLimit: number;
  profileLimit: number;
  profiles: ProfileSummary[];
};
export type PublishedProfile = {
  handle: string;
  publicationId: string;
  document: ProfileDocument;
};
export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] || "")
      .join("")
      .toUpperCase() || "?"
  );
}
export function publicationStatus(
  profile: Pick<
    ProfileSummary,
    "publicationId" | "publishedRevision" | "revision" | "firstPublishedAt"
  >,
) {
  if (profile.publicationId)
    return profile.publishedRevision === profile.revision
      ? "Published"
      : "Published · unpublished changes";
  return profile.firstPublishedAt ? "Unpublished" : "Private draft";
}
export function safeUrl(value: string) {
  if (value.length > 2048 || /[\s\x00-\x1f\x7f\\]/.test(value)) return false;
  const parts = value.match(
    /^https?:\/\/(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(:([0-9]{1,5}))?([/?#].*)?$/i,
  );
  if (
    !parts ||
    (parts[3] && (Number(parts[3]) < 1 || Number(parts[3]) > 65535))
  )
    return false;
  const host = parts[1];
  if (
    !host.startsWith("[") &&
    (host.length > 253 ||
      !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(
        host,
      ))
  )
    return false;
  if (
    /^[0-9.]+$/.test(host) &&
    (!/^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host.split(".").some((part) => Number(part) > 255))
  )
    return false;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function safeMediaUrl(value: string) {
  return /^https:\/\//i.test(value) && safeUrl(value);
}
export function safeAvatarUrl(value: string) {
  return !!managedAvatar(value) || safeMediaUrl(value);
}
export function publicationIssue(
  document: ProfileDocument,
): { field: string; message: string } | null {
  if (!document.name.trim())
    return {
      field: "public-name",
      message: "Add a public display name before publishing.",
    };
  for (const field of ["avatarUrl", "coverUrl"] as const) {
    const url = document.appearance[field];
    // SQL btrim considers only ordinary spaces empty for optional media.
    if (
      url &&
      /[^ ]/.test(url) &&
      !(field === "avatarUrl" ? safeAvatarUrl(url) : safeMediaUrl(url))
    )
      return {
        field: field === "avatarUrl" ? "avatar-url" : "cover-url",
        message:
          "Use an HTTPS image URL without credentials and with a valid host and port.",
      };
  }
  const blocks = document.blocks.filter((block) => block.visible);
  if (!blocks.length)
    return {
      field: "add-content",
      message: "Add or show at least one content block before publishing.",
    };
  for (const block of blocks) {
    if (block.type === "link") {
      if (!block.label.trim())
        return {
          field: `label-${block.id}`,
          message: "Add a label to this visible link.",
        };
      if (!safeUrl(block.url))
        return {
          field: `url-${block.id}`,
          message:
            "Use an HTTP or HTTPS URL without credentials and with a valid host and port.",
        };
      if (
        block.imageUrl &&
        /[^ ]/.test(block.imageUrl) &&
        !safeMediaUrl(block.imageUrl)
      )
        return {
          field: `image-${block.id}`,
          message:
            "Use an HTTPS image URL without credentials and with a valid host and port.",
        };
    } else if (!block.text.trim())
      return {
        field: `text-${block.id}`,
        message: "Add text to this visible block.",
      };
  }
  return null;
}
export function publicationError(document: ProfileDocument) {
  return publicationIssue(document)?.message ?? null;
}
