import Link from "next/link";
import {
  ArrowRight,
  Check,
  Images,
  QrCode,
  Share2,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const workflow = [
  ["01", "扫码选择图片", "从品牌预设图库挑选并调整顺序。"],
  ["02", "AI 生成草稿", "获得 3 个标题、正文和可编辑标签。"],
  ["03", "复制与分享", "保存图片、复制文案，再由用户确认发布。"],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="page-shell flex h-20 items-center justify-between">
        <BrandMark />
        <Link className="button-secondary" href="/admin">
          管理后台
        </Link>
      </nav>

      <section className="page-shell grid min-h-[680px] items-center gap-14 py-14 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="eyebrow mb-5">QR → CREATE → SHARE</div>
          <h1 className="max-w-[760px] text-[clamp(3rem,7vw,6.7rem)] leading-[0.92] font-black tracking-[-0.07em]">
            扫一下，
            <br />
            好帖子
            <span className="text-[#ef5a4f]">就绪。</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#6d655e]">
            为每场 Campaign 准备品牌图片和边界清晰的内容规则，让顾客几分钟内完成图片选择、文案生成与发布准备。
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="button-primary min-w-44" href="/p/soft-living">
              体验扫码流程 <ArrowRight size={17} />
            </Link>
            <Link className="button-secondary min-w-40" href="/admin/campaigns/new">
              创建 Campaign
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#746d65]">
            {["无需收集用户账号", "人工确认发布", "固定品牌账号可审核排队"].map(
              (item) => (
                <span className="flex items-center gap-2" key={item}>
                  <Check className="text-[#5f8a57]" size={15} strokeWidth={3} />
                  {item}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="dot-grid absolute -inset-10 -z-10 rotate-3 rounded-[48px] opacity-55" />
          <div className="surface relative overflow-hidden rounded-[38px] p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-[#eee7df] pb-5">
              <div>
                <div className="text-xs font-bold text-[#968c83]">MORI LIVING</div>
                <div className="mt-1 text-xl font-black">冬日生活灵感</div>
              </div>
              <div className="rounded-2xl bg-[#f7eee4] p-3">
                <QrCode size={28} />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="relative row-span-2 min-h-72 overflow-hidden rounded-[24px] bg-[#ddd3c8]">
                <img
                  alt="柔和家居空间"
                  className="h-full w-full object-cover"
                  src="https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=900&q=85"
                />
                <span className="absolute top-3 left-3 grid size-7 place-items-center rounded-full bg-[#ef5a4f] text-xs font-black text-white">
                  1
                </span>
              </div>
              <div className="relative min-h-36 overflow-hidden rounded-[24px] bg-[#e5ddd2]">
                <img
                  alt="明亮居家空间"
                  className="h-full w-full object-cover"
                  src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=700&q=85"
                />
                <span className="absolute top-3 left-3 grid size-7 place-items-center rounded-full bg-white text-xs font-black">
                  2
                </span>
              </div>
              <div className="grid min-h-36 place-items-center rounded-[24px] bg-[#e8e0f4] p-5 text-center">
                <Sparkles className="mb-2 text-[#7e63a3]" size={25} />
                <p className="text-sm font-bold leading-5">3 个标题草稿正在生成</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-[22px] bg-[#24211e] px-5 py-4 text-white">
              <span className="text-sm font-bold">已选 2 / 6 张</span>
              <span className="flex items-center gap-2 text-sm font-bold text-[#ffb8b2]">
                下一步 <ArrowRight size={15} />
              </span>
            </div>
          </div>
          <div className="absolute -right-5 -bottom-7 hidden rotate-3 rounded-3xl border border-[#d8e3d2] bg-[#eef5eb] px-5 py-4 shadow-lg sm:block">
            <div className="flex items-center gap-2 text-sm font-black">
              <Share2 size={17} /> 分享已准备
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e7ded5] bg-[#f5ecdf] py-20">
        <div className="page-shell">
          <div className="mb-10 flex items-end justify-between gap-5">
            <div>
              <div className="eyebrow">普通用户模式</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                三步完成发布准备
              </h2>
            </div>
            <Images className="hidden text-[#bda790] sm:block" size={44} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {workflow.map(([number, title, body]) => (
              <article className="rounded-[28px] border border-[#e2d6ca] bg-white p-7" key={number}>
                <div className="text-sm font-black text-[#ef5a4f]">{number}</div>
                <h3 className="mt-12 text-xl font-black">{title}</h3>
                <p className="mt-2 leading-7 text-[#746d65]">{body}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-6 text-[#7b7066]">
            网页不会保证自动把标题、正文、标签与图片全部填入普通用户的小红书发布页。流程始终是：生成内容 → 复制文案 → 保存或分享图片 → 打开小红书 → 用户确认发布。
          </p>
        </div>
      </section>
    </main>
  );
}
