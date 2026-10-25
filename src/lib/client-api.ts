export class RequestError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function unresolvedRequest(error: unknown) {
  return (
    !(error instanceof RequestError) ||
    error.code === "uncertain" ||
    error.status === 0 ||
    error.status === 401 ||
    error.status >= 500
  );
}
export async function api<T>(url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new RequestError(
      "uncertain",
      0,
      "Could not confirm the request. Your work is still in this tab.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new RequestError(
      "uncertain",
      response.status,
      "Could not confirm the request. Check its status before continuing.",
    );
  }
  if (!response.ok)
    throw new RequestError(
      result.error?.code || "service_unavailable",
      response.status,
      result.error?.message || "Please retry.",
    );
  return result as T;
}
