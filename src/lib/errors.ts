export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const definitions: Record<string, [number, string]> = {
  unauthenticated: [401, "Your session has expired. Sign in to continue."],
  account_unavailable: [
    403,
    "Your workspace is unavailable. Contact your account administrator.",
  ],
  not_found: [404, "This profile is unavailable."],
  revision_conflict: [
    409,
    "A newer draft was saved in another tab. Copy your unsaved work or reload the latest draft.",
  ],
  idempotency_conflict: [
    409,
    "This retry ID belongs to a different request. Check the latest status before continuing.",
  ],
  handle_taken: [409, "This handle was just claimed. Choose another handle."],
  handle_locked: [409, "The handle is fixed after the first publication."],
  invalid_handle: [422, "Choose a valid, unreserved handle."],
  profile_limit: [409, "You have reached the total profile limit."],
  published_limit: [
    409,
    "You have reached your published-profile limit. Unpublish a page to free a slot.",
  ],
  invalid_document: [422, "Check the draft fields and content limits."],
  invalid_request: [422, "Check the request fields."],
  invalid_visible_link: [
    422,
    "Every visible link needs a label and a valid HTTP or HTTPS URL.",
  ],
  invalid_media_url: [422, "Use valid HTTPS image URLs without credentials."],
  invalid_visible_text: [422, "Every visible text block needs text."],
  incomplete_profile: [
    422,
    "Add a public name and at least one visible content block.",
  ],
};
export function databaseError(error: { message: string; code?: string }) {
  const definition = definitions[error.message];
  return definition
    ? new AppError(error.message, ...definition)
    : new AppError(
        "service_unavailable",
        503,
        "We could not reach your workspace. Please retry.",
      );
}
export function logBoundary(
  operation: string,
  requestId: string,
  error: unknown,
) {
  console.error(
    JSON.stringify({
      operation,
      requestId,
      code: error instanceof AppError ? error.code : "unexpected_error",
    }),
  );
}
