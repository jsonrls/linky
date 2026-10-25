import { OtpForm } from "@/features/auth/OtpForm";
import { safeReturn } from "@/features/auth/server";
export const metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};
export default async function Verify({
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
      <p className="eyebrow">Email sign-in</p>
      <h1>Check your email</h1>
      <OtpForm verifyPage returnTo={safeReturn(next)} />
    </main>
  );
}
