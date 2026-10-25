import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizePhoto, photoContentType } from "./image";
import { photoByteLimit } from "./paths";
import { boundedBody } from "@/lib/http";

const image = (width = 80, height = 40) =>
  sharp({ create: { width, height, channels: 3, background: "#27446b" } });
describe("profile photo normalization", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "decodes %s and emits a still metadata-free WebP without enlargement",
    async (format) => {
      const bytes = await image()
        .toFormat(format)
        .withMetadata({ orientation: 6 })
        .toBuffer();
      const output = await normalizePhoto(bytes, `image/${format}`);
      const metadata = await sharp(output).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(40);
      expect(metadata.height).toBe(80);
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
      expect(metadata.pages ?? 1).toBe(1);
    },
  );
  it("fits inside 1024 pixels and limits decoded input pixels", async () => {
    const output = await normalizePhoto(
      await image(1800, 1200).png().toBuffer(),
      "image/png",
    );
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(683);
    await expect(
      normalizePhoto(await image(5000, 4001).png().toBuffer(), "image/png"),
    ).rejects.toMatchObject({ code: "invalid_photo", status: 422 });
  });
  it("rejects oversized, empty, spoofed, unsupported and malformed input", async () => {
    expect(() => photoContentType("image/svg+xml")).toThrow(/JPEG/);
    const png = await image().png().toBuffer();
    for (const bytes of [
      Buffer.alloc(0),
      Buffer.from("<svg></svg>"),
      png.subarray(0, 15),
    ]) {
      await expect(normalizePhoto(bytes, "image/png")).rejects.toMatchObject({
        status: 422,
      });
    }
    await expect(normalizePhoto(png, "image/jpeg")).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      normalizePhoto(Buffer.alloc(photoByteLimit + 1), "image/png"),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects animated WebP instead of silently publishing frame one", async () => {
    const first = await image(20, 20).png().toBuffer();
    const second = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const bytes = await sharp([first, second], { join: { animated: true } })
      .webp()
      .toBuffer();
    expect((await sharp(bytes, { animated: true }).metadata()).pages).toBe(2);
    await expect(normalizePhoto(bytes, "image/webp")).rejects.toMatchObject({
      code: "animated_photo",
      status: 422,
    });
  });
  it("bounds streamed bytes even without a content-length header and cancels the stream", async () => {
    let cancelled = false;
    const request = new Request("https://example.test", {
      method: "POST",
      duplex: "half",
      body: new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(4));
        },
        cancel() {
          cancelled = true;
        },
      }),
    } as RequestInit);
    await expect(boundedBody(request, 6, "Too large")).rejects.toMatchObject({
      status: 413,
    });
    expect(cancelled).toBe(true);
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "auto-orients EXIF %s including mirroring before square extraction",
    async (orientation) => {
      const width = 120,
        height = 80;
      const raw = Buffer.alloc(width * height * 3);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 3;
          raw[offset] = x * 2;
          raw[offset + 1] = y * 3;
          raw[offset + 2] = (x + y) % 2 ? 40 : 180;
        }
      }
      const bytes = await sharp(raw, { raw: { width, height, channels: 3 } })
        .jpeg({ quality: 95 })
        .withMetadata({ orientation })
        .toBuffer();
      const decoded = await sharp(bytes).raw().toBuffer();
      const orientedWidth = orientation >= 5 ? height : width;
      const orientedHeight = orientation >= 5 ? width : height;
      const oriented = Buffer.alloc(raw.length);
      for (let y = 0; y < orientedHeight; y++) {
        for (let x = 0; x < orientedWidth; x++) {
          const source = [
            [x, y],
            [width - 1 - x, y],
            [width - 1 - x, height - 1 - y],
            [x, height - 1 - y],
            [y, x],
            [y, height - 1 - x],
            [width - 1 - y, height - 1 - x],
            [width - 1 - y, x],
          ][orientation - 1];
          decoded.copy(
            oriented,
            (y * orientedWidth + x) * 3,
            (source[1] * width + source[0]) * 3,
            (source[1] * width + source[0]) * 3 + 3,
          );
        }
      }
      const crop = { centerX: 0.6, centerY: 0.4, zoom: 2 };
      const side = 40;
      const expected = await sharp(oriented, {
        raw: { width: orientedWidth, height: orientedHeight, channels: 3 },
      })
        .extract({
          left: Math.round(crop.centerX * orientedWidth - side / 2),
          top: Math.round(crop.centerY * orientedHeight - side / 2),
          width: side,
          height: side,
        })
        .webp({ quality: 85 })
        .toBuffer();
      const output = await normalizePhoto(bytes, "image/jpeg", crop);
      expect(output).toEqual(expected);
      expect(await sharp(output).metadata()).toMatchObject({
        width: side,
        height: side,
        format: "webp",
      });
      expect((await sharp(output).metadata()).exif).toBeUndefined();
    },
  );
  it("validates crop bounds against trusted oriented dimensions", async () => {
    const bytes = await image(120, 80)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    await expect(
      normalizePhoto(bytes, "image/jpeg", {
        centerX: 0.3,
        centerY: 0.5,
        zoom: 1,
      }),
    ).rejects.toMatchObject({ code: "invalid_photo_crop", status: 400 });
    await expect(
      normalizePhoto(bytes, "image/jpeg", {
        centerX: 0.5,
        centerY: 0.35,
        zoom: 1,
      }),
    ).resolves.toBeInstanceOf(Buffer);
    await expect(
      normalizePhoto(bytes, "image/jpeg", {
        centerX: 0.5,
        centerY: 0.5,
        zoom: Infinity,
      }),
    ).rejects.toMatchObject({ code: "invalid_photo_crop", status: 400 });
  });
});
