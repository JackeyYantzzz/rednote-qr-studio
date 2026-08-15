"use client";

import { useState } from "react";
import { LockKeyhole, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import type { GenerationQuotaStatus } from "@/types/database";

export function QuotaManager({
  initialQuota,
}: {
  initialQuota: GenerationQuotaStatus;
}) {
  const [quota, setQuota] = useState(initialQuota);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function resetQuota() {
    if (!window.confirm("确定将全站生成次数重置为 0 吗？此操作会立即重新开放生成。")) {
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/quota", { method: "POST" });
      const payload = (await response.json()) as GenerationQuotaStatus & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "重置失败");
      setQuota(payload);
      setMessage("全站生成额度已重置为 0。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重置失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  const progress = Math.min((quota.usedCount / quota.limitCount) * 100, 100);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <div className="eyebrow">GLOBAL QUOTA</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
          全站生成额度
        </h1>
        <p className="mt-3 text-[#746d65]">
          全站累计最多调用 DeepSeek {quota.limitCount} 次，达到上限后由管理员手动重置。
        </p>
      </div>

      <section className="surface rounded-[28px] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${
                quota.locked
                  ? "bg-[#f9e3e0] text-[#a34840]"
                  : "bg-[#e5eee1] text-[#4f7548]"
              }`}
            >
              {quota.locked ? <LockKeyhole size={15} /> : <ShieldCheck size={15} />}
              {quota.locked ? "已锁定" : "可正常生成"}
            </span>
            <div className="mt-6 flex items-end gap-2">
              <strong className="text-6xl font-black">{quota.usedCount}</strong>
              <span className="pb-2 text-xl font-bold text-[#81776f]">
                / {quota.limitCount}
              </span>
            </div>
            <p className="mt-2 text-sm font-bold text-[#81776f]">
              剩余 {quota.remaining} 次
            </p>
          </div>

          <span className="grid size-16 place-items-center rounded-[22px] bg-[#f5ecdf]">
            <Sparkles size={28} />
          </span>
        </div>

        <div className="mt-7 h-3 overflow-hidden rounded-full bg-[#eee7df]">
          <div
            className={`h-full rounded-full transition-all ${
              quota.locked ? "bg-[#d9655a]" : "bg-[#292521]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-8 border-t border-[#ece5de] pt-6">
          <button
            className="button-primary"
            disabled={loading || quota.usedCount === 0}
            onClick={resetQuota}
            type="button"
          >
            <RefreshCcw className={loading ? "animate-spin" : ""} size={16} />
            {loading ? "正在重置…" : "重置为 0"}
          </button>
          {message && (
            <p className="mt-4 rounded-2xl bg-[#f7f2ec] p-4 text-sm font-bold">
              {message}
            </p>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-[24px] border border-[#eadfd4] bg-[#fbf7f2] p-5 text-sm leading-7 text-[#746d65]">
        每个通过验证并开始调用 DeepSeek 的请求会占用一次额度。达到 25 次后，
        所有用户的生成请求都会被阻止，直到管理员在此页面重置。
      </section>
    </div>
  );
}
