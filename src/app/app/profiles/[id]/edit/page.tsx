import { notFound } from "next/navigation";
import { z } from "zod";
import { workspace } from "@/features/auth/server";
import { readProfile } from "@/features/profiles/server";
import { AppError } from "@/lib/errors";
import { Editor } from "@/features/editor/Editor";
export const metadata = { title: "Draft editor" };
export default async function Edit({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await (async () => {
    try {
      return await Promise.all([readProfile(id), workspace(), searchParams]);
    } catch (error) {
      if (error instanceof AppError && error.status === 404) notFound();
      throw error;
    }
  })();
  const [profile, identity, query] = result;
  return (
    <Editor
      key={id}
      initial={profile}
      workspace={identity.workspace}
      email={identity.email}
      back={
        query.back?.startsWith("/app/profiles") ? query.back : "/app/profiles"
      }
    />
  );
}
