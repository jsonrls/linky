"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { api, RequestError } from "@/lib/client-api";
type Props = {
  verifyPage?: boolean;
  initialEmail?: string;
  onVerified?: () => Promise<void>;
  returnTo?: string;
};
export function OtpForm({
  verifyPage = false,
  initialEmail = "",
  onVerified,
  returnTo = "/app/profiles",
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [stage, setStage] = useState(verifyPage ? "verify" : "email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (verifyPage && !initialEmail) {
        const saved = sessionStorage.getItem("linky-otp-email");
        if (saved) setEmail(saved);
        else setStage("email");
        setUntil(Number(sessionStorage.getItem("linky-otp-until")) || 0);
      }
      setNow(Date.now());
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, [verifyPage, initialEmail]);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  async function send() {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ retryAfter: number; message: string }>(
        "/api/auth/send",
        { email },
      );
      const deadline = Date.now() + result.retryAfter * 1000;
      setUntil(deadline);
      setNow(Date.now());
      setNotice(result.message);
      setCode("");
      if (!onVerified) {
        sessionStorage.setItem("linky-otp-email", email);
        sessionStorage.setItem("linky-otp-until", String(deadline));
        if (!verifyPage) {
          router.push(`/auth/verify?next=${encodeURIComponent(returnTo)}`);
          return;
        }
      }
      setStage("verify");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please retry.");
      if (error instanceof RequestError && error.status === 429) {
        setUntil(Date.now() + 60000);
        setNow(Date.now());
      }
    } finally {
      setPending(false);
    }
  }
  async function verify() {
    setPending(true);
    setError("");
    try {
      await api("/api/auth/verify", { email, token: code });
      if (onVerified) {
        await onVerified();
      } else {
        sessionStorage.removeItem("linky-otp-email");
        sessionStorage.removeItem("linky-otp-until");
        router.replace(returnTo);
        router.refresh();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <p className="muted">
        {stage === "email"
          ? "Use your email to sign in or create a workspace."
          : `Enter the six-digit code sent to ${email}.`}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void (stage === "email" ? send() : verify());
        }}
      >
        {stage === "email" ? (
          <Field
            label="Email address"
            type="email"
            autoComplete="email"
            value={email}
            maxLength={254}
            required
            onChange={(e) => setEmail(e.target.value)}
            error={error || undefined}
          />
        ) : (
          <Field
            label="Sign-in code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            required
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            hint="Codes expire after one hour. Use the newest email."
            error={error || undefined}
          />
        )}
        {notice && (
          <p role="status" className="small notice">
            {notice}
          </p>
        )}
        <button
          type="submit"
          className="primary auth-submit"
          disabled={pending}
        >
          {pending
            ? "Please wait…"
            : stage === "email"
              ? "Send code"
              : "Verify"}
        </button>
      </form>
      {stage === "verify" && (
        <div className="auth-secondary">
          <button
            type="button"
            onClick={() => {
              setStage("email");
              setCode("");
              setError("");
            }}
            disabled={pending}
          >
            Change email
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={pending || remaining > 0}
          >
            {remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}
          </button>
        </div>
      )}
    </div>
  );
}
