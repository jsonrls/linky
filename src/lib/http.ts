import { NextResponse } from "next/server";
import { AppError, logBoundary } from "./errors";
export const noStore = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
};
export function requireOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.APP_ORIGIN;
  if (!configured)
    throw new AppError(
      "setup_incomplete",
      503,
      "The application origin is not configured.",
    );
  const canonical = new URL(configured);
  if (
    configured !== canonical.origin ||
    !["http:", "https:"].includes(canonical.protocol)
  )
    throw new AppError(
      "setup_incomplete",
      503,
      "The application origin is not configured correctly.",
    );
  // Next can construct an internal localhost URL behind its development proxy.
  // Only deployment configuration establishes trust; forwarded host headers do not.
  if (
    !origin ||
    origin !== canonical.origin ||
    request.headers.get("host") !== canonical.host
  )
    throw new AppError(
      "invalid_origin",
      403,
      "This request must come from this workspace.",
    );
}
export async function boundedBody(
  request: Request,
  max: number,
  message: string,
): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > max)
    throw new AppError("request_too_large", 413, message);
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError("invalid_request", 400, "A request body is required.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        throw new AppError("request_too_large", 413, message);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(
  request: Request,
  max = 270000,
): Promise<unknown> {
  requireOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError("invalid_request", 415, "Send a JSON request.");
  const body = await boundedBody(request, max, "This draft is too large.");
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new AppError("invalid_json", 400, "The request could not be read.");
  }
}
export async function endpoint(operation: string, run: () => Promise<unknown>) {
  const requestId = crypto.randomUUID();
  try {
    return NextResponse.json(await run(), {
      headers: { ...noStore, "X-Request-ID": requestId },
    });
  } catch (error) {
    logBoundary(operation, requestId, error);
    const failure =
      error instanceof AppError
        ? error
        : new AppError(
            "service_unavailable",
            503,
            "We could not complete this request. Please retry.",
          );
    return NextResponse.json(
      { error: { code: failure.code, message: failure.message }, requestId },
      {
        status: failure.status,
        headers: { ...noStore, "X-Request-ID": requestId },
      },
    );
  }
}
