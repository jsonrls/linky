import { describe, expect, it } from "vitest";
import {
  clampPhotoCrop,
  initialPhotoCrop,
  photoCropRectangle,
  validPhotoCrop,
} from "./crop";
import { parsePhotoCrop } from "./image";

describe("photo crop contract", () => {
  it.each([
    [120, 80],
    [80, 120],
    [81, 81],
    [1, 1],
    [19999, 1],
  ])(
    "keeps square extraction inside %sx%s at every zoom and edge",
    (width, height) => {
      for (const zoom of [1, 1.01, 1.33, 2, 3]) {
        for (const centerX of [-1, 0, 0.5, 1, 2]) {
          for (const centerY of [-1, 0, 0.5, 1, 2]) {
            const crop = clampPhotoCrop(
              { centerX, centerY, zoom },
              width,
              height,
            );
            const rect = photoCropRectangle(crop, width, height);
            expect(rect.width).toBe(rect.height);
            expect(rect.width).toBeGreaterThanOrEqual(1);
            expect(rect.left).toBeGreaterThanOrEqual(0);
            expect(rect.top).toBeGreaterThanOrEqual(0);
            expect(rect.left + rect.width).toBeLessThanOrEqual(width);
            expect(rect.top + rect.height).toBeLessThanOrEqual(height);
          }
        }
      }
    },
  );
  it("defines a centered fill and clamps zooming back out", () => {
    expect(photoCropRectangle(initialPhotoCrop, 120, 80)).toEqual({
      left: 20,
      top: 0,
      width: 80,
      height: 80,
    });
    expect(
      photoCropRectangle({ centerX: 0.6, centerY: 0.4, zoom: 2 }, 120, 80),
    ).toEqual({ left: 52, top: 12, width: 40, height: 40 });
    expect(
      clampPhotoCrop({ centerX: 0.1, centerY: 0.1, zoom: 1 }, 120, 80),
    ).toEqual({ centerX: 1 / 3, centerY: 0.5, zoom: 1 });
  });
  it.each([
    null,
    [],
    {},
    { ...initialPhotoCrop, zoom: 0.99 },
    { ...initialPhotoCrop, zoom: 3.01 },
    { ...initialPhotoCrop, zoom: NaN },
    { ...initialPhotoCrop, centerX: Infinity },
    { ...initialPhotoCrop, centerY: -0.01 },
    { ...initialPhotoCrop, centerX: 1.01 },
    { ...initialPhotoCrop, zoom: "2" },
    { ...initialPhotoCrop, extra: true },
  ])("rejects invalid contract value %j", (value) => {
    expect(validPhotoCrop(value)).toBe(false);
  });
  it("rejects crops beyond the oriented image rather than silently clamping", () => {
    expect(() =>
      photoCropRectangle({ centerX: 0, centerY: 0.5, zoom: 1 }, 120, 80),
    ).toThrow("invalid_photo_crop");
    expect(() =>
      photoCropRectangle({ centerX: 0.5, centerY: 0.3, zoom: 1 }, 120, 80),
    ).toThrow("invalid_photo_crop");
    expect(() => photoCropRectangle(initialPhotoCrop, 0, 80)).toThrow(
      "invalid_photo_crop",
    );
  });
  it("allows absent legacy metadata and rejects malformed or unbounded headers", () => {
    expect(parsePhotoCrop(null)).toBeUndefined();
    expect(parsePhotoCrop(JSON.stringify(initialPhotoCrop))).toEqual(
      initialPhotoCrop,
    );
    for (const value of [
      "",
      "null",
      "{}",
      "[]",
      "{",
      " ".repeat(257),
      '{"centerX":0.5,"centerY":0.5,"zoom":1e999}',
      '{"centerX":0.5,"centerY":0.5,"zoom":NaN}',
    ]) {
      expect(() => parsePhotoCrop(value)).toThrow(/adjustment is invalid/);
    }
  });
});
