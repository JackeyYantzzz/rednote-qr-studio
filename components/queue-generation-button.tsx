"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Generation } from "@/types/database";

export function QueueGenerationButton({ generation }: { generation: Generation }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const content = generation.edited_content ?? generation.generated_content;

  async function queue() {
    setLoading(true);
    const response = await fetch("/api/admin/publish-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationId: generation.id,
        title: content.selectedTitle,
        content: content.body,
        tags: content.tags,
        visibility: "private",
        scheduleAt: null,
        isOriginal: true,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setLoading(false);
    setMessage(response.ok ? "已创建待确认任务" : result.error || "创建失败");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="button-primary" disabled={loading || Boolean(message)} onClick={queue} type="button">
        <CheckCircle2 size={16} /> {loading ? "创建中…" : "审核通过并创建任务"}
      </button>
      {message && <span className="text-xs font-bold text-[#6f675f]">{message}</span>}
    </div>
  );
}
