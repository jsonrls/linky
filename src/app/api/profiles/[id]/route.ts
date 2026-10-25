import { z } from "zod";
import { endpoint } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { readProfile } from "@/features/profiles/server";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint("read_profile", async () => {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new AppError("not_found", 404, "This profile is unavailable.");
    return readProfile(id);
  });
}
