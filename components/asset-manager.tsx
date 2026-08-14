"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Save, ToggleLeft, ToggleRight } from "lucide-react";
import type { Asset } from "@/types/database";

export function AssetManager({
  campaignId,
  initialAssets,
}: {
  campaignId: string;
  initialAssets: Asset[];
}) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setMessage("");
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      form.set("campaign_id", campaignId);
      form.set("is_active", "true");
      const response = await fetch("/api/admin/assets", { method: "POST", body: form });
      const responseText = await response.text();
      let result: { asset?: Asset; error?: string } = {};
      try {
        result = JSON.parse(responseText) as typeof result;
      } catch {
        result.error = responseText || `上传失败（HTTP ${response.status}）`;
      }
      if (!response.ok || !result.asset) {
        setMessage(result.error || "上传失败。");
        return;
      }
      setAssets((current) => [...current, result.asset!]);
      formElement.reset();
      setMessage("图片已上传。");
      router.refresh();
    } catch {
      setMessage("上传没有完成，请保留图片并稍后重试。");
    } finally {
      setUploading(false);
    }
  }

  function replaceAsset(updated: Asset) {
    setAssets((current) => current.map((asset) => (asset.id === updated.id ? updated : asset)));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <form className="surface h-fit rounded-[28px] p-5 sm:p-6" onSubmit={upload}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#f5ecdf]">
            <ImagePlus size={20} />
          </span>
          <div>
            <h3 className="font-black">上传品牌图片</h3>
            <p className="text-xs text-[#857b72]">JPEG / PNG / WebP，最大 10MB</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <label>
            <span className="field-label">图片文件</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm"
              name="file"
              required
              type="file"
            />
          </label>
          <label>
            <span className="field-label">名称</span>
            <input className="field" name="name" required />
          </label>
          <label>
            <span className="field-label">描述（供 AI 理解）</span>
            <textarea className="textarea-field !min-h-24" name="description" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="field-label">分类</span>
              <input className="field" name="category" />
            </label>
            <label>
              <span className="field-label">排序</span>
              <input className="field" defaultValue="0" min="0" name="sort_order" type="number" />
            </label>
          </div>
          <label>
            <span className="field-label">关键词（逗号分隔）</span>
            <input className="field" name="keywords" />
          </label>
        </div>
        <button className="button-primary mt-5 w-full" disabled={uploading} type="submit">
          <ImagePlus size={16} /> {uploading ? "上传中…" : "上传图片"}
        </button>
        {message && <p className="mt-3 text-sm font-bold text-[#746d65]">{message}</p>}
      </form>

      <div>
        {assets.length === 0 ? (
          <div className="surface grid min-h-64 place-items-center rounded-[28px] p-8 text-center text-[#81776f]">
            上传第一张图片后，顾客就可以在扫码页选择它。
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assets
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((asset) => (
                <AssetEditor asset={asset} key={asset.id} onUpdate={replaceAsset} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetEditor({
  asset,
  onUpdate,
}: {
  asset: Asset;
  onUpdate: (asset: Asset) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(asset);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(patch = draft) {
    setSaving(true);
    setSaved(false);
    const response = await fetch("/api/admin/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: asset.id,
        name: patch.name,
        description: patch.description,
        category: patch.category,
        keywords: patch.keywords,
        sort_order: patch.sort_order,
        is_active: patch.is_active,
      }),
    });
    const result = (await response.json()) as { asset?: Asset };
    setSaving(false);
    if (result.asset) {
      setDraft(result.asset);
      onUpdate(result.asset);
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <article className={`surface overflow-hidden rounded-[26px] ${draft.is_active ? "" : "opacity-65"}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-[#e7e0d9]">
        <img alt={draft.name} className="h-full w-full object-cover" src={draft.file_url} />
        <button
          aria-label={draft.is_active ? "停用图片" : "启用图片"}
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white/90 shadow"
          onClick={() => {
            const next = { ...draft, is_active: !draft.is_active };
            setDraft(next);
            void save(next);
          }}
          type="button"
        >
          {draft.is_active ? (
            <ToggleRight className="text-[#5f8a57]" size={24} />
          ) : (
            <ToggleLeft size={24} />
          )}
        </button>
      </div>
      <div className="grid gap-3 p-4">
        <input
          className="field !h-10"
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          value={draft.name}
        />
        <textarea
          className="textarea-field !min-h-20"
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          value={draft.description}
        />
        <div className="grid grid-cols-[1fr_90px] gap-2">
          <input
            className="field !h-10"
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            placeholder="分类"
            value={draft.category}
          />
          <input
            className="field !h-10"
            min="0"
            onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) })}
            type="number"
            value={draft.sort_order}
          />
        </div>
        <input
          className="field !h-10"
          onChange={(event) =>
            setDraft({
              ...draft,
              keywords: event.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
            })
          }
          placeholder="关键词"
          value={draft.keywords.join(", ")}
        />
        <button className="button-secondary" disabled={saving} onClick={() => void save()} type="button">
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saving ? "保存中…" : saved ? "已保存" : "保存图片信息"}
        </button>
      </div>
    </article>
  );
}
