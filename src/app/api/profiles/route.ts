import { z } from "zod";
import { workspace, authenticatedClient } from "@/features/auth/server";
import { createSchema } from "@/features/profiles/model";
import { AppError, databaseError } from "@/lib/errors";
import { endpoint, jsonBody } from "@/lib/http";
export async function GET() {
  return endpoint("list_profiles", async () => (await workspace()).workspace);
}
export async function POST(request: Request) {
  return endpoint("create_profile", async () => {
    const parsed = z
      .object({ operationId: z.uuid(), body: createSchema })
      .strict()
      .safeParse(await jsonBody(request));
    if (!parsed.success)
      throw new AppError(
        "invalid_request",
        422,
        parsed.error.issues[0]?.message || "Check the profile fields.",
      );
    const { client } = await authenticatedClient();
    const { data, error } = await client.rpc("mutate_profile", {
      kind: "create",
      operation_id: parsed.data.operationId,
      body: parsed.data.body,
    });
    if (error) throw databaseError(error);
    return data;
  });
}
