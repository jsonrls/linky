import { redirect } from "next/navigation";
import { workspace } from "@/features/auth/server";
import { AppError } from "@/lib/errors";
import { SignOut } from "@/features/auth/SignOut";
export const metadata = { robots: { index: false, follow: false } };
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email = "";
  try {
    email = (await workspace()).email;
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    throw error;
  }
  return (
    <div className="workspace-ui">
      <header className="owner-header">
        <div className="shell masthead">
          <a className="wordmark" href="/app/profiles">
            Linky
          </a>
          <nav aria-label="Workspace">
            <a
              className="owner-profiles"
              href="/app/profiles"
              aria-current="page"
            >
              Profiles
            </a>
          </nav>
          <div className="account-label">
            <span title={email}>{email}</span>
            <SignOut />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
