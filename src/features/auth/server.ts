import "server-only";
import { serverClient } from "@/lib/supabase/server";
import { AppError, databaseError } from "@/lib/errors";
import type { Workspace } from "@/features/profiles/model";
export async function authenticatedClient() {
  const client = await serverClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub)
    throw new AppError(
      "unauthenticated",
      401,
      "Your session has expired. Sign in to continue.",
    );
  return {
    client,
    ownerId: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
  };
}
export async function workspace() {
  const identity = await authenticatedClient();
  const { data, error } = await identity.client.rpc("owner_workspace");
  if (error) throw databaseError(error);
  return { ...identity, workspace: data as unknown as Workspace };
}
export function safeReturn(value: string | null | undefined) {
  return value && /^\/app(?:\/|$)/.test(value) && !/[\\\r\n]/.test(value)
    ? value
    : "/app/profiles";
}
