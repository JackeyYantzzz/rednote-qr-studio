import Link from "next/link";
import {
  BarChart3,
  BriefcaseBusiness,
  GalleryHorizontalEnd,
  Gauge,
  LayoutDashboard,
  Plus,
  Zap,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import type { AdminUser } from "@/lib/auth";

const nav = [
  { href: "/admin", label: "总览", icon: LayoutDashboard },
  { href: "/admin/campaigns", label: "Campaign", icon: GalleryHorizontalEnd },
  { href: "/admin/generations", label: "生成记录", icon: BarChart3 },
  { href: "/admin/quota", label: "生成额度", icon: Gauge },
  { href: "/admin/fast-publish", label: "快发数据", icon: Zap },
  { href: "/admin/publish-jobs", label: "发布任务", icon: BriefcaseBusiness },
];

export function AdminShell({
  admin,
  children,
}: {
  admin: AdminUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-[#e8e0d8] bg-white lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="flex h-20 items-center justify-between px-5 lg:px-7">
          <BrandMark />
          <Link className="button-primary !size-10 !min-h-10 !p-0 lg:hidden" href="/admin/campaigns/new">
            <Plus size={18} />
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:px-4 lg:pt-5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              className="flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[#665f58] hover:bg-[#f7f2ec] hover:text-[#292521] lg:mb-1"
              href={href}
              key={href}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mx-4 mt-5 hidden rounded-[22px] bg-[#f5ecdf] p-4 lg:block">
          <p className="text-xs font-bold text-[#8a7766]">当前管理员</p>
          <p className="mt-1 truncate text-sm font-black">{admin.email}</p>
          {admin.demo && (
            <span className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#a2534c]">
              本地演示模式
            </span>
          )}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="hidden h-20 items-center justify-end border-b border-[#e8e0d8] bg-white/80 px-8 backdrop-blur lg:flex">
          <Link className="button-primary" href="/admin/campaigns/new">
            <Plus size={16} /> 新建 Campaign
          </Link>
        </header>
        <main className="p-4 sm:p-7 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
