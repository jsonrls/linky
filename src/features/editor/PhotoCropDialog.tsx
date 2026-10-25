"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import {
  clampPhotoCrop,
  initialPhotoCrop,
  photoCropSide,
  type PhotoCrop,
} from "@/features/profile-photos/crop";

export function PhotoCropDialog({
  file,
  onCancel,
  onConfirm,
  onChooseAnother,
  disabled,
  blockedReason,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (crop: PhotoCrop) => void;
  onChooseAnother: () => void;
  disabled: boolean;
  blockedReason?: string;
}) {
  const [image, setImage] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState("");
  const errorSummary = useRef<HTMLParagraphElement>(null);
  const [crop, setCrop] = useState<PhotoCrop>(initialPhotoCrop);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (error) errorSummary.current?.focus({ preventScroll: true });
  }, [error]);
  useEffect(() => {
    let active = true;
    const url = URL.createObjectURL(file);
    const decoded = new Image();
    decoded.src = url;
    void decoded
      .decode()
      .then(() => {
        if (!active) return;
        if (!decoded.naturalWidth || !decoded.naturalHeight)
          throw new Error("invalid_dimensions");
        if (decoded.naturalWidth * decoded.naturalHeight > 20_000_000) {
          setError("Choose a photo up to 20 megapixels.");
          return;
        }
        setImage({
          url,
          width: decoded.naturalWidth,
          height: decoded.naturalHeight,
        });
      })
      .catch(() => {
        if (active)
          setError(
            "This photo could not be read. Choose another JPEG, PNG, or WebP photo.",
          );
      });
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function movePhoto(x: number, y: number) {
    if (!image) return;
    setCrop((current) => {
      const side = photoCropSide(image.width, image.height, current.zoom);
      return clampPhotoCrop(
        {
          ...current,
          centerX: current.centerX - (x * side) / image.width,
          centerY: current.centerY - (y * side) / image.height,
        },
        image.width,
        image.height,
      );
    });
  }
  const side = image ? photoCropSide(image.width, image.height, crop.zoom) : 1;
  return (
    <Dialog
      title="Adjust profile photo"
      className="photo-crop-dialog"
      onClose={onCancel}
    >
      <div className="photo-crop-body">
        <p
          id="photo-crop-help"
          className="small muted"
          data-safe-focus
          tabIndex={-1}
        >
          Drag the photo or use the direction buttons to reposition it. Use
          arrow keys for small moves, or Shift + arrow keys for larger moves.
        </p>
        {blockedReason && (
          <p className="notice" role="status">
            {blockedReason}
          </p>
        )}
        {error ? (
          <div className="photo-crop-error">
            <p
              ref={errorSummary}
              className="field-error"
              role="alert"
              tabIndex={-1}
            >
              {error}
            </p>
            <button type="button" onClick={onChooseAnother}>
              Choose another photo
            </button>
          </div>
        ) : !image ? (
          <div className="photo-crop-loading" role="status">
            Preparing photo…
          </div>
        ) : (
          <>
            <div
              className="photo-crop-viewport"
              role="group"
              aria-label="Photo crop preview"
              aria-describedby="photo-crop-help"
              tabIndex={0}
              onKeyDown={(event) => {
                const direction = {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                }[event.key];
                if (!direction) return;
                event.preventDefault();
                const step = event.shiftKey ? 0.1 : 0.02;
                movePhoto(direction[0] * step, direction[1] * step);
              }}
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                event.currentTarget.focus({ preventScroll: true });
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  id: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
              }}
              onPointerMove={(event) => {
                const previous = drag.current;
                if (!previous || previous.id !== event.pointerId) return;
                const size = event.currentTarget.getBoundingClientRect().width;
                movePhoto(
                  (event.clientX - previous.x) / size,
                  (event.clientY - previous.y) / size,
                );
                drag.current = {
                  id: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
            >
              {/* The original image is only displayed locally; the server decodes the original bytes. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt="Selected photo within the square crop"
                draggable={false}
                style={{
                  width: `${(image.width / side) * 100}%`,
                  height: `${(image.height / side) * 100}%`,
                  left: `${(0.5 - (crop.centerX * image.width) / side) * 100}%`,
                  top: `${(0.5 - (crop.centerY * image.height) / side) * 100}%`,
                }}
              />
            </div>
            <div
              className="photo-crop-moves"
              role="group"
              aria-label="Move photo"
            >
              {(
                [
                  ["left", -1, 0, "←"],
                  ["right", 1, 0, "→"],
                  ["up", 0, -1, "↑"],
                  ["down", 0, 1, "↓"],
                ] as const
              ).map(([label, x, y, glyph]) => (
                <button
                  key={label}
                  type="button"
                  aria-label={`Move photo ${label}`}
                  onClick={() => movePhoto(x * 0.05, y * 0.05)}
                >
                  <span aria-hidden="true">{glyph}</span>
                </button>
              ))}
            </div>
            <div className="photo-crop-zoom">
              <label htmlFor="photo-crop-zoom">
                Zoom{" "}
                <output htmlFor="photo-crop-zoom">
                  {Math.round(crop.zoom * 100)}%
                </output>
              </label>
              <input
                id="photo-crop-zoom"
                type="range"
                min={100}
                max={300}
                step={1}
                value={Math.round(crop.zoom * 100)}
                aria-valuetext={`${Math.round(crop.zoom * 100)}%`}
                onChange={(event) => {
                  const zoom = Number(event.target.value) / 100;
                  setCrop((current) =>
                    clampPhotoCrop(
                      { ...current, zoom },
                      image.width,
                      image.height,
                    ),
                  );
                }}
              />
              <button type="button" onClick={() => setCrop(initialPhotoCrop)}>
                Reset
              </button>
            </div>
          </>
        )}
      </div>
      <div className="dialog-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={disabled || !image || !!error}
          onClick={() => {
            if (!disabled && image && !error) onConfirm(crop);
          }}
        >
          Upload photo
        </button>
      </div>
    </Dialog>
  );
}
