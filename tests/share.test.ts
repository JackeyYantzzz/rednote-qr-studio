import { describe, expect, it, vi } from "vitest";
import { supportsFileShare } from "@/lib/share";

describe("Web Share fallback detection", () => {
  const file = new File(["image"], "image.jpg", { type: "image/jpeg" });

  it("uses native file share only when both APIs accept files", () => {
    expect(
      supportsFileShare(
        {
          share: vi.fn(),
          canShare: vi.fn(() => true),
        } as unknown as Pick<Navigator, "share" | "canShare">,
        [file],
      ),
    ).toBe(true);
  });

  it("falls back when canShare rejects files", () => {
    expect(
      supportsFileShare(
        {
          share: vi.fn(),
          canShare: vi.fn(() => false),
        } as unknown as Pick<Navigator, "share" | "canShare">,
        [file],
      ),
    ).toBe(false);
  });

  it("falls back when browser APIs are unavailable", () => {
    expect(
      supportsFileShare({} as Pick<Navigator, "share" | "canShare">, [file]),
    ).toBe(false);
  });
});
