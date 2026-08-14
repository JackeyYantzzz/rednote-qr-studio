import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import { AssetManager } from "@/components/asset-manager";
import { CampaignForm } from "@/components/campaign-form";
import { FastPublishSettings } from "@/components/fast-publish-settings";
import { QrPanel } from "@/components/qr-panel";
import { getPublicEnv } from "@/lib/config";
import { getCampaignById } from "@/lib/server/repository";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const campaign = await getCampaignById((await params).id);
  if (!campaign) notFound();
  const { NEXT_PUBLIC_SITE_URL } = getPublicEnv();

  return (
    <div className="mx-auto max-w-6xl">
      <Link className="button-ghost mb-5 !px-0" href="/admin/campaigns">
        <ArrowLeft size={16} /> 返回 Campaign
      </Link>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{campaign.brand_name}</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{campaign.name}</h1>
          <p className="mt-3 text-[#746d65]">配置、图片库与扫码入口都在这里。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="button-secondary" href={`/p/${campaign.slug}`} rel="noreferrer" target="_blank">
            预览普通模式
          </a>
          {campaign.fast_publish_enabled && (
            <a className="button-primary" href={`/fast/${campaign.slug}`} rel="noreferrer" target="_blank">
              <Zap size={15} /> 预览快发模式
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-7">
        <section>
          <h2 className="mb-4 text-xl font-black">基本配置</h2>
          <CampaignForm campaign={campaign} />
        </section>
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-black">图片库</h2>
            <p className="mt-1 text-sm text-[#7d746c]">描述与关键词会作为 AI 生成依据；停用图片不会出现在扫码页。</p>
          </div>
          <AssetManager campaignId={campaign.id} initialAssets={campaign.assets} />
        </section>
        <section>
          <h2 className="mb-4 text-xl font-black">Fast Publish</h2>
          <FastPublishSettings campaign={campaign} />
        </section>
        <section>
          <h2 className="mb-4 text-xl font-black">二维码</h2>
          <QrPanel
            configuredSiteUrl={NEXT_PUBLIC_SITE_URL}
            fastPublishEnabled={campaign.fast_publish_enabled}
            slug={campaign.slug}
          />
        </section>
      </div>
    </div>
  );
}
