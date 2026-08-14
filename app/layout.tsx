import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "红薯帖帖 · 扫码生成小红书帖子",
    template: "%s · 红薯帖帖",
  },
  description:
    "为品牌 Campaign 提供图片选择、AI 文案生成、复制分享与固定品牌账号审核发布。",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: "红薯帖帖 · 扫码一下，好帖子就绪。",
    description: "选择图片、AI 生成、复制分享，并由用户最终确认发布。",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "红薯帖帖产品预览" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "红薯帖帖 · 扫码一下，好帖子就绪。",
    description: "选择图片、AI 生成、复制分享，并由用户最终确认发布。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
