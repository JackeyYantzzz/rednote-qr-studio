import { describe, expect, it } from "vitest";
import QRCode from "qrcode";

describe("campaign QR codes", () => {
  it("encodes the configured production-style campaign URL", async () => {
    const url = "https://campaign.example.com/p/soft-living";
    const svg = await QRCode.toString(url, { type: "svg" });
    expect(svg).toContain("<svg");
    expect(svg.length).toBeGreaterThan(500);
  });
});
