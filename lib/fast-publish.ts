import type { XiaohongshuShareResult } from "@/lib/share/xiaohongshu";
import { composeFullPost, normalizeTag } from "@/lib/utils";
import type {
  Asset,
  Campaign,
  CampaignWithAssets,
  FastPublishAnalytics,
  FastPublishContent,
  FastPublishEvent,
  FastPublishEventName,
} from "@/types/database";

export type FastPublishResolution =
  | { status: "disabled" }
  | { status: "incomplete"; reason: "images" | "content" }
  | {
      status: "ready";
      assets: Asset[];
      content: FastPublishContent;
      fullPost: string;
    };

export type CampaignQrMode = "custom" | "fast";

export function buildCampaignQrUrl(
  configuredSiteUrl: string,
  slug: string,
  mode: CampaignQrMode,
) {
  return `${configuredSiteUrl.replace(/\/$/, "")}/${mode === "fast" ? "fast" : "p"}/${slug}`;
}

export function buildAndroidChromeIntent(url: string) {
  const parsed = new URL(url);
  const scheme = parsed.protocol.replace(":", "");
  const target = `${parsed.host}${parsed.pathname}${parsed.search}`;
  return `intent://${target}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

export function resolveFastPublishCampaign(
  campaign: CampaignWithAssets,
): FastPublishResolution {
  if (!campaign.fast_publish_enabled) return { status: "disabled" };
  if (!campaign.fast_publish_content) {
    return { status: "incomplete", reason: "content" };
  }

  const assetsById = new Map(
    campaign.assets
      .filter((asset) => asset.is_active)
      .map((asset) => [asset.id, asset]),
  );
  const assets = campaign.fast_publish_images
    .map((id) => assetsById.get(id))
    .filter((asset): asset is Asset => Boolean(asset));
  if (
    assets.length === 0 ||
    assets.length !== campaign.fast_publish_images.length
  ) {
    return { status: "incomplete", reason: "images" };
  }

  const tags = [
    ...new Set(
      campaign.fast_publish_content.tags
        .map(normalizeTag)
        .filter(Boolean),
    ),
  ].slice(0, 12);
  const content = {
    title: campaign.fast_publish_content.title.trim(),
    body: campaign.fast_publish_content.body.trim(),
    tags,
  };
  if (!content.title || !content.body || content.tags.length === 0) {
    return { status: "incomplete", reason: "content" };
  }

  return {
    status: "ready",
    assets,
    content,
    fullPost: composeFullPost(content.title, content.body, content.tags),
  };
}

export type FastPublishUiStatus =
  | "preparing"
  | "ready"
  | "checking"
  | "copying"
  | "opening"
  | "completed"
  | "cancelled"
  | "fallback"
  | "failed";

export function getFastPublishButtonLabel(
  status: FastPublishUiStatus,
  progress?: { current: number; total: number } | null,
) {
  if (status === "preparing") {
    return progress
      ? `正在准备图片 ${progress.current}/${progress.total}`
      : "正在准备图片…";
  }
  const labels: Record<Exclude<FastPublishUiStatus, "preparing">, string> = {
    ready: "分享到小红书",
    checking: "正在检查内容…",
    copying: "正在准备文案…",
    opening: "打开分享菜单",
    completed: "再次分享到小红书",
    cancelled: "再次分享到小红书",
    fallback: "重新尝试分享",
    failed: "重新准备图片",
  };
  return labels[status];
}

export function mapFastShareResultToEvent(
  result: XiaohongshuShareResult,
): FastPublishEventName {
  if (result.status === "shared") return "fast_share_completed";
  if (result.status === "cancelled") return "fast_share_cancelled";
  return "fast_share_failed";
}

export function summarizeFastPublishEvents(
  campaigns: Pick<
    Campaign,
    "id" | "name" | "slug" | "fast_publish_enabled"
  >[],
  events: Pick<FastPublishEvent, "campaign_id" | "event_name">[],
): FastPublishAnalytics[] {
  const counts = new Map<
    string,
    Record<FastPublishEventName, number>
  >();
  for (const event of events) {
    const campaignCounts = counts.get(event.campaign_id) ?? {
      fast_page_view: 0,
      fast_share_clicked: 0,
      fast_share_completed: 0,
      fast_share_cancelled: 0,
      fast_share_failed: 0,
    };
    campaignCounts[event.event_name] += 1;
    counts.set(event.campaign_id, campaignCounts);
  }

  return campaigns.map((campaign) => {
    const campaignCounts = counts.get(campaign.id);
    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      campaign_slug: campaign.slug,
      enabled: campaign.fast_publish_enabled,
      page_views: campaignCounts?.fast_page_view ?? 0,
      share_clicks: campaignCounts?.fast_share_clicked ?? 0,
      share_completed: campaignCounts?.fast_share_completed ?? 0,
      share_cancelled: campaignCounts?.fast_share_cancelled ?? 0,
      share_failed: campaignCounts?.fast_share_failed ?? 0,
    };
  });
}
