import { describe, expect, it } from "vitest";
import { demoAssets, demoCampaign } from "@/lib/demo-data";
import {
  buildAndroidChromeIntent,
  buildCampaignQrUrl,
  getFastPublishButtonLabel,
  mapFastShareResultToEvent,
  resolveFastPublishCampaign,
  summarizeFastPublishEvents,
} from "@/lib/fast-publish";

function campaign() {
  return {
    ...demoCampaign,
    assets: demoAssets.map((asset) => ({ ...asset })),
  };
}

describe("Fast Publish campaign resolution", () => {
  it("rejects a Campaign that has not enabled Fast Publish", () => {
    const result = resolveFastPublishCampaign({
      ...campaign(),
      fast_publish_enabled: false,
    });
    expect(result).toEqual({ status: "disabled" });
  });

  it("uses the configured image order and reviewed content", () => {
    const source = campaign();
    const configuredIds = [
      demoAssets[2].id,
      demoAssets[0].id,
      demoAssets[1].id,
    ];
    const result = resolveFastPublishCampaign({
      ...source,
      fast_publish_images: configuredIds,
      fast_publish_content: {
        title: " 审核标题 ",
        body: " 审核正文 ",
        tags: ["#家居灵感", " 家居灵感 ", "阅读 角"],
      },
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.assets.map((asset) => asset.id)).toEqual(configuredIds);
    expect(result.content).toEqual({
      title: "审核标题",
      body: "审核正文",
      tags: ["家居灵感", "阅读角"],
    });
    expect(result.fullPost).toBe(
      "审核标题\n\n审核正文\n\n#家居灵感 #阅读角",
    );
  });

  it("rejects missing or inactive configured images", () => {
    const result = resolveFastPublishCampaign({
      ...campaign(),
      fast_publish_images: [crypto.randomUUID()],
    });
    expect(result).toEqual({ status: "incomplete", reason: "images" });
  });
});

describe("Fast Publish share UI", () => {
  it("builds separate custom and Fast Publish QR destinations", () => {
    expect(
      buildCampaignQrUrl("https://example.com/", "soft-living", "custom"),
    ).toBe("https://example.com/p/soft-living");
    expect(
      buildCampaignQrUrl("https://example.com", "soft-living", "fast"),
    ).toBe("https://example.com/fast/soft-living");
  });

  it("builds an Android Chrome handoff with a safe browser fallback", () => {
    expect(
      buildAndroidChromeIntent(
        "https://preview.example.com/fast/soft-living?source=qr",
      ),
    ).toBe(
      "intent://preview.example.com/fast/soft-living?source=qr#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fpreview.example.com%2Ffast%2Fsoft-living%3Fsource%3Dqr;end",
    );
  });

  it("shows the requested share and progress button labels", () => {
    expect(getFastPublishButtonLabel("ready")).toBe("分享到小红书");
    expect(
      getFastPublishButtonLabel("preparing", { current: 2, total: 3 }),
    ).toBe("正在准备图片 2/3");
    expect(getFastPublishButtonLabel("opening")).toBe("打开分享菜单");
  });

  it("maps share completion, cancellation and failure without a published event", () => {
    expect(
      mapFastShareResultToEvent({
        status: "shared",
        method: "files-and-text",
      }),
    ).toBe("fast_share_completed");
    expect(mapFastShareResultToEvent({ status: "cancelled" })).toBe(
      "fast_share_cancelled",
    );
    expect(
      mapFastShareResultToEvent({
        status: "fallback",
        reason: "clipboard-failed",
      }),
    ).toBe("fast_share_failed");
  });
});

describe("Fast Publish analytics", () => {
  it("summarizes each Campaign event independently", () => {
    const metrics = summarizeFastPublishEvents(
      [demoCampaign],
      [
        {
          campaign_id: demoCampaign.id,
          event_name: "fast_page_view",
        },
        {
          campaign_id: demoCampaign.id,
          event_name: "fast_share_clicked",
        },
        {
          campaign_id: demoCampaign.id,
          event_name: "fast_share_completed",
        },
      ],
    );
    expect(metrics[0]).toMatchObject({
      page_views: 1,
      share_clicks: 1,
      share_completed: 1,
      share_cancelled: 0,
      share_failed: 0,
    });
  });
});
