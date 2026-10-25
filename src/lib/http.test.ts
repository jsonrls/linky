import { it, expect, vi, afterEach } from "vitest";
import { jsonBody } from "./http";
afterEach(() => vi.unstubAllEnvs());
function request(origin: string, host = "127.0.0.1:3000") {
  return new Request("http://localhost:3000/api/auth/send", {
    method: "POST",
    headers: { origin, host, "content-type": "application/json" },
    body: '{"value":"allowed"}',
  });
}
it("accepts canonical browser origin despite Next internal localhost URL", async () => {
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
  await expect(jsonBody(request("http://127.0.0.1:3000"))).resolves.toEqual({
    value: "allowed",
  });
});
it("rejects attacker origins and spoofed host headers", async () => {
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
  await expect(
    jsonBody(request("https://attacker.example")),
  ).rejects.toMatchObject({ code: "invalid_origin", status: 403 });
  await expect(
    jsonBody(request("http://127.0.0.1:3000", "attacker.example")),
  ).rejects.toMatchObject({ code: "invalid_origin", status: 403 });
});
it("requires explicitly configured preview origin", async () => {
  vi.stubEnv("APP_ORIGIN", "https://preview.example");
  await expect(
    jsonBody(request("https://preview.example", "preview.example")),
  ).resolves.toEqual({ value: "allowed" });
  await expect(
    jsonBody(request("http://127.0.0.1:3000")),
  ).rejects.toMatchObject({ status: 403 });
});
