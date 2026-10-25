import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { endpoint, jsonBody } from "@/lib/http";
import { AppError } from "@/lib/errors";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint("auth", async () => {
    const { action } = await params;
    const body = await jsonBody(request, 4096);
    const client = await serverClient();
    if (action === "signout") {
      const { error } = await client.auth.signOut();
      if (error)
        throw new AppError(
          "signout_failed",
          503,
          "Could not sign out. Please retry.",
        );
      return { ok: true };
    }
    const parsed = z
      .object({
        email: z.email().max(254),
        token: z
          .string()
          .regex(/^\d{6}$/)
          .optional(),
      })
      .strict()
      .safeParse(body);
    if (!parsed.success)
      throw new AppError(
        "invalid_auth_input",
        422,
        "Enter a valid email address and six-digit code.",
      );
    if (action === "send") {
      const { error } = await client.auth.signInWithOtp({
        email: parsed.data.email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        if (error.status === 429 || error.code === "over_email_send_rate_limit")
          throw new AppError(
            "rate_limited",
            429,
            "Please wait before requesting another code.",
          );
        throw new AppError(
          "auth_unavailable",
          503,
          "We could not request a code. Check your connection and retry.",
        );
      }
      return {
        message: "If this address can receive a code, it will arrive shortly.",
        retryAfter: 60,
      };
    }
    if (action === "verify" && parsed.data.token) {
      const { error } = await client.auth.verifyOtp({
        email: parsed.data.email,
        token: parsed.data.token,
        type: "email",
      });
      if (error)
        throw new AppError(
          "invalid_code",
          error.status === 429 ? 429 : 422,
          error.status === 429
            ? "Too many attempts. Please wait and retry."
            : "This code is invalid or expired. Check the newest email or request another code.",
        );
      return { ok: true };
    }
    throw new AppError("not_found", 404, "This action is unavailable.");
  });
}
