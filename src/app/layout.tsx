import type { Metadata } from "next";
import "@/styles/tokens.css";
import "@/styles/global.css";
import "@/styles/workspace.css";
export const metadata: Metadata = {
  title: { default: "Linky", template: "%s · Linky" },
  description: "A page for each part of your work.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
