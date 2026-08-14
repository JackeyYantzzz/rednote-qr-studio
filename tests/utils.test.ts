import { describe, expect, it } from "vitest";
import { composeFullPost, normalizeGeneratedPost, sanitizeFilename } from "@/lib/utils";

describe("content and upload helpers", () => {
  it("sanitizes hostile filenames", () => {
    expect(sanitizeFilename("../../恶意 file.JPEG")).toBe("file.jpeg");
    expect(sanitizeFilename(".../../.png")).toBe("image.png");
  });

  it("normalizes tags and rebuilds the full post", () => {
    const post = normalizeGeneratedPost({
      titleOptions: ["一", "二", "三"],
      selectedTitle: "一",
      body: "正文",
      tags: ["#品牌", "品牌", "空间 灵感"],
      fullPost: "stale",
    });
    expect(post.tags).toEqual(["品牌", "空间灵感"]);
    expect(post.fullPost).toBe("一\n\n正文\n\n#品牌 #空间灵感");
  });

  it("composes an editable post deterministically", () => {
    expect(composeFullPost("标题", "正文", ["标签一", "#标签二"])).toContain(
      "#标签一 #标签二",
    );
  });
});
