import { workspace } from "@/features/auth/server";
import { endpoint } from "@/lib/http";
export async function GET() {
  return endpoint("session", async () => {
    const { ownerId, email } = await workspace();
    return { ownerId, email };
  });
}
