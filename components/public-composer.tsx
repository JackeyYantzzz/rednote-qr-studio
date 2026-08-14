"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  RefreshCcw,
  Sparkles,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { XiaohongshuPublishHandoff } from "@/components/xiaohongshu-publish-handoff";
import { normalizeTag } from "@/lib/utils";
import type { Asset, CampaignWithAssets, GeneratedPost } from "@/types/database";

type ComposerResult = GeneratedPost & { generationId: string };

const steps = ["选图片", "定方向", "补充", "生成", "发布"];
const tones = ["自然松弛", "简洁克制", "温暖有画面", "专业可信"];

export function PublicComposer({ campaign }: { campaign: CampaignWithAssets }) {
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Asset | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [postType, setPostType] = useState(campaign.allowed_post_types[0] ?? "产品推荐");
  const [tone, setTone] = useState(campaign.default_tone);
  const [location, setLocation] = useState("");
  const [favorite, setFavorite] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ComposerResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [notice, setNotice] = useState("");

  const selectedAssets = useMemo(
    () =>
      selectedIds
        .map((id) => campaign.assets.find((asset) => asset.id === id))
        .filter((asset): asset is Asset => Boolean(asset)),
    [campaign.assets, selectedIds],
  );

  function toggleAsset(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= campaign.max_image_count) {
        setNotice(`最多选择 ${campaign.max_image_count} 张图片`);
        return current;
      }
      return [...current, id];
    });
  }

  function moveAsset(from: number, to: number) {
    if (to < 0 || to >= selectedIds.length || from === to) return;
    setSelectedIds((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function generate() {
    setGenerating(true);
    setError("");
    setNotice("");
    setStep(4);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlug: campaign.slug,
          assetIds: selectedIds,
          postType,
          tone,
          location,
          userNotes: [favorite ? `最喜欢：${favorite}` : "", notes].filter(Boolean).join("；"),
        }),
      });
      const payload = (await response.json()) as ComposerResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "生成失败");
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成失败，请稍后再试。");
    } finally {
      setGenerating(false);
    }
  }

  function addTag() {
    if (!result) return;
    const tag = normalizeTag(tagDraft);
    if (!tag || result.tags.includes(tag) || result.tags.length >= 12) return;
    setResult({ ...result, tags: [...result.tags, tag] });
    setTagDraft("");
  }

  return (
    <main className="min-h-screen bg-[#fbf8f4] pb-28">
      <header className="sticky top-0 z-30 border-b border-[#ebe3dc] bg-[#fbf8f4]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <BrandMark compact />
          <div className="min-w-0 px-4 text-center">
            <p className="truncate text-sm font-black">{campaign.name}</p>
            <p className="truncate text-[11px] text-[#8b8178]">{campaign.brand_name}</p>
          </div>
          <span className="rounded-full bg-[#f5ecdf] px-3 py-1 text-xs font-black">
            {step}/5
          </span>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-4 pb-3">
          {steps.map((label, index) => (
            <div className="flex-1" key={label}>
              <div className={`h-1 rounded-full ${index + 1 <= step ? "bg-[#ef5a4f]" : "bg-[#e6ded6]"}`} />
              <span className={`mt-1.5 block text-center text-[10px] font-bold ${index + 1 === step ? "text-[#d9453b]" : "text-[#978d84]"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 py-6 sm:px-5">
        {step === 1 && (
          <section>
            <div className="px-1">
              <div className="eyebrow">STEP 01 · IMAGES</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight">挑选想分享的图片</h1>
              <p className="mt-2 text-sm leading-6 text-[#746d65]">
                最多 {campaign.max_image_count} 张。选中后可拖动，或用箭头调整发布顺序。
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f5ecdf] px-4 py-3">
              <span className="text-sm font-black">已选 {selectedIds.length} / {campaign.max_image_count}</span>
              <button
                className="text-sm font-black text-[#d9453b]"
                onClick={() =>
                  setSelectedIds(campaign.assets.slice(0, Math.min(3, campaign.max_image_count)).map((asset) => asset.id))
                }
                type="button"
              >
                推荐组合
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {campaign.assets.map((asset) => {
                const selectedIndex = selectedIds.indexOf(asset.id);
                return (
                  <article className="relative" key={asset.id}>
                    <button
                      aria-label={`${selectedIndex >= 0 ? "取消选择" : "选择"} ${asset.name}`}
                      className={`relative block aspect-[4/5] w-full overflow-hidden rounded-[22px] border-2 bg-[#e8e0d8] text-left transition ${selectedIndex >= 0 ? "border-[#ef5a4f] shadow-[0_10px_25px_rgba(239,90,79,.18)]" : "border-transparent"}`}
                      onClick={() => toggleAsset(asset.id)}
                      onDoubleClick={() => setPreview(asset)}
                      type="button"
                    >
                      <img alt={asset.name} className="h-full w-full object-cover" src={asset.file_url} />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10 text-xs font-bold text-white">
                        {asset.name}
                      </span>
                      {selectedIndex >= 0 && (
                        <span className="absolute top-2 left-2 grid size-8 place-items-center rounded-full bg-[#ef5a4f] text-sm font-black text-white shadow">
                          {selectedIndex + 1}
                        </span>
                      )}
                      <span
                        className="absolute top-2 right-2 rounded-full bg-black/40 px-2 py-1 text-[10px] font-bold text-white"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreview(asset);
                        }}
                      >
                        预览
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>

            {selectedAssets.length > 0 && (
              <div className="surface mt-5 rounded-[24px] p-4">
                <p className="mb-3 text-sm font-black">发布顺序</p>
                <div className="grid gap-2">
                  {selectedAssets.map((asset, index) => (
                    <div
                      className="flex items-center gap-3 rounded-2xl bg-[#faf6f1] p-2"
                      draggable
                      key={asset.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDragStart={() => setDragIndex(index)}
                      onDrop={() => {
                        if (dragIndex !== null) moveAsset(dragIndex, index);
                        setDragIndex(null);
                      }}
                    >
                      <GripVertical className="shrink-0 text-[#a3988f]" size={18} />
                      <img alt="" className="size-12 rounded-xl object-cover" src={asset.file_url} />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{index + 1}. {asset.name}</span>
                      <button
                        aria-label="前移"
                        className="grid size-9 place-items-center rounded-full bg-white"
                        disabled={index === 0}
                        onClick={() => moveAsset(index, index - 1)}
                        type="button"
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        aria-label="后移"
                        className="grid size-9 place-items-center rounded-full bg-white"
                        disabled={index === selectedAssets.length - 1}
                        onClick={() => moveAsset(index, index + 1)}
                        type="button"
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section>
            <Back onClick={() => setStep(1)} />
            <div className="eyebrow">STEP 02 · DIRECTION</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">这篇想怎么说？</h1>
            <p className="mt-2 text-sm leading-6 text-[#746d65]">选择帖子方向与语气，AI 会遵守 Campaign 的事实边界。</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {campaign.allowed_post_types.map((type) => (
                <button
                  className={`min-h-20 rounded-[22px] border p-4 text-left font-black ${postType === type ? "border-[#ef5a4f] bg-[#fff1ef] text-[#c94137]" : "border-[#e5ddd5] bg-white"}`}
                  key={type}
                  onClick={() => setPostType(type)}
                  type="button"
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="surface mt-6 rounded-[24px] p-5">
              <label className="field-label" htmlFor="tone">
                文案语气
              </label>
              <div className="mb-3 flex flex-wrap gap-2">
                {tones.map((item) => (
                  <button
                    className="rounded-full border border-[#e1d9d1] bg-[#faf7f3] px-3 py-2 text-xs font-bold"
                    key={item}
                    onClick={() => setTone(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <input className="field" id="tone" maxLength={80} onChange={(event) => setTone(event.target.value)} value={tone} />
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <Back onClick={() => setStep(2)} />
            <div className="eyebrow">STEP 03 · DETAILS</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">补充一点就好</h1>
            <p className="mt-2 text-sm leading-6 text-[#746d65]">所有字段都可选。不要填写账号、密码、Cookie 或其他敏感信息。</p>
            <div className="surface mt-6 grid gap-5 rounded-[26px] p-5 sm:p-6">
              <label>
                <span className="field-label">看到或使用产品的地点</span>
                <input className="field" maxLength={120} onChange={(event) => setLocation(event.target.value)} placeholder="例如：Melbourne 门店 / 家里阅读角" value={location} />
              </label>
              <label>
                <span className="field-label">最喜欢的特点</span>
                <input className="field" maxLength={180} onChange={(event) => setFavorite(event.target.value)} placeholder="只写你真实看到或确认的内容" value={favorite} />
              </label>
              <label>
                <span className="field-label">必须提到的内容</span>
                <textarea className="textarea-field" maxLength={600} onChange={(event) => setNotes(event.target.value)} placeholder="例如：重点写空间搭配，不提价格" value={notes} />
                <span className="mt-1 block text-right text-xs text-[#9a9087]">{notes.length}/600</span>
              </label>
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <Back onClick={() => setStep(3)} />
            <div className="eyebrow">STEP 04 · CREATE</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">你的帖子草稿</h1>
            <p className="mt-2 text-sm leading-6 text-[#746d65]">请按自己的真实情况修改；生成内容不是自动发布。</p>
            {generating && (
              <div className="surface mt-6 grid min-h-64 place-items-center rounded-[28px] p-8 text-center">
                <div>
                  <span className="mx-auto grid size-14 animate-pulse place-items-center rounded-[20px] bg-[#f9e3e0] text-[#d9453b]">
                    <Sparkles size={25} />
                  </span>
                  <p className="mt-4 font-black">正在整理图片和品牌信息…</p>
                  <p className="mt-2 text-sm text-[#7f756c]">页面会保留你的选择，请稍候。</p>
                </div>
              </div>
            )}
            {error && !generating && (
              <div className="mt-6 rounded-[24px] border border-[#f3c9c5] bg-[#fff4f2] p-5">
                <p className="font-black text-[#a83c33]">{error}</p>
                <button className="button-secondary mt-4" onClick={() => void generate()} type="button">
                  <RefreshCcw size={15} /> 重试
                </button>
              </div>
            )}
            {result && !generating && (
              <div className="mt-6 grid gap-5">
                <div className="surface rounded-[26px] p-5">
                  <p className="field-label">标题方案</p>
                  <div className="grid gap-2">
                    {result.titleOptions.map((title, index) => (
                      <button
                        className={`rounded-2xl border p-4 text-left text-sm font-black ${result.selectedTitle === title ? "border-[#ef5a4f] bg-[#fff2f0]" : "border-[#e5ddd5]"}`}
                        key={`${title}-${index}`}
                        onClick={() => setResult({ ...result, selectedTitle: title })}
                        type="button"
                      >
                        <span className="mr-2 text-[#ef5a4f]">0{index + 1}</span>
                        {title}
                      </button>
                    ))}
                  </div>
                  <label className="mt-4 block">
                    <span className="field-label">编辑标题</span>
                    <input className="field" maxLength={40} onChange={(event) => setResult({ ...result, selectedTitle: event.target.value })} value={result.selectedTitle} />
                  </label>
                </div>
                <div className="surface rounded-[26px] p-5">
                  <label>
                    <span className="field-label">正文</span>
                    <textarea className="textarea-field !min-h-80 leading-7" maxLength={2200} onChange={(event) => setResult({ ...result, body: event.target.value })} value={result.body} />
                  </label>
                </div>
                <div className="surface rounded-[26px] p-5">
                  <p className="field-label">标签</p>
                  <div className="flex flex-wrap gap-2">
                    {result.tags.map((tag) => (
                      <button
                        aria-label={`删除标签 ${tag}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[#f5ecdf] px-3 py-2 text-xs font-bold"
                        key={tag}
                        onClick={() => setResult({ ...result, tags: result.tags.filter((item) => item !== tag) })}
                        type="button"
                      >
                        #{tag} <X size={12} />
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      className="field"
                      maxLength={32}
                      onChange={(event) => setTagDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="添加标签"
                      value={tagDraft}
                    />
                    <button className="button-secondary !px-4" onClick={addTag} type="button">
                      <span className="sr-only">添加标签</span>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="button-secondary" onClick={() => void generate()} type="button">
                    <RefreshCcw size={15} /> 重新生成
                  </button>
                  <button className="button-ghost" onClick={() => setStep(2)} type="button">
                    调整语气
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {step === 5 && result && (
          <section>
            <Back onClick={() => setStep(4)} />
            <div className="eyebrow">STEP 05 · SHARE</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">准备发布</h1>
            <p className="mt-2 text-sm leading-6 text-[#746d65]">
              分享能力因手机和 App 而异。请在小红书发布页再次检查所有图片与文字。
            </p>
            <XiaohongshuPublishHandoff
              assets={selectedAssets}
              campaignSlug={campaign.slug}
              maxImageCount={campaign.max_image_count}
              post={result}
            />
          </section>
        )}
      </div>

      {step < 4 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e9e1d9] bg-white/94 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-3">
            {step > 1 && (
              <button className="button-secondary !size-13 !min-h-13 !p-0" onClick={() => setStep(step - 1)} type="button">
                <span className="sr-only">返回上一步</span>
                <ArrowLeft size={18} />
              </button>
            )}
            <button
              className="button-primary flex-1 !min-h-13"
              disabled={step === 1 && selectedIds.length === 0}
              onClick={() => {
                if (step === 3) void generate();
                else setStep(step + 1);
              }}
              type="button"
            >
              {step === 3 ? (
                <>
                  <Sparkles size={17} /> 生成帖子
                </>
              ) : (
                <>
                  下一步 <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
      {step === 4 && result && !generating && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e9e1d9] bg-white/94 p-3 backdrop-blur">
          <button className="button-primary mx-auto flex w-full max-w-3xl !min-h-13" onClick={() => setStep(5)} type="button">
            进入发布辅助 <ArrowRight size={17} />
          </button>
        </div>
      )}

      {notice && (
        <button
          className="fixed top-20 left-1/2 z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full bg-[#24211e] px-4 py-3 text-sm font-bold whitespace-nowrap text-white shadow-xl"
          onClick={() => setNotice("")}
          type="button"
        >
          <Check size={15} className="text-[#93d889]" /> {notice}
        </button>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <button className="absolute top-5 right-5 grid size-11 place-items-center rounded-full bg-white" onClick={() => setPreview(null)} type="button">
            <X size={20} />
          </button>
          <div className="max-h-[86vh] max-w-2xl overflow-hidden rounded-[26px] bg-white">
            <img alt={preview.name} className="max-h-[70vh] w-full object-contain" src={preview.file_url} />
            <div className="p-4">
              <p className="font-black">{preview.name}</p>
              <p className="mt-1 text-sm leading-6 text-[#746d65]">{preview.description}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button className="button-ghost mb-4 !min-h-9 !px-0" onClick={onClick} type="button">
      <ArrowLeft size={15} /> 返回上一步
    </button>
  );
}
