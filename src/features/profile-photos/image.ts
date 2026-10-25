import sharp from "sharp";
import { AppError } from "@/lib/errors";
import { photoByteLimit } from "./paths";
import { photoCropRectangle, validPhotoCrop, type PhotoCrop } from "./crop";

const pixelLimit = 20_000_000;
function invalidCrop() {
  return new AppError(
    "invalid_photo_crop",
    400,
    "This photo adjustment is invalid. Select the photo again and retry.",
  );
}
export function parsePhotoCrop(value: string | null): PhotoCrop | undefined {
  if (value === null) return undefined;
  if (value.length > 256) throw invalidCrop();
  try {
    const crop: unknown = JSON.parse(value);
    if (!validPhotoCrop(crop)) throw invalidCrop();
    return crop;
  } catch {
    throw invalidCrop();
  }
}
export function photoContentType(value: string | null) {
  if (!value || !["image/jpeg", "image/png", "image/webp"].includes(value))
    throw new AppError(
      "invalid_photo_type",
      415,
      "Choose a JPEG, PNG, or WebP photo.",
    );
  return value;
}
function signature(bytes: Buffer) {
  if (
    bytes.length >= 3 &&
    bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}
export async function normalizePhoto(
  bytes: Buffer,
  contentType: string,
  crop?: PhotoCrop,
) {
  photoContentType(contentType);
  if (bytes.length > photoByteLimit)
    throw new AppError(
      "request_too_large",
      413,
      "Choose a photo of 3 MB or less.",
    );
  if (!bytes.length || signature(bytes) !== contentType)
    throw new AppError(
      "invalid_photo",
      422,
      "This file is not a valid JPEG, PNG, or WebP photo.",
    );
  try {
    const image = sharp(bytes, {
      limitInputPixels: pixelLimit,
      failOn: "warning",
      animated: true,
    });
    const metadata = await image.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > pixelLimit
    )
      throw new Error("invalid_dimensions");
    if ((metadata.pages ?? 1) !== 1)
      throw new AppError(
        "animated_photo",
        422,
        "Choose a still photo. Animated images are not supported.",
      );
    // PNG may carry APNG frames even when the installed decoder exposes only page one.
    if (metadata.format === "png") {
      let offset = 8;
      while (offset + 12 <= bytes.length) {
        const size = bytes.readUInt32BE(offset);
        if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL")
          throw new AppError(
            "animated_photo",
            422,
            "Choose a still photo. Animated images are not supported.",
          );
        offset += size + 12;
      }
    }
    image.autoOrient();
    if (crop !== undefined) {
      let rectangle;
      try {
        rectangle = photoCropRectangle(
          crop,
          metadata.autoOrient.width,
          metadata.autoOrient.height,
        );
      } catch {
        throw invalidCrop();
      }
      image.extract(rectangle);
    }
    return await image
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .timeout({ seconds: 10 })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "invalid_photo",
      422,
      "This photo could not be read. Use a still JPEG, PNG, or WebP up to 20 megapixels.",
    );
  }
}
