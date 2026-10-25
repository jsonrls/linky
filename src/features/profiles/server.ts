import "server-only";
import { cache } from "react";
import { authenticatedClient } from "@/features/auth/server";
import { AppError, databaseError } from "@/lib/errors";
import { publicReadClient } from "@/lib/supabase/server";
import type { Profile, PublishedProfile } from "./model";
export async function readProfile(id: string) {
  const { client } = await authenticatedClient();
  const { data, error } = await client.rpc("read_profile", { profile: id });
  if (error) throw databaseError(error);
  return data as unknown as Profile;
}
// React cache deduplicates only within this render, including generateMetadata.
export const readPublicProfile = cache(async (handle: string) => {
  const { data, error } = await publicReadClient().rpc("public_profile", {
    handle,
  });
  if (error)
    throw new AppError(
      "service_unavailable",
      503,
      "We could not load this page. Please retry.",
    );
  return data as unknown as PublishedProfile | null;
});
