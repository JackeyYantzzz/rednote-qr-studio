import type { PublishJobStatus } from "@/types/database";

const labels: Record<PublishJobStatus, string> = {
  pending: "待确认",
  approved: "已批准",
  preparing: "准备中",
  publishing: "发布中",
  published: "已发布",
  failed: "失败",
  cancelled: "已取消",
};

const styles: Record<PublishJobStatus, string> = {
  pending: "bg-[#f3eee8] text-[#675d53]",
  approved: "bg-[#e9f0e5] text-[#54734c]",
  preparing: "bg-[#e8eef8] text-[#45658a]",
  publishing: "bg-[#eee8f8] text-[#72569d]",
  published: "bg-[#dcebd9] text-[#3f7339]",
  failed: "bg-[#fbe3e1] text-[#ae3c33]",
  cancelled: "bg-[#eee] text-[#777]",
};

export function StatusPill({ status }: { status: PublishJobStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
