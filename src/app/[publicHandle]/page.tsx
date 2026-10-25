import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { readPublicProfile } from "@/features/profiles/server";
import { ProfileRenderer } from "@/features/public-profile/ProfileRenderer";
import { handleSchema } from "@/features/profiles/model";
type Props = { params: Promise<{ publicHandle: string }> };
async function lookup(params: Props["params"]) {
  await connection();
  const { publicHandle } = await params;
  // Metadata may receive an encoded segment while the page receives decoded params.
  let segment: string;
  try {
    segment = decodeURIComponent(publicHandle);
  } catch {
    notFound();
  }
  if (!segment.startsWith("@")) notFound();
  const parsed = handleSchema.safeParse(segment.slice(1));
  if (!parsed.success) notFound();
  const profile = await readPublicProfile(parsed.data);
  if (!profile) notFound();
  return profile;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await lookup(params);
  const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
  return {
    title: profile.document.name,
    description: profile.document.bio,
    alternates: { canonical: `${origin}/@${profile.handle}` },
    openGraph: {
      title: profile.document.name,
      description: profile.document.bio,
      url: `${origin}/@${profile.handle}`,
      type: "profile",
    },
  };
}
export default async function PublicProfile({ params }: Props) {
  const profile = await lookup(params);
  return (
    <main id="main" className="public-stage">
      <ProfileRenderer document={profile.document} />
    </main>
  );
}
