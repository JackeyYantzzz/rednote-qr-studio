"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink } from "lucide-react";
import {
  buildCampaignQrUrl,
  type CampaignQrMode,
} from "@/lib/fast-publish";

export function QrPanel({
  slug,
  configuredSiteUrl,
  fastPublishEnabled,
}: {
  slug: string;
  configuredSiteUrl: string;
  fastPublishEnabled: boolean;
}) {
  const [mode, setMode] = useState<CampaignQrMode>("custom");
  const link = useMemo(
    () => buildCampaignQrUrl(configuredSiteUrl, slug, mode),
    [configuredSiteUrl, mode, slug],
  );
  const [png, setPng] = useState("");
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const local = /localhost|127\.0\.0\.1/.test(configuredSiteUrl);

  useEffect(() => {
    void QRCode.toDataURL(link, {
      width: 560,
      margin: 2,
      color: { dark: "#24211e", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setPng);
    void QRCode.toString(link, {
      type: "svg",
      margin: 2,
      color: { dark: "#24211e", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setSvg);
  }, [link]);

  function download(href: string, filename: string) {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
  }

  return (
    <section className="surface rounded-[28px] p-5 sm:p-7">
      <div className="grid items-center gap-7 md:grid-cols-[220px_1fr]">
        <div className="mx-auto aspect-square w-full max-w-[220px] rounded-[28px] border border-[#e8e0d8] bg-white p-4">
          {png ? <img alt="Campaign 二维码" className="h-full w-full" src={png} /> : null}
        </div>
        <div>
          <div className="eyebrow">Campaign QR</div>
          <h2 className="mt-2 text-2xl font-black">扫码链接已经准备</h2>
          <fieldset className="mt-5 grid gap-2 sm:grid-cols-2">
            <legend className="field-label">二维码类型</legend>
            <label className="flex cursor-pointer gap-3 rounded-2xl border border-[#e4dcd4] bg-white p-4">
              <input
                checked={mode === "custom"}
                className="mt-1 accent-[#ef5a4f]"
                name="qr-mode"
                onChange={() => {
                  setMode("custom");
                  setCopied(false);
                }}
                type="radio"
              />
              <span>
                <strong className="block text-sm">自定义模式</strong>
                <span className="mt-1 block text-xs leading-5 text-[#7c736b]">
                  用户可以自由选择图片和生成内容
                </span>
              </span>
            </label>
            <label
              className={`flex gap-3 rounded-2xl border border-[#e4dcd4] p-4 ${
                fastPublishEnabled
                  ? "cursor-pointer bg-white"
                  : "cursor-not-allowed bg-[#f4f1ee] opacity-60"
              }`}
            >
              <input
                checked={mode === "fast"}
                className="mt-1 accent-[#ef5a4f]"
                disabled={!fastPublishEnabled}
                name="qr-mode"
                onChange={() => {
                  setMode("fast");
                  setCopied(false);
                }}
                type="radio"
              />
              <span>
                <strong className="block text-sm">快发模式</strong>
                <span className="mt-1 block text-xs leading-5 text-[#7c736b]">
                  用户扫码即可发布管理员审核好的内容
                </span>
              </span>
            </label>
          </fieldset>
          {!fastPublishEnabled && (
            <p className="mt-2 text-xs font-bold text-[#a2584f]">
              保存并启用 Fast Publish 设置后，才能生成快发二维码。
            </p>
          )}
          <p className="mt-3 break-all rounded-2xl bg-[#f7f2ec] p-4 text-sm leading-6">{link}</p>
          {local && (
            <p className="mt-3 text-sm leading-6 text-[#a2584f]">
              当前是本地测试二维码。印刷或正式投放前，请把 NEXT_PUBLIC_SITE_URL 改成稳定的生产域名后重新下载。
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="button-secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
              type="button"
            >
              <Copy size={15} /> {copied ? "已复制" : "复制链接"}
            </button>
            <button
              className="button-secondary"
              disabled={!png}
              onClick={() => download(png, `${slug}-${mode}-qr.png`)}
              type="button"
            >
              <Download size={15} /> PNG
            </button>
            <button
              className="button-secondary"
              disabled={!svg}
              onClick={() =>
                download(
                  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
                  `${slug}-${mode}-qr.svg`,
                )
              }
              type="button"
            >
              <Download size={15} /> SVG
            </button>
            <a className="button-ghost" href={link} rel="noreferrer" target="_blank">
              打开扫码页 <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
