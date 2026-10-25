import { z } from "zod";
import { authenticatedClient } from "@/features/auth/server";
import { mutationSchema, saveSchema } from "@/features/profiles/model";
import { endpoint, jsonBody } from "@/lib/http";
import { AppError, databaseError } from "@/lib/errors";
import type { Json } from "@/types/database";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; operation: string }> },
) {
  return endpoint("mutate_profile", async () => {
    const { id, operation } = await params;
    if (
      !z.uuid().safeParse(id).success ||
      !["save", "publish", "unpublish"].includes(operation)
    )
      throw new AppError("not_found", 404, "This profile is unavailable.");
    const parsed = mutationSchema.safeParse(await jsonBody(request));
    if (!parsed.success || parsed.data.expectedRevision === undefined)
      throw new AppError(
        "invalid_request",
        422,
        "A retry ID and expected revision are required.",
      );
    let body: Json = {};
    if (operation === "save") {
      const draft = saveSchema.safeParse(parsed.data.body);
      if (!draft.success)
        throw new AppError(
          "invalid_document",
          422,
          draft.error.issues[0]?.message || "Check the draft fields.",
        );
      if (Buffer.byteLength(JSON.stringify(draft.data.document)) > 262144)
        throw new AppError(
          "request_too_large",
          413,
          "The draft exceeds 256 KB.",
        );
      body = draft.data;
    } else if (
      parsed.data.body !== undefined &&
      JSON.stringify(parsed.data.body) !== "{}"
    )
      throw new AppError(
        "invalid_request",
        422,
        "Unexpected operation fields.",
      );
    const { client } = await authenticatedClient();
    const { data, error } = await client.rpc("mutate_profile", {
      kind: operation,
      operation_id: parsed.data.operationId,
      profile: id,
      expected_revision: parsed.data.expectedRevision,
      body,
    });
    if (error) throw databaseError(error);
    return data;
  });
}
