import { OtpForm } from "@/features/auth/OtpForm";
import { safeReturn } from "@/features/auth/server";
export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main id="main" className="workspace-ui auth-shell">
      <a className="wordmark" href="/login">
        Linky
      </a>
      <p className="eyebrow">Your workspace</p>
      <h1>A page for each part of your work.</h1>
      <OtpForm returnTo={safeReturn(next)} />
      <p className="small muted auth-note">
        Your drafts stay private until you publish.
      </p>
    </main>
  );
}
