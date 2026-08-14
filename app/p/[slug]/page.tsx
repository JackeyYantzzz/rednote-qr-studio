import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicComposer } from "@/components/public-composer";
import { getCampaignBySlug } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const campaign = await getCampaignBySlug((await params).slug, true);
  if (!campaign) return { title: "Campaign 不存在" };
  return {
    title: campaign.name,
    description: `${campaign.brand_name} · 选择图片并生成小红书帖子草稿`,
  };
}

export default async function PublicCampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const campaign = await getCampaignBySlug((await params).slug, true);
  if (!campaign) notFound();
  return <PublicComposer campaign={campaign} />;
}
