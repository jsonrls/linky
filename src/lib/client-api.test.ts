import { it, expect, afterEach, vi } from "vitest";
import { api, RequestError, unresolvedRequest } from "./client-api";
afterEach(() => vi.unstubAllGlobals());
it("treats unreadable successful responses as unresolved", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })),
  );
  await expect(api("/save", {})).rejects.toMatchObject({
    code: "uncertain",
    status: 200,
  });
  expect(
    unresolvedRequest(new RequestError("uncertain", 200, "Unreadable")),
  ).toBe(true);
});
it("keeps retry identity across authentication interruption and server ambiguity", () => {
  expect(
    unresolvedRequest(new RequestError("unauthenticated", 401, "Expired")),
  ).toBe(true);
  expect(
    unresolvedRequest(new RequestError("service_unavailable", 503, "Retry")),
  ).toBe(true);
  expect(
    unresolvedRequest(new RequestError("revision_conflict", 409, "Conflict")),
  ).toBe(false);
});
