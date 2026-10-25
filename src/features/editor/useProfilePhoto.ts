"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequestError } from "@/lib/client-api";
import type { EditableProfile } from "@/features/profiles/model";
import { managedAvatar, photoByteLimit } from "@/features/profile-photos/paths";
import {
  photoCropHeader,
  type PhotoCrop,
} from "@/features/profile-photos/crop";

export function useProfilePhoto(
  profileId: string,
  change: (update: (current: EditableProfile) => EditableProfile) => void,
  fail: (error: { code: string; message: string }) => void,
) {
  const pending = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState("");
  const [changed, setChanged] = useState(false);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [profileId],
  );
  const setPhoto = useCallback(
    (avatarUrl: string) => {
      change((current) => ({
        ...current,
        document: {
          ...current.document,
          appearance: { ...current.document.appearance, avatarUrl },
        },
      }));
      setChanged(true);
      setUploaded(false);
      setError("");
    },
    [change],
  );
  async function upload(file: File, crop: PhotoCrop) {
    if (pending.current) return;
    setError("");
    setUploaded(false);
    if (!file.size || file.size > photoByteLimit) {
      setError("Choose a photo of 3 MB or less.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setUploading(true);
    try {
      const response = await fetch(`/api/profiles/${profileId}/photo`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type,
          [photoCropHeader]: JSON.stringify(crop),
        },
        cache: "no-store",
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw new RequestError(
          result.error?.code || "photo_upload_failed",
          response.status,
          result.error?.message ||
            "Your photo could not be uploaded. Please select it again.",
        );
      const path =
        typeof result.avatarUrl === "string"
          ? managedAvatar(result.avatarUrl)
          : null;
      if (!path || path.profile !== profileId)
        throw new Error(
          "The photo upload could not be confirmed. Please select it again.",
        );
      if (!controller.signal.aborted && pending.current === controller) {
        setPhoto(result.avatarUrl);
        setUploaded(true);
      }
    } catch (failure) {
      if (controller.signal.aborted || pending.current !== controller) return;
      const message =
        failure instanceof RequestError || failure instanceof Error
          ? failure.message
          : "Your photo could not be uploaded. Please select it again.";
      setError(message);
      if (failure instanceof RequestError && failure.status === 401)
        fail({ code: "unauthenticated", message });
    } finally {
      if (!controller.signal.aborted && pending.current === controller) {
        pending.current = null;
        setUploading(false);
      }
    }
  }
  return { uploading, uploaded, pending, error, changed, upload, setPhoto };
}
