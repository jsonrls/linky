"use client";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/Field";
import { initials, safeMediaUrl } from "@/features/profiles/model";
import { managedAvatar } from "@/features/profile-photos/paths";
import { ProfileMedia } from "@/features/public-profile/ProfileMedia";
import { photoByteLimit } from "@/features/profile-photos/paths";
import type { PhotoCrop } from "@/features/profile-photos/crop";
import { PhotoCropDialog } from "./PhotoCropDialog";

export function ProfilePhoto({
  value = "",
  name,
  uploading,
  uploaded,
  disabled,
  blockedReason,
  error,
  onUpload,
  onChange,
}: {
  value?: string;
  name: string;
  uploading: boolean;
  uploaded: boolean;
  disabled: boolean;
  blockedReason?: string;
  error?: string;
  onUpload: (file: File, crop: PhotoCrop) => void;
  onChange: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ file: File; key: string } | null>(
    null,
  );
  const [selectionError, setSelectionError] = useState("");
  const photoError = selectionError || error;
  const errorSummary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (photoError && !document.querySelector("dialog[open]"))
      errorSummary.current?.focus({ preventScroll: true });
  }, [photoError]);
  const managed = !!managedAvatar(value);
  const proposedUrl = url ?? (managed ? "" : value);
  const invalidUrl = !!proposedUrl && !safeMediaUrl(proposedUrl);
  const locked = disabled || uploading;
  function focusUpload(confirmed = false) {
    requestAnimationFrame(() => {
      const trigger = document.getElementById("avatar-url");
      const target =
        confirmed || (trigger instanceof HTMLButtonElement && trigger.disabled)
          ? document.getElementById("profile-photo-status")
          : trigger;
      target?.focus({ preventScroll: true });
    });
  }
  return (
    <section
      className="profile-photo"
      aria-labelledby="profile-photo-label"
      aria-busy={uploading}
    >
      <h2 id="profile-photo-label">Profile photo</h2>
      <div className="profile-photo-row">
        <div className="profile-photo-thumbnail">
          <ProfileMedia
            avatar
            url={value}
            feedback
            fallback={<span aria-hidden="true">{initials(name)}</span>}
          />
        </div>
        <div className="profile-photo-controls">
          <input
            ref={input}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose profile photo"
            disabled={locked}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file || locked) return;
              setSelectionError("");
              if (!file.size || file.size > photoByteLimit) {
                setSelectionError("Choose a photo of 3 MB or less.");
                return;
              }
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                setSelectionError("Choose a JPEG, PNG, or WebP photo.");
                return;
              }
              setSelected({ file, key: crypto.randomUUID() });
            }}
          />
          <div className="actions">
            <button
              id="avatar-url"
              type="button"
              disabled={locked}
              aria-describedby={`profile-photo-hint profile-photo-status${photoError ? " profile-photo-error" : ""}`}
              onClick={() => input.current?.click()}
            >
              {value ? "Replace photo" : "Upload photo"}
            </button>
            {value && (
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  setUndo(value);
                  setUrl(null);
                  onChange("");
                  focusUpload();
                }}
              >
                Remove photo
              </button>
            )}
          </div>
          <p id="profile-photo-hint" className="hint">
            JPEG, PNG, or WebP · up to 3 MB
          </p>
        </div>
      </div>
      <p
        id="profile-photo-status"
        className="small muted"
        role="status"
        tabIndex={-1}
      >
        {uploading
          ? "Uploading photo… Your current photo stays until the upload finishes."
          : uploaded
            ? "Photo updated in this draft. Changes stay private until you publish."
            : "Photo changes stay private until you publish."}
      </p>
      {photoError && (
        <p
          ref={errorSummary}
          id="profile-photo-error"
          className="field-error"
          role="alert"
          tabIndex={-1}
        >
          {photoError} Select your photo again to retry.
        </p>
      )}
      {undo !== null && (
        <div className="undo-row" role="status">
          <span>Photo removed from this draft.</span>
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              onChange(undo);
              setUndo(null);
              focusUpload();
            }}
          >
            Undo photo removal
          </button>
        </div>
      )}
      <details className="photo-url-option">
        <summary>Use an image URL instead</summary>
        <Field
          label="Avatar URL"
          type="url"
          maxLength={2048}
          value={proposedUrl}
          disabled={locked}
          onChange={(event) => setUrl(event.target.value)}
          hint="Use a complete HTTPS image URL. Upload a file above to use a photo from your device."
          error={
            invalidUrl
              ? "Use a complete HTTPS image URL without spaces or credentials."
              : undefined
          }
        />
        <button
          type="button"
          disabled={
            locked || invalidUrl || !proposedUrl || proposedUrl === value
          }
          onClick={() => {
            setUndo(null);
            onChange(proposedUrl);
          }}
        >
          Apply URL
        </button>
      </details>
      {selected && (
        <PhotoCropDialog
          key={selected.key}
          file={selected.file}
          disabled={locked}
          blockedReason={blockedReason}
          onCancel={() => {
            setSelected(null);
            focusUpload();
          }}
          onChooseAnother={() => {
            setSelected(null);
            focusUpload();
            input.current?.click();
          }}
          onConfirm={(crop) => {
            if (locked) return;
            setUndo(null);
            setSelected(null);
            onUpload(selected.file, crop);
            focusUpload(true);
          }}
        />
      )}
    </section>
  );
}
