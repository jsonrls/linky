// Coordinates refer to the auto-oriented original, independently of display size.
export type PhotoCrop = { centerX: number; centerY: number; zoom: number };
export const photoCropHeader = "X-Photo-Crop";
export const initialPhotoCrop: PhotoCrop = {
  centerX: 0.5,
  centerY: 0.5,
  zoom: 1,
};

export function validPhotoCrop(value: unknown): value is PhotoCrop {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const crop = value as PhotoCrop;
  return (
    Object.keys(crop).length === 3 &&
    Number.isFinite(crop.centerX) &&
    Number.isFinite(crop.centerY) &&
    Number.isFinite(crop.zoom) &&
    crop.centerX >= 0 &&
    crop.centerX <= 1 &&
    crop.centerY >= 0 &&
    crop.centerY <= 1 &&
    crop.zoom >= 1 &&
    crop.zoom <= 3
  );
}

export function photoCropSide(width: number, height: number, zoom: number) {
  return Math.min(width, height) / zoom;
}

export function clampPhotoCrop(
  crop: PhotoCrop,
  width: number,
  height: number,
): PhotoCrop {
  const side = photoCropSide(width, height, crop.zoom);
  return {
    centerX: Math.max(
      side / (2 * width),
      Math.min(1 - side / (2 * width), crop.centerX),
    ),
    centerY: Math.max(
      side / (2 * height),
      Math.min(1 - side / (2 * height), crop.centerY),
    ),
    zoom: crop.zoom,
  };
}

export function photoCropRectangle(
  crop: PhotoCrop,
  width: number,
  height: number,
) {
  if (
    !validPhotoCrop(crop) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  )
    throw new Error("invalid_photo_crop");
  const bounded = clampPhotoCrop(crop, width, height);
  // Permit only floating-point roundoff at an edge, never an out-of-bounds crop.
  if (
    Math.abs(bounded.centerX - crop.centerX) > 1e-9 ||
    Math.abs(bounded.centerY - crop.centerY) > 1e-9
  )
    throw new Error("invalid_photo_crop");
  const side = Math.max(1, Math.floor(photoCropSide(width, height, crop.zoom)));
  return {
    left: Math.max(
      0,
      Math.min(width - side, Math.round(crop.centerX * width - side / 2)),
    ),
    top: Math.max(
      0,
      Math.min(height - side, Math.round(crop.centerY * height - side / 2)),
    ),
    width: side,
    height: side,
  };
}
