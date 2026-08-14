import { open, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { demoAssets } from "@/lib/demo-data";

describe("demo assets", () => {
  it("uses valid local JPEG fixtures for every demo image", async () => {
    for (const asset of demoAssets) {
      expect(asset.file_url).toMatch(/^\/demo\/[a-z0-9-]+\.jpg$/);

      const filePath = resolve(process.cwd(), "public", asset.file_url.slice(1));
      const file = await stat(filePath);
      expect(file.size).toBeGreaterThan(0);

      const handle = await open(filePath, "r");
      try {
        const header = Buffer.alloc(3);
        await handle.read(header, 0, header.length, 0);
        expect([...header]).toEqual([0xff, 0xd8, 0xff]);
      } finally {
        await handle.close();
      }
    }
  });
});
