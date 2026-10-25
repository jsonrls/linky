import {
  managedAvatar,
  photoBucket,
  photoKey,
  photoUrl,
} from "@/features/profile-photos/paths";
import { AppError, logBoundary } from "@/lib/errors";
import { noStore } from "@/lib/http";
import { publicReadClient, serverClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const headers = { ...noStore, "X-Content-Type-Options": "nosniff" };
export async function GET(
  _: Request,
  { params }: { params: Promise<{ profile: string; asset: string }> },
) {
  const requestId = crypto.randomUUID();
  const responseHeaders = { ...headers, "X-Request-ID": requestId };
  try {
    const { profile, asset } = await params;
    if (!managedAvatar(photoUrl(profile, asset)))
      return new Response(null, { status: 404, headers: responseHeaders });
    const client = await serverClient();
    const gate = await client.rpc("can_read_profile_photo", { profile, asset });
    if (gate.error)
      throw new AppError(
        "photo_permission_unavailable",
        503,
        "Photo access could not be checked.",
      );
    if (!gate.data)
      return new Response(null, { status: 404, headers: responseHeaders });
    const { data, error } = await publicReadClient()
      .storage.from(photoBucket)
      .download(photoKey(profile, asset));
    if (error || !data)
      return new Response(null, { status: 404, headers: responseHeaders });
    return new Response(data, {
      headers: { ...responseHeaders, "Content-Type": "image/webp" },
    });
  } catch (error) {
    logBoundary("read_profile_photo", requestId, error);
    return new Response(null, { status: 404, headers: responseHeaders });
  }
}
