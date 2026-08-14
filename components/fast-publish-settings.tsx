"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  Save,
  Zap,
} from "lucide-react";
import { normalizeTag } from "@/lib/utils";
import type { CampaignWithAssets } from "@/types/database";

function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[,，\n]/)
        .map(normalizeTag)
        .filter(Boolean),
    ),
  ];
}

export function FastPublishSettings({
  campaign,
}: {
  campaign: CampaignWithAssets;
}) {
  const router = useRouter();
  const activeAssets = useMemo(
    () =>
      campaign.assets
        .filter((asset) => asset.is_active)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            a.created_at.localeCompare(b.created_at),
        ),
    [campaign.assets],
  );
  const activeIds = useMemo(
    () => new Set(activeAssets.map((asset) => asset.id)),
    [activeAssets],
  );
  const [enabled, setEnabled] = useState(campaign.fast_publish_enabled);
  const [selectedIds, setSelectedIds] = useState(
    campaign.fast_publish_images.filter((id) => activeIds.has(id)),
  );
  const [title, setTitle] = useState(
    campaign.fast_publish_content?.title ?? "",
  );
  const [body, setBody] = useState(
    campaign.fast_publish_content?.body ?? "",
  );
  const [tags, setTags] = useState(
    campaign.fast_publish_content?.tags.join(", ") ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedAssets = selectedIds
    .map((id) => activeAssets.find((asset) => asset.id === id))
    .filter((asset): asset is (typeof activeAssets)[number] =>
      Boolean(asset),
    );

  function toggleAsset(id: string) {
    setSaved(false);
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= campaign.max_image_count) {
        setMessage(`最多可配置 ${campaign.max_image_count} 张快发图片。`);
        return current;
      }
      setMessage("");
      return [...current, id];
    });
  }

  function moveAsset(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= selectedIds.length) return;
    setSelectedIds((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setMessage("");
    const normalizedTags = parseTags(tags);
    const hasAnyContent = Boolean(
      title.trim() || body.trim() || normalizedTags.length,
    );
    try {
      const response = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fast_publish_enabled: enabled,
          fast_publish_images: selectedIds,
          fast_publish_content: hasAnyContent
            ? {
                title,
                body,
                tags: normalizedTags,
              }
            : null,
        }),
      });
      const result = (await response.json()) as {
        campaign?: CampaignWithAssets;
        error?: string;
      };
      if (!response.ok || !result.campaign) {
        setMessage(result.error || "快发设置保存失败，请检查配置。");
        return;
      }
      setTags(normalizedTags.join(", "));
      setSaved(true);
      setMessage("快发设置已保存。");
      router.refresh();
    } catch {
      setMessage("快发设置没有保存，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface rounded-[28px] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#f9e3e0] text-[#cf443a]">
              <Zap size={19} />
            </span>
            <div>
              <h3 className="text-lg font-black">Fast Publish 设置</h3>
              <p className="mt-0.5 text-xs text-[#81766d]">
                用户扫码即可使用管理员审核好的图片和帖子
              </p>
            </div>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-full bg-[#f7f2ec] px-4 py-2 text-sm font-black">
          <input
            checked={enabled}
            className="size-4 accent-[#ef5a4f]"
            onChange={(event) => {
              setEnabled(event.target.checked);
              setSaved(false);
            }}
            type="checkbox"
          />
          {enabled ? "快发已启用" : "启用快发"}
        </label>
      </div>

      <div className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="field-label">默认图片组合</p>
            <p className="text-sm text-[#746d65]">
              点击图片选择；下方顺序就是进入小红书时的图片顺序。
            </p>
          </div>
          <strong className="shrink-0 text-sm">
            {selectedIds.length}/{campaign.max_image_count}
          </strong>
        </div>

        {activeAssets.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-[#f7f2ec] p-4 text-sm text-[#746d65]">
            请先在图片库上传并启用图片，再配置快发模式。
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {activeAssets.map((asset) => {
              const selectedIndex = selectedIds.indexOf(asset.id);
              return (
                <button
                  aria-label={`${selectedIndex >= 0 ? "取消选择" : "选择"} ${asset.name}`}
                  className={`relative aspect-[4/3] overflow-hidden rounded-[20px] border-2 text-left ${
                    selectedIndex >= 0
                      ? "border-[#ef5a4f]"
                      : "border-transparent"
                  }`}
                  key={asset.id}
                  onClick={() => toggleAsset(asset.id)}
                  type="button"
                >
                  <img
                    alt={asset.name}
                    className="h-full w-full object-cover"
                    src={asset.file_url}
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8 text-xs font-bold text-white">
                    {asset.name}
                  </span>
                  {selectedIndex >= 0 && (
                    <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-[#ef5a4f] text-xs font-black text-white">
                      {selectedIndex + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedAssets.length > 0 && (
          <div className="mt-4 grid gap-2 rounded-[22px] bg-[#faf6f1] p-3">
            {selectedAssets.map((asset, index) => (
              <div
                className="flex items-center gap-3 rounded-2xl bg-white p-2"
                key={asset.id}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f9e3e0] text-xs font-black text-[#c94137]">
                  {index + 1}
                </span>
                <img
                  alt=""
                  className="size-12 rounded-xl object-cover"
                  src={asset.file_url}
                />
                <strong className="min-w-0 flex-1 truncate text-sm">
                  {asset.name}
                </strong>
                <button
                  aria-label={`${asset.name} 前移`}
                  className="grid size-9 place-items-center rounded-full bg-[#f7f2ec]"
                  disabled={index === 0}
                  onClick={() => moveAsset(index, -1)}
                  type="button"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  aria-label={`${asset.name} 后移`}
                  className="grid size-9 place-items-center rounded-full bg-[#f7f2ec]"
                  disabled={index === selectedAssets.length - 1}
                  onClick={() => moveAsset(index, 1)}
                  type="button"
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-7 grid gap-5">
        <div>
          <p className="field-label">审核后的默认帖子</p>
          <p className="text-sm text-[#746d65]">
            快发页面不会调用 AI，也不会让用户修改这些内容。
          </p>
        </div>
        <label>
          <span className="field-label">标题</span>
          <input
            className="field"
            maxLength={40}
            onChange={(event) => {
              setTitle(event.target.value);
              setSaved(false);
            }}
            placeholder="最终审核标题"
            value={title}
          />
          <span className="mt-1 block text-right text-xs text-[#91877e]">
            {title.length}/40
          </span>
        </label>
        <label>
          <span className="field-label">正文</span>
          <textarea
            className="textarea-field !min-h-52"
            maxLength={2200}
            onChange={(event) => {
              setBody(event.target.value);
              setSaved(false);
            }}
            placeholder="最终审核正文"
            value={body}
          />
          <span className="mt-1 block text-right text-xs text-[#91877e]">
            {body.length}/2200
          </span>
        </label>
        <label>
          <span className="field-label">标签（逗号或换行分隔）</span>
          <input
            className="field"
            onChange={(event) => {
              setTags(event.target.value);
              setSaved(false);
            }}
            placeholder="家居灵感, 阅读角, 松弛感"
            value={tags}
          />
        </label>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          className="button-primary"
          disabled={saving}
          onClick={() => void save()}
          type="button"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? "保存中…" : saved ? "已保存" : "保存快发设置"}
        </button>
        {enabled && (
          <a
            className="button-ghost"
            href={`/fast/${campaign.slug}`}
            rel="noreferrer"
            target="_blank"
          >
            预览快发页面 <ExternalLink size={14} />
          </a>
        )}
        {message && (
          <span className="text-sm font-bold text-[#766d65]">{message}</span>
        )}
      </div>
    </section>
  );
}
