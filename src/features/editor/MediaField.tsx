"use client";
import { Field } from "@/components/Field";
import { safeMediaUrl } from "@/features/profiles/model";
import { ProfileMedia } from "@/features/public-profile/ProfileMedia";

export function MediaField({
  id,
  label,
  value = "",
  onChange,
  error,
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const invalid = value.replace(/^ +| +$/g, "") !== "" && !safeMediaUrl(value);
  return (
    <div className="media-field">
      <Field
        id={id}
        label={label}
        type="url"
        value={value}
        maxLength={2048}
        onChange={(event) => onChange(event.target.value)}
        error={
          error ||
          (invalid
            ? "Use a complete HTTPS image URL without spaces or credentials."
            : undefined)
        }
        hint="Optional HTTPS image URL. The image is decorative; keep essential information in your text."
      />
      {safeMediaUrl(value) && (
        <div className="media-field-preview">
          <ProfileMedia key={value} url={value} feedback />
        </div>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Remove ${label.toLowerCase().replace(" url", "")} image`}
        >
          Remove image
        </button>
      )}
    </div>
  );
}
