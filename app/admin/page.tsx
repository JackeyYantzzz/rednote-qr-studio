import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  GalleryHorizontalEnd,
  Sparkles,
} from "lucide-react";
import {
  listCampaigns,
  listGenerations,
  listPublishJobs,
} from "@/lib/server/repository";

export default async function AdminDashboard() {
  const [campaigns, generations, jobs] = await Promise.all([
    listCampaigns(),
    listGenerations(),
    listPublishJobs(),
  ]);
  const published = jobs.filter((job) => job.status === "published").length;
  const pending = jobs.filter((job) =>
    ["pending", "approved", "preparing", "publishing"].includes(job.status),
  ).length;

  const metrics = [
    { label: "Campaign", value: campaigns.length, icon: GalleryHorizontalEnd, color: "bg-[#f5ecdf]" },
    { label: "生成记录", value: generations.length, icon: Sparkles, color: "bg-[#e8e0f4]" },
    { label: "队列中", value: pending, icon: BriefcaseBusiness, color: "bg-[#e5eee1]" },
    { label: "已发布", value: published, icon: ArrowUpRight, color: "bg-[#f9e3e0]" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <div className="eyebrow">CONTROL ROOM</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">今天从哪里开始？</h1>
        <p className="mt-3 text-[#746d65]">管理活动内容、审核生成草稿，并安全地安排固定品牌账号发布。</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <article className="surface rounded-[24px] p-5 sm:p-6" key={label}>
            <span className={`grid size-10 place-items-center rounded-2xl ${color}`}>
              <Icon size={18} />
            </span>
            <strong className="mt-7 block text-3xl font-black">{value}</strong>
            <span className="mt-1 block text-sm font-bold text-[#7d746c]">{label}</span>
          </article>
        ))}
      </div>

      <section className="surface mt-6 rounded-[28px] p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">最近的 Campaign</h2>
            <p className="mt-1 text-sm text-[#7c736b]">快速进入图片库与二维码管理</p>
          </div>
          <Link className="button-ghost" href="/admin/campaigns">
            查看全部 <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="mt-5 grid gap-3">
          {campaigns.slice(0, 4).map((campaign) => (
            <Link
              className="flex items-center justify-between rounded-2xl border border-[#ece5de] p-4 hover:bg-[#fbf7f2]"
              href={`/admin/campaigns/${campaign.id}`}
              key={campaign.id}
            >
              <div>
                <strong className="block">{campaign.name}</strong>
                <span className="mt-1 block text-xs text-[#877d74]">
                  {campaign.brand_name} · {campaign.assets.length} 张图片
                </span>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${campaign.status === "active" ? "bg-[#e5eee1] text-[#4f7548]" : "bg-[#eee] text-[#777]"}`}>
                {campaign.status === "active" ? "启用" : "停用"}
              </span>
            </Link>
          ))}
          {campaigns.length === 0 && (
            <p className="rounded-2xl bg-[#f7f2ec] p-5 text-sm text-[#746d65]">
              还没有 Campaign。创建第一个后即可上传图片并生成二维码。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
