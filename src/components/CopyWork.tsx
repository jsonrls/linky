"use client";
import { useState, useRef, useId } from "react";
export function CopyWork({
  value,
  label = "Copy unsaved work",
}: {
  value: string;
  label?: string;
}) {
  const [fallback, setFallback] = useState(false);
  const [message, setMessage] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fallbackId = useId();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied. Keep this copy until your changes are saved.");
    } catch {
      setFallback(true);
      setMessage("Select and copy the text below.");
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.select();
      });
    }
  }
  return (
    <div className="copy-work">
      <button type="button" onClick={copy}>
        {label}
      </button>
      <p role="status" className="small">
        {message}
      </p>
      {fallback && (
        <div className="field">
          <label htmlFor={fallbackId}>Text to copy</label>
          <textarea ref={ref} id={fallbackId} readOnly value={value} />
        </div>
      )}
    </div>
  );
}
