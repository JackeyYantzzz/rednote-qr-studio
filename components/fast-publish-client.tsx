"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  LoaderCircle,
  Share2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  buildAndroidChromeIntent,
  getFastPublishButtonLabel,
  mapFastShareResultToEvent,
  type FastPublishUiStatus,
} from "@/lib/fast-publish";
import {
  copyTextWithFallback,
  detectShareCapabilities,
  oneTapPublishToXiaohongshu,
  prepareShareFiles,
  type ShareCapabilities,
  type ShareFlowStatus,
  type ShareProgress,
} from "@/lib/share/xiaohongshu";
import type { Asset, FastPublishContent, FastPublishEventName } from "@/types/database";

function createSessionId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function FastPublishClient({
  assets,
  brandName,
  campaignName,
  campaignSlug,
  content,
  fullPost,
  maxImageCount,
}: {
  assets: Asset[];
  brandName: string;
  campaignName: string;
  campaignSlug: string;
  content: FastPublishContent;
  fullPost: string;
  maxImageCount: number;
}) {
  const imageUrls = useMemo(
    () =>
      assets.map(
        (asset) => `/api/assets/${encodeURIComponent(asset.id)}/download`,
      ),
    [assets],
  );
  const [status, setStatus] = useState<FastPublishUiStatus>("preparing");
  const [progress, setProgress] = useState<ShareProgress>({
    current: 0,
    total: imageUrls.length,
  });
  const [message, setMessage] = useState("正在提前准备图片，请稍候…");
  const [error, setError] = useState("");
  const [clipboardWarning, setClipboardWarning] = useState(false);
  const [environment, setEnvironment] =
    useState<ShareCapabilities | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const preparedFilesRef = useRef<File[] | null>(null);
  const actionLockRef = useRef(false);
  const mountedRef = useRef(true);
  const pageViewSentRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  const track = useCallback(
    (eventName: FastPublishEventName) => {
      sessionIdRef.current ??= createSessionId();
      void fetch("/api/fast-publish/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlug,
          eventName,
          sessionId: sessionIdRef.current,
        }),
        keepalive: true,
      }).catch(() => undefined);
    },
    [campaignSlug],
  );

  const prepareImages = useCallback(async () => {
    setStatus("preparing");
    setProgress({ current: 0, total: imageUrls.length });
    setMessage("正在提前准备图片，请稍候…");
    setError("");
    try {
      const files = await prepareShareFiles(imageUrls, {
        baseUrl: window.location.href,
        maxFiles: maxImageCount,
        onProgress: (nextProgress) => {
          if (!mountedRef.current) return;
          setProgress(nextProgress);
          setMessage(
            `正在准备图片 ${nextProgress.current}/${nextProgress.total}`,
          );
        },
      });
      if (!mountedRef.current) return;
      preparedFilesRef.current = files;
      setStatus("ready");
      setMessage("图片和帖子已经准备好，点击一次即可打开分享菜单。");
    } catch (caught) {
      if (!mountedRef.current) return;
      preparedFilesRef.current = null;
      setStatus("failed");
      setError(
        caught instanceof Error
          ? caught.message
          : "图片准备失败，请重新尝试。",
      );
      track("fast_share_failed");
    }
  }, [imageUrls, maxImageCount, track]);

  useEffect(() => {
    mountedRef.current = true;
    if (!pageViewSentRef.current) {
      pageViewSentRef.current = true;
      track("fast_page_view");
    }
    const timer = window.setTimeout(() => {
      setEnvironment(detectShareCapabilities(navigator));
      setCurrentUrl(window.location.href);
      void prepareImages();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      mountedRef.current = false;
    };
  }, [prepareImages, track]);

  function mapStatus(nextStatus: ShareFlowStatus) {
    const statusMap: Record<ShareFlowStatus, FastPublishUiStatus> = {
      checking: "checking",
      "preparing-files": "preparing",
      "copying-text": "copying",
      "opening-share-menu": "opening",
      cancelled: "cancelled",
      completed: "completed",
      fallback: "fallback",
    };
    setStatus(statusMap[nextStatus]);
  }

  async function share() {
    if (actionLockRef.current) return;
    if (!preparedFilesRef.current) {
      await prepareImages();
      return;
    }

    actionLockRef.current = true;
    setError("");
    setClipboardWarning(false);
    track("fast_share_clicked");
    try {
      const result = await oneTapPublishToXiaohongshu(
        {
          title: content.title,
          body: content.body,
          tags: content.tags,
          imageUrls,
          campaignSlug,
        },
        {
          baseUrl: window.location.href,
          preparedFiles: preparedFilesRef.current,
          maxFiles: maxImageCount,
          onClipboardFailure: () => setClipboardWarning(true),
          onStatus: mapStatus,
        },
      );
      track(mapFastShareResultToEvent(result));

      if (result.status === "cancelled") {
        setStatus("cancelled");
        setMessage("已取消分享，内容仍然保留，可以再次尝试。");
        return;
      }
      if (result.status === "shared") {
        if (result.method !== "text-only") {
          setStatus("completed");
          setMessage(
            result.method === "files-only"
              ? "图片已发送到分享菜单，完整文案已复制。请在小红书粘贴并发布。"
              : "内容已发送到分享菜单，请在小红书检查并发布。",
          );
        } else {
          setStatus("fallback");
          setMessage(
            "当前浏览器只打开了文字分享；请使用文案备用，并确认图片已经带入。",
          );
        }
        return;
      }

      setStatus("fallback");
      setMessage(
        result.reason === "wechat-browser" ||
          result.reason === "embedded-browser"
          ? "当前内置浏览器限制系统分享。请使用下方按钮在 Chrome 打开。"
          : "当前手机未能完成图文交接。内容仍然保留，请重新尝试。",
      );
    } finally {
      actionLockRef.current = false;
    }
  }

  const isBusy = ["preparing", "checking", "copying", "opening"].includes(
    status,
  );
  const showSuccess = status === "completed";
  const chromeIntentUrl =
    currentUrl && environment?.isAndroid
      ? buildAndroidChromeIntent(currentUrl)
      : "";

  return (
    <main className="min-h-screen bg-[#fbf8f4] pb-32">
      <header className="border-b border-[#ebe3dc] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <BrandMark compact />
          <div className="min-w-0 pl-4 text-right">
            <p className="truncate text-sm font-black">{brandName}</p>
            <p className="truncate text-[11px] text-[#8b8178]">
              {campaignName}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center gap-2 text-[#cf443a]">
          <Zap size={15} />
          <span className="text-xs font-black tracking-[0.16em]">
            FAST PUBLISH
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          帖子已经准备好了
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#746d65]">
          图片顺序和文案已经由管理员审核，你不需要再做选择。
        </p>

        {environment?.isAndroid && (
          <div
            className={`mt-5 rounded-[22px] border p-4 text-sm leading-6 ${
              environment.isEmbeddedBrowser
                ? "border-[#efcf9e] bg-[#fff8e9] text-[#72521e]"
                : "border-[#d8e5d2] bg-[#f4f9f1] text-[#3f6336]"
            }`}
          >
            <p className="font-black">
              {environment.isEmbeddedBrowser
                ? "请先使用 Chrome 打开"
                : "Android 兼容模式已启用"}
            </p>
            <p className="mt-1">
              {environment.isEmbeddedBrowser
                ? "微信、QQ、支付宝等内置浏览器可能禁止网页调用系统分享。"
                : "系统会优先分享图片，并把完整文案复制到剪贴板。"}
            </p>
            {environment.isEmbeddedBrowser && chromeIntentUrl && (
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="button-secondary" href={chromeIntentUrl}>
                  <ExternalLink size={15} /> 在 Chrome 打开
                </a>
                <button
                  className="button-ghost"
                  onClick={() => {
                    void copyTextWithFallback(currentUrl);
                    setMessage("页面链接已复制，请粘贴到 Chrome 地址栏打开。");
                  }}
                  type="button"
                >
                  <Copy size={15} /> 复制页面链接
                </button>
              </div>
            )}
          </div>
        )}

        <section className="mt-6">
          <div
            aria-label="快发图片预览"
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3"
          >
            {assets.map((asset, index) => (
              <figure
                className="relative aspect-[4/5] min-w-[82%] snap-center overflow-hidden rounded-[28px] bg-[#e8e0d8] shadow-[0_16px_40px_rgba(54,42,33,.12)] sm:min-w-[60%]"
                key={asset.id}
              >
                <img
                  alt={`第 ${index + 1} 张：${asset.name}`}
                  className="h-full w-full object-cover"
                  src={asset.file_url}
                />
                <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 to-transparent p-4 pt-16 text-white">
                  <span className="text-sm font-black">{asset.name}</span>
                  <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-black backdrop-blur">
                    {index + 1}/{assets.length}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="surface mt-5 rounded-[28px] p-5 sm:p-6">
          <p className="eyebrow">审核后的帖子</p>
          <h2 className="mt-3 text-xl font-black leading-8">{content.title}</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#625b54]">
            {content.body}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {content.tags.map((tag) => (
              <span
                className="rounded-full bg-[#f9e3e0] px-3 py-2 text-xs font-bold text-[#bf4339]"
                key={tag}
              >
                #{tag}
              </span>
            ))}
          </div>
        </section>

        <div
          aria-live="polite"
          className={`mt-5 flex gap-3 rounded-[22px] border p-4 text-sm leading-6 ${
            error
              ? "border-[#f3c9c5] bg-[#fff4f2] text-[#9e3931]"
              : "border-[#d8e5d2] bg-[#f4f9f1] text-[#3f6336]"
          }`}
        >
          {error ? (
            <TriangleAlert className="mt-0.5 shrink-0" size={18} />
          ) : showSuccess ? (
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          ) : (
            <Zap className="mt-0.5 shrink-0" size={18} />
          )}
          <div>
            <p className="font-bold">{error || message}</p>
            {clipboardWarning && (
              <p className="mt-1 text-[#795b28]">
                文案未能自动复制。如果小红书没有带入文字，请使用下方备用按钮。
              </p>
            )}
          </div>
        </div>

        {(clipboardWarning || status === "fallback") && (
          <button
            className="button-secondary mt-3 w-full"
            onClick={() => void copyTextWithFallback(fullPost)}
            type="button"
          >
            <Copy size={15} /> 复制完整文案备用
          </button>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-[#84796f]">
          网页只负责把内容交给系统分享菜单，不会记录或声称已经发布。
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e4dbd3] bg-white/96 px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(48,37,29,.10)] backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          <button
            className="button-primary w-full !min-h-14 text-base"
            disabled={isBusy}
            onClick={() => void share()}
            type="button"
          >
            {isBusy ? (
              <LoaderCircle className="animate-spin" size={19} />
            ) : (
              <Share2 size={19} />
            )}
            {getFastPublishButtonLabel(status, progress)}
          </button>
        </div>
      </div>
    </main>
  );
}
