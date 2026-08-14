import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Plus } from "lucide-react";
import { listCampaigns } from "@/lib/server/repository";

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow">CAMPAIGNS</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">活动与图片库</h1>
          <p className="mt-3 text-[#746d65]">每个扫码入口都有独立的品牌规则、图片库和二维码。</p>
        </div>
        <Link className="button-primary hidden sm:inline-flex" href="/admin/campaigns/new">
          <Plus size={16} /> 新建
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {campaigns.map((campaign) => (
          <article className="surface overflow-hidden rounded-[28px]" key={campaign.id}>
            <div className="flex h-36 items-end justify-between bg-[#f5ecdf] p-5">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-[#695c51]">
                    /p/{campaign.slug}
                  </span>
                  {campaign.fast_publish_enabled && (
                    <span className="rounded-full bg-[#f9e3e0] px-2.5 py-1 text-xs font-bold text-[#b83f36]">
                      /fast/{campaign.slug}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-2xl font-black">{campaign.name}</h2>
              </div>
              <span className="grid size-11 place-items-center rounded-2xl bg-white/75">
                <ImageIcon size={20} />
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#7d746c]">{campaign.brand_name} · {campaign.product_name}</span>
                <strong>{campaign.assets.length} 张图片</strong>
              </div>
              <div className="mt-4 grid gap-2 text-xs leading-5 text-[#746d65]">
                <p>
                  <strong className="text-[#3d3833]">普通模式：</strong>
                  用户可以自由选择图片和生成内容
                </p>
                <p>
                  <strong className="text-[#3d3833]">快发模式：</strong>
                  {campaign.fast_publish_enabled
                    ? "用户扫码即可发布管理员审核好的内容"
                    : "尚未启用"}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${campaign.status === "active" ? "bg-[#e4eee0] text-[#4f7548]" : "bg-[#eee] text-[#777]"}`}>
                  {campaign.status === "active" ? "启用" : "停用"}
                </span>
                <Link className="button-ghost !min-h-9 !px-2" href={`/admin/campaigns/${campaign.id}`}>
                  管理 <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </article>
        ))}
        {campaigns.length === 0 && (
          <Link
            className="grid min-h-72 place-items-center rounded-[28px] border-2 border-dashed border-[#ddd3ca] p-8 text-center text-[#756c64]"
            href="/admin/campaigns/new"
          >
            <span>
              <Plus className="mx-auto mb-3" size={28} />
              创建第一个 Campaign
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
