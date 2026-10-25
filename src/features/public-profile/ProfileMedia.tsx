"use client";
import { useState, type ReactNode } from "react";
import { safeAvatarUrl, safeMediaUrl } from "@/features/profiles/model";

type Props = {
  url?: string;
  className?: string;
  fallback?: ReactNode;
  feedback?: boolean;
  avatar?: boolean;
};
export function ProfileMedia({
  url,
  className = "",
  fallback = null,
  feedback = false,
  avatar = false,
}: Props) {
  if (!url || !(avatar ? safeAvatarUrl(url) : safeMediaUrl(url)))
    return fallback;
  return (
    <ImageAttempt
      key={url}
      url={url}
      className={className}
      fallback={fallback}
      feedback={feedback}
    />
  );
}
function ImageAttempt({
  url,
  className,
  fallback,
  feedback,
}: Props & { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <>
        {fallback}
        {feedback && (
          <span className="media-load-error" role="status">
            Could not load image
          </span>
        )}
      </>
    );
  return (
    // User images are fetched only by the browser, never by the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`profile-media ${className}`}
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      ref={(image) => {
        // A server-rendered image may fail before hydration attaches onError.
        if (image?.complete && image.naturalWidth === 0) setFailed(true);
      }}
      onError={() => setFailed(true)}
    />
  );
}
