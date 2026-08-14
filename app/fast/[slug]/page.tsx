import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FastPublishClient } from "@/components/fast-publish-client";
import { resolveFastPublishCampaign } from "@/lib/fast-publish";
import { getCampaignBySlug } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const campaign = await getCampaignBySlug((await params).slug, true);
  if (!campaign || !campaign.fast_publish_enabled) {
    return { title: "快发页面不可用" };
  }
  return {
    title: `${campaign.name} · 快速发布`,
    description: `${campaign.brand_name} · 管理员已准备好图片和小红书帖子`,
  };
}

export default async function FastPublishPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const campaign = await getCampaignBySlug((await params).slug, true);
  if (!campaign) notFound();
  const resolution = resolveFastPublishCampaign(campaign);
  if (resolution.status !== "ready") notFound();

  return (
    <FastPublishClient
      assets={resolution.assets}
      brandName={campaign.brand_name}
      campaignName={campaign.name}
      campaignSlug={campaign.slug}
      content={resolution.content}
      fullPost={resolution.fullPost}
      maxImageCount={campaign.max_image_count}
    />
  );
}
