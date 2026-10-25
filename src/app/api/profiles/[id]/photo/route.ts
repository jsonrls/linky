import { authenticatedClient } from "@/features/auth/server";
import {
  canonicalUuid,
  photoBucket,
  photoByteLimit,
  photoKey,
  photoUrl,
} from "@/features/profile-photos/paths";
import {
  normalizePhoto,
  photoContentType,
  parsePhotoCrop,
} from "@/features/profile-photos/image";
import { photoCropHeader } from "@/features/profile-photos/crop";
import { AppError, databaseError } from "@/lib/errors";
import { boundedBody, endpoint, requireOrigin } from "@/lib/http";
import { publicReadClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint("upload_profile_photo", async () => {
    requireOrigin(request);
    const { id } = await params;
    if (!canonicalUuid.test(id) || id.length !== 36)
      throw new AppError("not_found", 404, "This profile is unavailable.");
    const { client } = await authenticatedClient();
    const owner = await client.rpc("read_profile", { profile: id });
    if (owner.error) throw databaseError(owner.error);
    const contentType = photoContentType(request.headers.get("content-type"));
    const bytes = await boundedBody(
      request,
      photoByteLimit,
      "Choose a photo of 3 MB or less.",
    );
    const crop = parsePhotoCrop(request.headers.get(photoCropHeader));
    const normalized = await normalizePhoto(bytes, contentType, crop);
    const asset = crypto.randomUUID();
    const { error } = await publicReadClient()
      .storage.from(photoBucket)
      .upload(photoKey(id, asset), normalized, {
        contentType: "image/webp",
        upsert: false,
      });
    if (error)
      throw new AppError(
        "photo_storage_unavailable",
        503,
        "Your photo could not be uploaded. Your previous photo is unchanged. Please retry.",
      );
    return { avatarUrl: photoUrl(id, asset) };
  });
}
