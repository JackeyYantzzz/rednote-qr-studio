"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, X } from "lucide-react";
import type { PublishJob } from "@/types/database";

export function PublishJobActions({ job }: { job: PublishJob }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function act(action: "approve" | "cancel" | "retry") {
    let confirmPublic = false;
    if (action === "approve" && job.visibility === "public") {
      confirmPublic = window.confirm(
        "此任务将发布为公开可见。确认已完成最终审核并允许公开发布吗？",
      );
      if (!confirmPublic) return;
    }
    setLoading(true);
    const response = await fetch(`/api/admin/publish-jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, confirmPublic }),
    });
    const result = (await response.json()) as { error?: string };
    setLoading(false);
    setMessage(response.ok ? "状态已更新" : result.error || "操作失败");
    if (response.ok) router.refresh();
  }

  if (["published", "cancelled"].includes(job.status)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {job.status === "pending" && (
        <button className="button-primary !min-h-9 !px-3 text-xs" disabled={loading} onClick={() => void act("approve")} type="button">
          <Check size={14} /> 确认入队
        </button>
      )}
      {job.status === "failed" && (
        <button className="button-secondary !min-h-9 !px-3 text-xs" disabled={loading} onClick={() => void act("retry")} type="button">
          <RotateCcw size={14} /> 重试
        </button>
      )}
      {!["preparing", "publishing"].includes(job.status) && (
        <button className="button-ghost !min-h-9 !px-3 text-xs" disabled={loading} onClick={() => void act("cancel")} type="button">
          <X size={14} /> 取消
        </button>
      )}
      {message && <span className="text-xs text-[#766d65]">{message}</span>}
    </div>
  );
}
