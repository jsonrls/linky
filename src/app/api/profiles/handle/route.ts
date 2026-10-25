import { handleSchema } from "@/features/profiles/model";
import { authenticatedClient } from "@/features/auth/server";
import { endpoint } from "@/lib/http";
import { AppError, databaseError } from "@/lib/errors";
export async function GET(request: Request) {
  return endpoint("check_handle", async () => {
    const parsed = handleSchema.safeParse(
      new URL(request.url).searchParams.get("handle"),
    );
    if (!parsed.success)
      throw new AppError("invalid_handle", 422, parsed.error.issues[0].message);
    const { client } = await authenticatedClient();
    const { data, error } = await client.rpc("handle_available", {
      handle: parsed.data,
    });
    if (error) throw databaseError(error);
    return { available: data };
  });
}
