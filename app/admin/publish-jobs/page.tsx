import { PublishJobActions } from "@/components/publish-job-actions";
import { StatusPill } from "@/components/status-pill";
import { listPublishJobs } from "@/lib/server/repository";

export default async function PublishJobsPage() {
  const jobs = await listPublishJobs();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <div className="eyebrow">PUBLISH QUEUE</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">固定品牌账号发布</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#746d65]">
          任务默认仅自己可见。管理员确认后，本地 Windows Worker 才会领取并调用同机 xiaohongshu-mcp。
        </p>
      </div>
      <div className="surface overflow-hidden rounded-[28px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-[#f7f2ec] text-xs font-black tracking-wide text-[#756b62]">
              <tr>
                <th className="px-5 py-4">任务</th>
                <th className="px-5 py-4">可见性</th>
                <th className="px-5 py-4">状态</th>
                <th className="px-5 py-4">尝试</th>
                <th className="px-5 py-4">错误 / 结果</th>
                <th className="px-5 py-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr className="border-t border-[#eee7e0] align-top" key={job.id}>
                  <td className="max-w-[260px] px-5 py-5">
                    <strong className="block truncate">{job.title}</strong>
                    <span className="mt-1 block text-xs text-[#8d837a]">
                      {new Date(job.created_at).toLocaleString("zh-CN")} · {job.image_urls.length} 图
                    </span>
                  </td>
                  <td className="px-5 py-5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${job.visibility === "private" ? "bg-[#e8eef8] text-[#48617c]" : "bg-[#fbe3e1] text-[#a63d35]"}`}>
                      {job.visibility === "private" ? "仅自己可见" : "公开"}
                    </span>
                  </td>
                  <td className="px-5 py-5">
                    <StatusPill status={job.status} />
                  </td>
                  <td className="px-5 py-5 text-sm font-bold">{job.attempt_count}</td>
                  <td className="max-w-[260px] px-5 py-5 text-xs leading-5 text-[#806f65]">
                    {job.error_message || (job.result ? "已保存 MCP 返回结果" : "—")}
                  </td>
                  <td className="px-5 py-5">
                    <PublishJobActions job={job} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 && (
          <p className="p-10 text-center text-[#746d65]">审核生成记录并创建任务后，它会出现在这里。</p>
        )}
      </div>
      <div className="mt-5 rounded-[22px] border border-[#e5ddd4] bg-white p-5 text-sm leading-6 text-[#6f675f]">
        安全边界：公共扫码页不能创建发布任务；Vercel 或公开服务器不能直接访问 localhost；MCP Server 不应无认证暴露到互联网。
      </div>
    </div>
  );
}
