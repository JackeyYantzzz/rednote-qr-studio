import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  MousePointerClick,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { listFastPublishAnalytics } from "@/lib/server/repository";

export default async function FastPublishDashboardPage() {
  const analytics = await listFastPublishAnalytics();
  const totals = analytics.reduce(
    (sum, item) => ({
      page_views: sum.page_views + item.page_views,
      share_clicks: sum.share_clicks + item.share_clicks,
      share_completed: sum.share_completed + item.share_completed,
      share_cancelled: sum.share_cancelled + item.share_cancelled,
      share_failed: sum.share_failed + item.share_failed,
    }),
    {
      page_views: 0,
      share_clicks: 0,
      share_completed: 0,
      share_cancelled: 0,
      share_failed: 0,
    },
  );
  const metrics = [
    { label: "扫码次数", value: totals.page_views, icon: ScanLine },
    {
      label: "点击分享",
      value: totals.share_clicks,
      icon: MousePointerClick,
    },
    {
      label: "成功打开分享菜单",
      value: totals.share_completed,
      icon: CheckCircle2,
    },
    { label: "取消", value: totals.share_cancelled, icon: Ban },
    { label: "分享失败", value: totals.share_failed, icon: TriangleAlert },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <div className="eyebrow">FAST PUBLISH</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
          快发数据
        </h1>
        <p className="mt-3 text-[#746d65]">
          这里只统计网页交接过程，不会把打开分享菜单记录为小红书发布成功。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article className="surface rounded-[22px] p-5" key={label}>
            <Icon className="text-[#c7483e]" size={18} />
            <strong className="mt-5 block text-3xl font-black">{value}</strong>
            <span className="mt-1 block text-xs font-bold text-[#7d746c]">
              {label}
            </span>
          </article>
        ))}
      </div>

      <section className="surface mt-6 overflow-hidden rounded-[28px]">
        <div className="border-b border-[#ece5de] p-5 sm:p-6">
          <h2 className="text-xl font-black">Campaign 明细</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#faf6f1] text-xs text-[#776e66]">
              <tr>
                <th className="px-5 py-4">Campaign</th>
                <th className="px-4 py-4">状态</th>
                <th className="px-4 py-4">扫码</th>
                <th className="px-4 py-4">点击分享</th>
                <th className="px-4 py-4">成功打开分享菜单</th>
                <th className="px-4 py-4">取消</th>
                <th className="px-4 py-4">失败</th>
                <th className="px-4 py-4" aria-label="管理" />
              </tr>
            </thead>
            <tbody>
              {analytics.map((item) => (
                <tr
                  className="border-t border-[#eee7e0]"
                  key={item.campaign_id}
                >
                  <td className="px-5 py-4">
                    <strong className="block">{item.campaign_name}</strong>
                    <span className="mt-1 block text-xs text-[#867c73]">
                      /fast/{item.campaign_slug}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        item.enabled
                          ? "bg-[#e4eee0] text-[#4f7548]"
                          : "bg-[#eee] text-[#777]"
                      }`}
                    >
                      {item.enabled ? "已启用" : "未启用"}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-black">{item.page_views}</td>
                  <td className="px-4 py-4 font-black">
                    {item.share_clicks}
                  </td>
                  <td className="px-4 py-4 font-black">
                    {item.share_completed}
                  </td>
                  <td className="px-4 py-4 font-black">
                    {item.share_cancelled}
                  </td>
                  <td className="px-4 py-4 font-black">
                    {item.share_failed}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      className="button-ghost !min-h-9 !px-2"
                      href={`/admin/campaigns/${item.campaign_id}`}
                    >
                      管理 <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {analytics.length === 0 && (
          <p className="p-6 text-sm text-[#746d65]">还没有 Campaign 数据。</p>
        )}
      </section>
    </div>
  );
}
