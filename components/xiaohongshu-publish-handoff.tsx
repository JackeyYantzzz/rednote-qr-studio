"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Images,
  LoaderCircle,
  RotateCcw,
  Share2,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import {
  buildXiaohongshuPostText,
  copyTextWithFallback,
  detectShareCapabilities,
  normalizeXiaohongshuTags,
  oneTapPublishToXiaohongshu,
  prepareShareFiles,
  type ShareEvent,
  type ShareFlowStatus,
  type ShareProgress,
} from "@/lib/share/xiaohongshu";
import { buildAndroidChromeIntent } from "@/lib/fast-publish";
import type { Asset, GeneratedPost } from "@/types/database";

type PublishPost = GeneratedPost & { generationId: string };

type HandoffStatus =
  | "ready"
  | "checking"
  | "preparing"
  | "prepared"
  | "copying"
  | "opening"
  | "cancelled"
  | "completed"
  | "fallback"
  | "failed";

type PreparedShare = {
  cacheKey: string;
  files: File[];
  shareAttempted: boolean;
};

export function XiaohongshuPublishHandoff({
  assets,
  campaignSlug,
  maxImageCount,
  post,
}: {
  assets: Asset[];
  campaignSlug: string;
  maxImageCount: number;
  post: PublishPost;
}) {
  const [status, setStatus] = useState<HandoffStatus>("ready");
  const [progress, setProgress] = useState<ShareProgress | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [clipboardWarning, setClipboardWarning] = useState(false);
  const [isWeChatBrowser, setIsWeChatBrowser] = useState(false);
  const [isAndroidBrowser, setIsAndroidBrowser] = useState(false);
  const [isEmbeddedBrowser, setIsEmbeddedBrowser] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [eventCount, setEventCount] = useState(0);
  const preparedRef = useRef<PreparedShare | null>(null);
  const actionLockRef = useRef(false);

  const imageUrls = useMemo(
    () =>
      assets.map(
        (asset) => `/api/assets/${encodeURIComponent(asset.id)}/download`,
      ),
    [assets],
  );
  const cacheKey = useMemo(
    () =>
      JSON.stringify({
        title: post.selectedTitle,
        body: post.body,
        tags: post.tags,
        imageUrls,
      }),
    [imageUrls, post.body, post.selectedTitle, post.tags],
  );
  const fullPost = useMemo(() => {
    try {
      return buildXiaohongshuPostText(
        post.selectedTitle,
        post.body,
        post.tags,
      );
    } catch {
      return "";
    }
  }, [post.body, post.selectedTitle, post.tags]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const capabilities = detectShareCapabilities(navigator);
      setIsWeChatBrowser(capabilities.isWeChatBrowser);
      setIsAndroidBrowser(capabilities.isAndroid);
      setIsEmbeddedBrowser(capabilities.isEmbeddedBrowser);
      setCurrentUrl(window.location.href);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function recordEvent(event: ShareEvent) {
    setEventCount((current) => current + 1);
    window.dispatchEvent(
      new CustomEvent<ShareEvent>("rednote:share", { detail: event }),
    );
  }

  function createLocalEvent(name: ShareEvent["name"]): ShareEvent {
    return {
      name,
      campaignSlug,
      generationId: post.generationId,
      timestamp: new Date().toISOString(),
    };
  }

  async function prepareImages() {
    setStatus("checking");
    setMessage("正在检查标题、正文和图片…");
    setError("");
    setClipboardWarning(false);
    setProgress(null);
    recordEvent(createLocalEvent("share_started"));

    try {
      buildXiaohongshuPostText(
        post.selectedTitle,
        post.body,
        post.tags,
      );
      if (assets.length === 0) throw new Error("请至少选择一张图片。");

      setStatus("preparing");
      const files = await prepareShareFiles(imageUrls, {
        baseUrl: window.location.href,
        maxFiles: maxImageCount,
        onProgress: (nextProgress) => {
          setProgress(nextProgress);
          setMessage(
            `正在准备图片 ${nextProgress.current} / ${nextProgress.total}`,
          );
        },
      });
      preparedRef.current = {
        cacheKey,
        files,
        shareAttempted: false,
      };
      recordEvent(createLocalEvent("share_files_prepared"));
      setStatus("prepared");
      setMessage("图片已准备好。请继续点击，打开手机系统分享菜单。");
      return true;
    } catch (caught) {
      preparedRef.current = null;
      setStatus("failed");
      setError(
        caught instanceof Error
          ? caught.message
          : "图片准备失败，请重新尝试。",
      );
      recordEvent(createLocalEvent("share_failed"));
      return false;
    }
  }

  function mapFlowStatus(
    nextStatus: ShareFlowStatus,
    nextProgress?: ShareProgress,
  ) {
    if (nextProgress) setProgress(nextProgress);
    const statusMap: Record<ShareFlowStatus, HandoffStatus> = {
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

  async function openShareMenu() {
    const prepared = preparedRef.current;
    if (!prepared || prepared.cacheKey !== cacheKey) {
      const ready = await prepareImages();
      if (!ready) return;
      return;
    }

    const firstAttemptAfterPreparation = !prepared.shareAttempted;
    prepared.shareAttempted = true;
    setError("");
    setMessage("");
    setClipboardWarning(false);

    const result = await oneTapPublishToXiaohongshu(
      {
        title: post.selectedTitle,
        body: post.body,
        tags: post.tags,
        imageUrls,
        campaignSlug,
        generationId: post.generationId,
      },
      {
        baseUrl: window.location.href,
        preparedFiles: prepared.files,
        maxFiles: maxImageCount,
        emitStartedEvent: !firstAttemptAfterPreparation,
        onClipboardFailure: () => setClipboardWarning(true),
        onEvent: recordEvent,
        onStatus: mapFlowStatus,
      },
    );

    if (result.status === "cancelled") {
      setStatus("cancelled");
      setMessage(
        "已取消分享。图片和文案仍然保留，你可以再次点击发布。",
      );
      return;
    }
    if (result.status === "shared") {
      if (result.method !== "text-only") {
        setStatus("completed");
        setMessage(
          result.method === "files-only"
            ? "图片已发送到手机分享菜单，完整文案已复制。请在小红书中粘贴并发布。"
            : "内容已发送到手机分享菜单。请在小红书中检查内容并点击发布。",
        );
      } else {
        setStatus("fallback");
        setMessage(
          "当前浏览器不能直接分享多张图片，已打开文字分享。请保存图片后在小红书中选择。",
        );
      }
      return;
    }

    setStatus("fallback");
    const fallbackMessages = {
      "share-unsupported":
        "当前浏览器不支持系统分享。文案已尽量复制，请保存图片后打开小红书。",
      "file-share-unsupported":
        "当前浏览器不能直接分享多张图片。图片已准备好，请保存后打开小红书。",
      "clipboard-failed":
        "无法直接分享，且文案未能自动复制。请使用下方“复制完整帖子”。",
      "image-prepare-failed":
        "图片准备失败。请检查具体提示后重试，系统不会跳过失败图片。",
      "wechat-browser":
        "微信内浏览器可能限制多张图片分享。请在 Safari 或 Chrome 中打开后再发布。",
      "embedded-browser":
        "当前内置浏览器限制系统分享。请在 Chrome 中打开后再发布。",
      unknown:
        "无法直接分享。图片和文案仍然保留，请重试或使用下方手动方式。",
    } satisfies Record<typeof result.reason, string>;
    setMessage(fallbackMessages[result.reason]);
  }

  async function handlePrimaryAction() {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    try {
      await openShareMenu();
    } finally {
      actionLockRef.current = false;
    }
  }

  async function copyPart(value: string, label: string) {
    const copied = await copyTextWithFallback(value);
    setMessage(
      copied
        ? `${label}已复制。`
        : `${label}自动复制失败，请长按内容手动复制。`,
    );
    if (!copied) setClipboardWarning(true);
  }

  function saveImage(asset: Asset, index: number) {
    const anchor = document.createElement("a");
    anchor.href = `/api/assets/${encodeURIComponent(asset.id)}/download`;
    anchor.download = `xhs-${String(index + 1).padStart(2, "0")}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function saveAllImages() {
    assets.forEach((asset, index) => {
      window.setTimeout(() => saveImage(asset, index), index * 350);
    });
    setMessage("已按当前顺序发起图片保存；部分手机会逐张确认。");
  }

  const isBusy = ["checking", "preparing", "copying", "opening"].includes(
    status,
  );
  const primaryLabel = getPrimaryLabel(status, progress);

  return (
    <div className="pb-44" data-share-events={eventCount}>
      <div className="surface mt-6 rounded-[28px] p-5">
        <p className="eyebrow">FINAL CHECK</p>
        <h2 className="mt-2 text-xl font-black">{post.selectedTitle}</h2>
        <p className="mt-4 line-clamp-6 whitespace-pre-wrap text-sm leading-7 text-[#635c55]">
          {post.body}
        </p>
        <p className="mt-4 text-sm leading-7 text-[#c5473e]">
          {normalizeXiaohongshuTags(post.tags)
            .map((tag) => `#${tag}`)
            .join(" ")}
        </p>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {assets.map((asset, index) => (
            <div className="relative size-20 shrink-0" key={asset.id}>
              <img
                alt={`第 ${index + 1} 张：${asset.name}`}
                className="size-20 rounded-2xl object-cover"
                src={asset.file_url}
              />
              <span className="absolute top-1 left-1 grid size-6 place-items-center rounded-full bg-black/70 text-[10px] font-black text-white">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isEmbeddedBrowser && (
        <div className="mt-4 flex gap-3 rounded-[22px] border border-[#efcf9e] bg-[#fff8e9] p-4 text-sm leading-6 text-[#72521e]">
          <TriangleAlert className="mt-0.5 shrink-0" size={19} />
          <div>
            <p className="font-black">请先使用系统浏览器打开</p>
            <p className="mt-1">
              {isWeChatBrowser
                ? "微信内浏览器可能限制多张图片分享。"
                : "当前 App 的内置浏览器可能限制系统分享。"}
              请点击右上角菜单选择“在浏览器中打开”，Android 使用 Chrome。
            </p>
            {isAndroidBrowser && currentUrl && (
              <a
                className="button-secondary mt-3"
                href={buildAndroidChromeIntent(currentUrl)}
              >
                <ExternalLink size={15} /> 在 Chrome 打开
              </a>
            )}
          </div>
        </div>
      )}

      {isAndroidBrowser && !isEmbeddedBrowser && (
        <div className="mt-4 rounded-[22px] border border-[#d8e5d2] bg-[#f4f9f1] p-4 text-sm leading-6 text-[#3f6336]">
          <p className="font-black">Android 兼容模式已启用</p>
          <p className="mt-1">
            系统会优先分享图片，并把完整文案复制到剪贴板；进入小红书后直接粘贴即可。
          </p>
        </div>
      )}

      {(message || error || clipboardWarning) && (
        <div
          aria-live="polite"
          className={`mt-4 rounded-[22px] border p-4 text-sm leading-6 ${
            error
              ? "border-[#f3c9c5] bg-[#fff4f2] text-[#9e3931]"
              : "border-[#d8e5d2] bg-[#f4f9f1] text-[#3f6336]"
          }`}
        >
          <div className="flex gap-3">
            {error ? (
              <TriangleAlert className="mt-0.5 shrink-0" size={18} />
            ) : (
              <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            )}
            <div>
              <p className="font-bold">{error || message}</p>
              {clipboardWarning && (
                <p className="mt-1 text-[#795b28]">
                  图片可以继续分享，但文案未能自动复制，请使用下方“复制完整帖子”。
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-[24px] bg-[#f5ecdf] p-5">
        <p className="font-black">发布前请记住</p>
        <p className="mt-2 text-sm leading-6 text-[#655d56]">
          系统会准备图片和完整文案，并打开手机分享菜单。请在菜单中选择“小红书”完成发布。
        </p>
        <p className="mt-2 text-xs leading-5 text-[#84796f]">
          完整文案也会复制到剪贴板。如果小红书没有自动带入文字，可以直接粘贴。
        </p>
      </div>

      <details className="surface mt-5 rounded-[24px] p-4">
        <summary className="cursor-pointer list-none text-sm font-black">
          发布遇到问题？
          <span className="ml-2 text-xs font-medium text-[#8d8177]">
            展开备用方式
          </span>
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <FallbackButton
            icon={Copy}
            label="复制完整帖子"
            onClick={() => void copyPart(fullPost, "完整帖子")}
          />
          <FallbackButton
            icon={Copy}
            label="复制标题"
            onClick={() => void copyPart(post.selectedTitle.trim(), "标题")}
          />
          <FallbackButton
            icon={Copy}
            label="复制正文"
            onClick={() => void copyPart(post.body.trim(), "正文")}
          />
          <FallbackButton
            icon={Copy}
            label="复制标签"
            onClick={() =>
              void copyPart(
                normalizeXiaohongshuTags(post.tags)
                  .map((tag) => `#${tag}`)
                  .join(" "),
                "标签",
              )
            }
          />
          <FallbackButton
            icon={Images}
            label="保存全部图片"
            onClick={saveAllImages}
          />
          <FallbackButton
            icon={RotateCcw}
            label="再次调起分享"
            onClick={() => void handlePrimaryAction()}
          />
        </div>

        <p className="mt-5 text-xs font-black tracking-wide text-[#84796f]">
          逐张保存图片
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {assets.map((asset, index) => (
            <button
              className="relative aspect-square overflow-hidden rounded-2xl bg-[#e8e0d8]"
              key={asset.id}
              onClick={() => saveImage(asset, index)}
              type="button"
            >
              <img
                alt={asset.name}
                className="h-full w-full object-cover"
                src={asset.file_url}
              />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/65 py-2 text-[10px] font-bold text-white">
                <Download size={11} /> 保存 {index + 1}
              </span>
            </button>
          ))}
        </div>

        <a
          className="button-secondary mt-4 w-full !min-h-12"
          href="https://www.xiaohongshu.com/"
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink size={16} /> 打开小红书官方网站
        </a>

        <details className="mt-4 rounded-2xl bg-[#faf6f1] p-4">
          <summary className="cursor-pointer text-sm font-black">
            查看手动发布步骤
          </summary>
          <ol className="mt-3 grid gap-3 text-sm leading-6 text-[#665e57]">
            {[
              "保存全部图片，确认顺序与页面中的编号一致。",
              "打开小红书 App，新建图文笔记并选择刚保存的图片。",
              "粘贴完整文案，检查标题、正文和标签。",
              "确认可见性与内容后，由你点击发布。",
            ].map((item, index) => (
              <li className="flex gap-3" key={item}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-black">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </details>

        <p className="mt-4 text-xs leading-5 text-[#84796f]">
          如果分享菜单中没有小红书，请先确认已安装小红书 App，或使用“保存图片
          + 复制文案”的方式发布。
        </p>
      </details>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e4dbd3] bg-white/96 px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(48,37,29,.10)] backdrop-blur-xl">
        <div className="mx-auto max-w-3xl">
          <button
            className="button-primary w-full !min-h-14 text-base"
            disabled={isBusy}
            onClick={() => void handlePrimaryAction()}
            type="button"
          >
            {isBusy ? (
              <LoaderCircle className="animate-spin" size={19} />
            ) : status === "prepared" ? (
              <Smartphone size={19} />
            ) : (
              <Share2 size={19} />
            )}
            {primaryLabel}
          </button>
          <p className="mt-2 text-center text-[11px] leading-4 text-[#7f746a]">
            系统只负责交接内容；请在小红书中检查并由你最终发布。
          </p>
        </div>
      </div>
    </div>
  );
}

function getPrimaryLabel(
  status: HandoffStatus,
  progress: ShareProgress | null,
) {
  const labels: Record<HandoffStatus, string> = {
    ready: "一键去小红书发布",
    checking: "正在检查内容",
    preparing: progress
      ? `正在准备图片 ${progress.current}/${progress.total}`
      : "正在准备图片",
    prepared: "图片已准备好，继续打开分享菜单",
    copying: "正在复制文案",
    opening: "正在打开分享菜单",
    cancelled: "分享已取消，再次尝试",
    completed: "分享已完成，再次调起",
    fallback: "无法直接分享，重新尝试",
    failed: "准备失败，重新尝试",
  };
  return labels[status];
}

function FallbackButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="button-secondary !min-h-12 !rounded-2xl !px-3 text-xs"
      onClick={onClick}
      type="button"
    >
      <Icon size={15} /> {label}
    </button>
  );
}
