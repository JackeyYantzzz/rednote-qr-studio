import { QueueGenerationButton } from "@/components/queue-generation-button";
import { listGenerations } from "@/lib/server/repository";

export default async function GenerationsPage() {
  const generations = await listGenerations();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <div className="eyebrow">GENERATIONS</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">用户生成记录</h1>
        <p className="mt-3 text-[#746d65]">审核标题、正文与图片选择，再创建固定品牌账号发布任务。</p>
      </div>
      <div className="grid gap-5">
        {generations.map((generation) => {
          const content = generation.edited_content ?? generation.generated_content;
          return (
            <article className="surface rounded-[28px] p-5 sm:p-7" key={generation.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-[#9a8f85]">
                    {new Date(generation.created_at).toLocaleString("zh-CN")}
                  </span>
                  <h2 className="mt-2 text-xl font-black">{content.selectedTitle}</h2>
                  <p className="mt-1 text-sm font-bold text-[#81766d]">
                    {generation.campaign?.name || "Campaign"} · {generation.selected_asset_ids.length} 张图片
                  </p>
                </div>
                <span className="rounded-full bg-[#f5ecdf] px-3 py-1 text-xs font-bold">待审核草稿</span>
              </div>
              <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-[#faf7f3] p-4 text-sm leading-7 text-[#5e5751]">
                {content.body}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {content.tags.map((tag) => (
                  <span className="rounded-full border border-[#e5ddd5] px-2.5 py-1 text-xs" key={tag}>
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="mt-5 border-t border-[#eee7e0] pt-5">
                <QueueGenerationButton generation={generation} />
              </div>
            </article>
          );
        })}
        {generations.length === 0 && (
          <div className="surface grid min-h-72 place-items-center rounded-[28px] p-8 text-center text-[#746d65]">
            扫码页完成一次内容生成后，记录会出现在这里。
          </div>
        )}
      </div>
    </div>
  );
}
