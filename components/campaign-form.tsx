"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { Campaign } from "@/types/database";

const initialValues = {
  slug: "",
  name: "",
  brand_name: "",
  product_name: "",
  product_description: "",
  brand_guide: "",
  default_tone: "自然、真诚、简洁",
  default_keywords: "",
  prohibited_phrases: "",
  allowed_post_types: "真实体验, 产品推荐, 空间灵感, 到店打卡, 新品介绍, 活动分享",
  max_image_count: 9,
  status: "active",
};

function list(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const router = useRouter();
  const [values, setValues] = useState(() =>
    campaign
      ? {
          slug: campaign.slug,
          name: campaign.name,
          brand_name: campaign.brand_name,
          product_name: campaign.product_name,
          product_description: campaign.product_description,
          brand_guide: campaign.brand_guide,
          default_tone: campaign.default_tone,
          default_keywords: campaign.default_keywords.join(", "),
          prohibited_phrases: campaign.prohibited_phrases.join(", "),
          allowed_post_types: campaign.allowed_post_types.join(", "),
          max_image_count: campaign.max_image_count,
          status: campaign.status,
        }
      : initialValues,
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function update(name: string, value: string | number) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const payload = {
      ...values,
      max_image_count: Number(values.max_image_count),
      default_keywords: list(String(values.default_keywords)),
      prohibited_phrases: list(String(values.prohibited_phrases)),
      allowed_post_types: list(String(values.allowed_post_types)),
    };
    const response = await fetch(
      campaign ? `/api/admin/campaigns/${campaign.id}` : "/api/admin/campaigns",
      {
        method: campaign ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json()) as {
      campaign?: Campaign;
      error?: string;
    };
    setSaving(false);
    if (!response.ok || !result.campaign) {
      setMessage(result.error || "保存失败，请检查输入。");
      return;
    }
    setMessage("已保存。");
    if (!campaign) {
      router.push(`/admin/campaigns/${result.campaign.id}`);
      return;
    }
    router.refresh();
  }

  const input = (
    name: keyof typeof values,
    label: string,
    placeholder = "",
    type: "text" | "number" = "text",
  ) => (
    <label>
      <span className="field-label">{label}</span>
      <input
        className="field"
        max={type === "number" ? 12 : undefined}
        min={type === "number" ? 1 : undefined}
        name={name}
        onChange={(event) =>
          update(name, type === "number" ? Number(event.target.value) : event.target.value)
        }
        placeholder={placeholder}
        required={["slug", "name", "brand_name", "product_name"].includes(name)}
        type={type}
        value={values[name]}
      />
    </label>
  );

  return (
    <form className="surface rounded-[28px] p-5 sm:p-7" onSubmit={submit}>
      <div className="grid gap-5 md:grid-cols-2">
        {input("name", "Campaign 名称", "例如：冬日生活灵感")}
        {input("slug", "扫码链接 slug", "winter-living")}
        {input("brand_name", "品牌名称", "例如：Mori Living")}
        {input("product_name", "产品名称", "例如：云感休闲椅")}
      </div>
      <div className="mt-5 grid gap-5">
        <label>
          <span className="field-label">产品说明（只写可验证事实）</span>
          <textarea
            className="textarea-field"
            onChange={(event) => update("product_description", event.target.value)}
            value={values.product_description}
          />
        </label>
        <label>
          <span className="field-label">品牌语气与写作指南</span>
          <textarea
            className="textarea-field"
            onChange={(event) => update("brand_guide", event.target.value)}
            value={values.brand_guide}
          />
        </label>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {input("default_tone", "默认语气", "自然、松弛、有画面感")}
        {input("max_image_count", "最多选择图片", "", "number")}
        {input("default_keywords", "必须/推荐关键词（逗号分隔）")}
        {input("prohibited_phrases", "禁止表达（逗号分隔）")}
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_180px]">
        {input("allowed_post_types", "允许的帖子类型（逗号分隔）")}
        <label>
          <span className="field-label">状态</span>
          <select
            className="select-field"
            onChange={(event) => update("status", event.target.value)}
            value={values.status}
          >
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
        </label>
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button className="button-primary" disabled={saving} type="submit">
          <Save size={16} /> {saving ? "保存中…" : "保存 Campaign"}
        </button>
        {message && <span className="text-sm font-bold text-[#766d65]">{message}</span>}
      </div>
    </form>
  );
}
