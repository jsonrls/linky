"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
export function SignOut() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div>
      <button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await api("/api/auth/signout", {});
            window.location.assign("/login");
          } catch (error) {
            setError((error as Error).message);
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
