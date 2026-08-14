import { describe, expect, it } from "vitest";
import {
  campaignInputSchema,
  fastPublishEventInputSchema,
  generateRequestSchema,
  generatedPostSchema,
} from "@/lib/schemas";

describe("API schemas", () => {
  it("accepts a valid structured AI result", () => {
    const parsed = generatedPostSchema.parse({
      titleOptions: ["标题一", "标题二", "标题三"],
      selectedTitle: "标题一",
      body: "只使用已提供事实的正文。",
      tags: ["品牌", "产品", "空间灵感"],
      fullPost: "标题一\n\n正文\n\n#品牌",
    });
    expect(parsed.titleOptions).toHaveLength(3);
  });

  it("rejects malformed AI output", () => {
    expect(() =>
      generatedPostSchema.parse({
        titleOptions: ["只有一个标题"],
        selectedTitle: "",
        body: "",
        tags: ["太少"],
        fullPost: "",
      }),
    ).toThrow();
  });

  it("limits public generation input", () => {
    const base = {
      campaignSlug: "soft-living",
      assetIds: ["a9df49b2-cbb7-46bd-9d84-228c66aa6750"],
      postType: "空间灵感",
      tone: "自然",
      location: "",
      userNotes: "",
    };
    expect(generateRequestSchema.parse(base).campaignSlug).toBe("soft-living");
    expect(() => generateRequestSchema.parse({ ...base, userNotes: "x".repeat(601) })).toThrow();
  });

  it("validates campaign slugs and image limits", () => {
    expect(() =>
      campaignInputSchema.parse({
        slug: "Invalid Slug",
        name: "活动",
        brand_name: "品牌",
        product_name: "产品",
        product_description: "",
        brand_guide: "",
        default_tone: "自然",
        default_keywords: [],
        prohibited_phrases: [],
        allowed_post_types: ["产品推荐"],
        max_image_count: 20,
        status: "active",
      }),
    ).toThrow();
  });

  it("validates enabled Fast Publish settings and normalizes tags", () => {
    const imageId = "a9df49b2-cbb7-46bd-9d84-228c66aa6750";
    const parsed = campaignInputSchema.parse({
      slug: "fast-campaign",
      name: "活动",
      brand_name: "品牌",
      product_name: "产品",
      product_description: "",
      brand_guide: "",
      default_tone: "自然",
      default_keywords: [],
      prohibited_phrases: [],
      allowed_post_types: ["产品推荐"],
      max_image_count: 6,
      fast_publish_enabled: true,
      fast_publish_images: [imageId],
      fast_publish_content: {
        title: "审核标题",
        body: "审核正文",
        tags: ["#标签一", "标签一", " 标签 二 "],
      },
      status: "active",
    });
    expect(parsed.fast_publish_content?.tags).toEqual(["标签一", "标签二"]);
    expect(() =>
      campaignInputSchema.parse({
        ...parsed,
        fast_publish_images: [],
      }),
    ).toThrow();
  });

  it("only accepts known Fast Publish handoff events", () => {
    const base = {
      campaignSlug: "soft-living",
      sessionId: "a9df49b2-cbb7-46bd-9d84-228c66aa6750",
    };
    expect(
      fastPublishEventInputSchema.parse({
        ...base,
        eventName: "fast_share_completed",
      }).eventName,
    ).toBe("fast_share_completed");
    expect(() =>
      fastPublishEventInputSchema.parse({
        ...base,
        eventName: "published",
      }),
    ).toThrow();
  });
});
