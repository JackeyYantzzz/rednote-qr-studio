import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CampaignForm } from "@/components/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Link className="button-ghost mb-5 !px-0" href="/admin/campaigns">
        <ArrowLeft size={16} /> 返回 Campaign
      </Link>
      <div className="mb-7">
        <div className="eyebrow">NEW CAMPAIGN</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">创建扫码入口</h1>
        <p className="mt-3 text-[#746d65]">先定义事实和文案边界，保存后再上传图片并下载二维码。</p>
      </div>
      <CampaignForm />
    </div>
  );
}
