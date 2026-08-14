export type XiaohongshuShareInput = {
  title: string;
  body: string;
  tags: string[];
  imageUrls: string[];
  campaignSlug: string;
  generationId?: string;
};

export type XiaohongshuFallbackReason =
  | "share-unsupported"
  | "file-share-unsupported"
  | "clipboard-failed"
  | "image-prepare-failed"
  | "wechat-browser"
  | "embedded-browser"
  | "unknown";

export type XiaohongshuShareResult =
  | {
      status: "shared";
      method: "files-and-text" | "files-only" | "text-only";
    }
  | {
      status: "cancelled";
    }
  | {
      status: "fallback";
      reason: XiaohongshuFallbackReason;
    };

export type ShareEventName =
  | "share_started"
  | "share_files_prepared"
  | "share_menu_opened"
  | "share_completed"
  | "share_cancelled"
  | "share_failed"
  | "fallback_used";

export type ShareEvent = {
  name: ShareEventName;
  campaignSlug: string;
  generationId?: string;
  timestamp: string;
  method?: "files-and-text" | "files-only" | "text-only";
  reason?: XiaohongshuFallbackReason;
};

export type ShareFlowStatus =
  | "checking"
  | "preparing-files"
  | "copying-text"
  | "opening-share-menu"
  | "cancelled"
  | "completed"
  | "fallback";

export type ShareProgress = {
  current: number;
  total: number;
};

type ShareNavigator = Partial<
  Pick<Navigator, "canShare" | "clipboard" | "share" | "userAgent">
>;

export type ShareCapabilities = {
  userAgent: string;
  hasNavigatorShare: boolean;
  hasNavigatorCanShare: boolean;
  canShareFiles: boolean;
  hasClipboard: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWeChatBrowser: boolean;
  isEmbeddedBrowser: boolean;
  isMobile: boolean;
};

export type PrepareShareFilesOptions = {
  allowedHosts?: string[];
  baseUrl?: string;
  fetchFn?: typeof fetch;
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  onProgress?: (progress: ShareProgress) => void;
  convertToJpeg?: (blob: Blob) => Promise<Blob>;
};

export type OneTapShareOptions = PrepareShareFilesOptions & {
  navigatorLike?: ShareNavigator;
  documentLike?: Document;
  preparedFiles?: File[];
  legacyCopy?: (text: string) => boolean;
  emitStartedEvent?: boolean;
  onClipboardFailure?: () => void;
  onEvent?: (event: ShareEvent) => void;
  onStatus?: (status: ShareFlowStatus, progress?: ShareProgress) => void;
};

export const DEFAULT_MAX_SHARE_IMAGE_BYTES = 15 * 1024 * 1024;
export const DEFAULT_MAX_SHARE_TOTAL_BYTES = 60 * 1024 * 1024;

const DIRECT_SHARE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

let shareInFlight = false;

export class ShareValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareValidationError";
  }
}

export class SharePreparationError extends Error {
  readonly imageIndex: number;
  readonly reason:
    | "download"
    | "host"
    | "mime"
    | "size"
    | "conversion";

  constructor(
    imageIndex: number,
    reason: SharePreparationError["reason"],
    message: string,
  ) {
    super(`第 ${imageIndex} 张图片${message}`);
    this.name = "SharePreparationError";
    this.imageIndex = imageIndex;
    this.reason = reason;
  }
}

export function normalizeXiaohongshuTags(tags: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawTag of tags) {
    const tag = rawTag.trim().replace(/^#+/, "").trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }

  return normalized;
}

export function buildXiaohongshuPostText(
  title: string,
  body: string,
  tags: string[],
) {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (!cleanTitle) throw new ShareValidationError("标题不能为空。");
  if (!cleanBody) throw new ShareValidationError("正文不能为空。");

  const tagLine = normalizeXiaohongshuTags(tags)
    .map((tag) => `#${tag}`)
    .join(" ");

  return [cleanTitle, cleanBody, tagLine].filter(Boolean).join("\n\n");
}

export function isAllowedImageUrl(
  rawUrl: string,
  allowedHosts: string[] = [],
  baseUrl = getDefaultBaseUrl(),
) {
  try {
    const base = new URL(baseUrl);
    const url = new URL(rawUrl, base);
    if (url.username || url.password) return false;
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.origin === base.origin) return true;
    if (url.protocol !== "https:") return false;
    const normalizedHosts = new Set(
      allowedHosts.map((host) => host.trim().toLowerCase()).filter(Boolean),
    );
    return normalizedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function prepareShareFiles(
  imageUrls: string[],
  options: PrepareShareFilesOptions = {},
) {
  const maxFiles = options.maxFiles ?? 9;
  if (imageUrls.length === 0) {
    throw new ShareValidationError("请至少选择一张图片。");
  }
  if (imageUrls.length > maxFiles) {
    throw new ShareValidationError(`最多只能准备 ${maxFiles} 张图片。`);
  }

  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl = options.baseUrl ?? getDefaultBaseUrl();
  const maxFileBytes =
    options.maxFileBytes ?? DEFAULT_MAX_SHARE_IMAGE_BYTES;
  const maxTotalBytes =
    options.maxTotalBytes ?? DEFAULT_MAX_SHARE_TOTAL_BYTES;
  const files: File[] = [];
  let totalBytes = 0;

  for (const [index, rawUrl] of imageUrls.entries()) {
    const imageIndex = index + 1;
    options.onProgress?.({ current: imageIndex, total: imageUrls.length });

    if (!isAllowedImageUrl(rawUrl, options.allowedHosts, baseUrl)) {
      throw new SharePreparationError(
        imageIndex,
        "host",
        "地址不在允许的图片域名内。",
      );
    }

    let response: Response;
    try {
      response = await fetchFn(new URL(rawUrl, baseUrl), {
        credentials: "same-origin",
        redirect: "follow",
      });
    } catch {
      throw new SharePreparationError(imageIndex, "download", "下载失败。");
    }

    if (!response.ok) {
      throw new SharePreparationError(
        imageIndex,
        "download",
        `下载失败（HTTP ${response.status}）。`,
      );
    }
    if (
      response.url &&
      !isAllowedImageUrl(response.url, options.allowedHosts, baseUrl)
    ) {
      throw new SharePreparationError(
        imageIndex,
        "host",
        "下载被重定向到未批准的域名。",
      );
    }

    const declaredLength = Number(
      response.headers.get("content-length") ?? 0,
    );
    if (declaredLength > maxFileBytes) {
      throw new SharePreparationError(imageIndex, "size", "超过大小限制。");
    }

    let blob = await response.blob();
    if (blob.size > maxFileBytes) {
      throw new SharePreparationError(imageIndex, "size", "超过大小限制。");
    }

    let mimeType = normalizeMimeType(
      response.headers.get("content-type") || blob.type,
    );
    if (!DIRECT_SHARE_MIME_TYPES.has(mimeType)) {
      if (!mimeType.startsWith("image/")) {
        throw new SharePreparationError(
          imageIndex,
          "mime",
          "不是支持的图片类型。",
        );
      }
      try {
        blob = await (options.convertToJpeg ?? convertBlobToJpeg)(blob);
        mimeType = "image/jpeg";
      } catch {
        throw new SharePreparationError(
          imageIndex,
          "conversion",
          "格式无法转换为可分享的 JPEG。",
        );
      }
    }

    totalBytes += blob.size;
    if (totalBytes > maxTotalBytes) {
      throw new SharePreparationError(
        imageIndex,
        "size",
        "使全部图片超过总大小限制。",
      );
    }

    const extension =
      mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : "jpg";
    files.push(
      new File(
        [blob],
        `xhs-${String(imageIndex).padStart(2, "0")}.${extension}`,
        { type: mimeType },
      ),
    );
  }

  return files;
}

export function detectShareCapabilities(
  navigatorLike: ShareNavigator | undefined = getDefaultNavigator(),
  files: File[] = [],
): ShareCapabilities {
  const userAgent = navigatorLike?.userAgent ?? "";
  const hasNavigatorShare = typeof navigatorLike?.share === "function";
  const hasNavigatorCanShare = typeof navigatorLike?.canShare === "function";
  let canShareFiles = false;

  if (hasNavigatorShare && hasNavigatorCanShare && files.length > 0) {
    try {
      canShareFiles = Boolean(navigatorLike.canShare?.({ files }));
    } catch {
      canShareFiles = false;
    }
  }

  const isIOS = /iPad|iPhone|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isWeChatBrowser = /MicroMessenger/i.test(userAgent);
  const isEmbeddedBrowser =
    isWeChatBrowser ||
    /(?:\bwv\b|;\s*wv\)|MQQBrowser|QQ\/|AlipayClient|DingTalk|Weibo|BytedanceWebview)/i.test(
      userAgent,
    );
  const isMobile = isIOS || isAndroid || /Mobile/i.test(userAgent);

  return {
    userAgent,
    hasNavigatorShare,
    hasNavigatorCanShare,
    canShareFiles,
    hasClipboard:
      typeof navigatorLike?.clipboard?.writeText === "function",
    isIOS,
    isAndroid,
    isWeChatBrowser,
    isEmbeddedBrowser,
    isMobile,
  };
}

export function supportsFileShare(
  navigatorLike: ShareNavigator,
  files: File[],
) {
  return detectShareCapabilities(navigatorLike, files).canShareFiles;
}

export function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export async function copyTextWithFallback(
  text: string,
  options: {
    navigatorLike?: ShareNavigator;
    documentLike?: Document;
    legacyCopy?: (value: string) => boolean;
  } = {},
) {
  const navigatorLike = options.navigatorLike ?? getDefaultNavigator();
  try {
    if (typeof navigatorLike?.clipboard?.writeText === "function") {
      await navigatorLike.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continue to the user-gesture-compatible legacy copy path.
  }

  if (options.legacyCopy) {
    try {
      return options.legacyCopy(text);
    } catch {
      return false;
    }
  }

  const documentLike =
    options.documentLike ??
    (typeof document === "undefined" ? undefined : document);
  if (!documentLike?.body) return false;

  const textarea = documentLike.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  documentLike.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return documentLike.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export async function oneTapPublishToXiaohongshu(
  input: XiaohongshuShareInput,
  options: OneTapShareOptions = {},
): Promise<XiaohongshuShareResult> {
  const emit = (
    name: ShareEventName,
    details: Pick<ShareEvent, "method" | "reason"> = {},
  ) => {
    options.onEvent?.({
      name,
      campaignSlug: input.campaignSlug,
      generationId: input.generationId,
      timestamp: new Date().toISOString(),
      ...details,
    });
  };
  const fallback = (
    reason: XiaohongshuFallbackReason,
  ): XiaohongshuShareResult => {
    options.onStatus?.("fallback");
    emit("fallback_used", { reason });
    return { status: "fallback", reason };
  };

  if (shareInFlight) return fallback("unknown");
  shareInFlight = true;

  try {
    if (options.emitStartedEvent !== false) emit("share_started");
    options.onStatus?.("checking");

    const fullPost = buildXiaohongshuPostText(
      input.title,
      input.body,
      input.tags,
    );
    if (input.imageUrls.length === 0) {
      throw new ShareValidationError("请至少选择一张图片。");
    }

    const navigatorLike =
      options.navigatorLike ?? getDefaultNavigator();
    const initialCapabilities = detectShareCapabilities(navigatorLike);
    if (initialCapabilities.isEmbeddedBrowser) {
      options.onStatus?.("copying-text");
      const copied = await copyTextWithFallback(fullPost, {
        navigatorLike,
        documentLike: options.documentLike,
        legacyCopy: options.legacyCopy,
      });
      if (!copied) options.onClipboardFailure?.();
      return fallback(
        initialCapabilities.isWeChatBrowser
          ? "wechat-browser"
          : "embedded-browser",
      );
    }

    let files = options.preparedFiles;
    if (!files) {
      options.onStatus?.("preparing-files", {
        current: 0,
        total: input.imageUrls.length,
      });
      try {
        files = await prepareShareFiles(input.imageUrls, {
          ...options,
          onProgress: (progress) => {
            options.onProgress?.(progress);
            options.onStatus?.("preparing-files", progress);
          },
        });
        emit("share_files_prepared");
      } catch {
        emit("share_failed", { reason: "image-prepare-failed" });
        return fallback("image-prepare-failed");
      }
    }

    const capabilities = detectShareCapabilities(navigatorLike, files);
    const share = navigatorLike?.share;
    if (!capabilities.hasNavigatorShare || typeof share !== "function") {
      options.onStatus?.("copying-text");
      const copied = await copyTextWithFallback(fullPost, {
        navigatorLike,
        documentLike: options.documentLike,
        legacyCopy: options.legacyCopy,
      });
      if (!copied) options.onClipboardFailure?.();
      return fallback(copied ? "share-unsupported" : "clipboard-failed");
    }

    if (capabilities.isAndroid && capabilities.canShareFiles) {
      options.onStatus?.("copying-text");
      const copyPromise = copyTextWithFallback(fullPost, {
        navigatorLike,
        documentLike: options.documentLike,
        legacyCopy: options.legacyCopy,
      });
      options.onStatus?.("opening-share-menu");
      emit("share_menu_opened", { method: "files-only" });
      try {
        const sharePromise = share.call(navigatorLike, { files });
        const copied = await copyPromise;
        if (!copied) options.onClipboardFailure?.();
        await sharePromise;
      } catch (error) {
        const copied = await copyPromise;
        if (!copied) options.onClipboardFailure?.();
        if (isAbortError(error)) {
          options.onStatus?.("cancelled");
          emit("share_cancelled");
          return { status: "cancelled" };
        }
        emit("share_failed", { reason: "unknown" });
        return fallback("unknown");
      }
      options.onStatus?.("completed");
      emit("share_completed", { method: "files-only" });
      return { status: "shared", method: "files-only" };
    }

    options.onStatus?.("copying-text");
    const copied = await copyTextWithFallback(fullPost, {
      navigatorLike,
      documentLike: options.documentLike,
      legacyCopy: options.legacyCopy,
    });
    if (!copied) options.onClipboardFailure?.();

    options.onStatus?.("opening-share-menu");
    if (capabilities.canShareFiles) {
      emit("share_menu_opened", { method: "files-and-text" });
      try {
        await share.call(navigatorLike, {
          title: input.title.trim(),
          text: fullPost,
          files,
        });
      } catch (error) {
        if (isAbortError(error)) {
          options.onStatus?.("cancelled");
          emit("share_cancelled");
          return { status: "cancelled" };
        }
        emit("share_failed", { reason: "unknown" });
        return fallback("unknown");
      }
      options.onStatus?.("completed");
      emit("share_completed", { method: "files-and-text" });
      return { status: "shared", method: "files-and-text" };
    }

    emit("fallback_used", { reason: "file-share-unsupported" });
    emit("share_menu_opened", { method: "text-only" });
    try {
      await share.call(navigatorLike, {
        title: input.title.trim(),
        text: fullPost,
      });
    } catch (error) {
      if (isAbortError(error)) {
        options.onStatus?.("cancelled");
        emit("share_cancelled");
        return { status: "cancelled" };
      }
      emit("share_failed", { reason: "file-share-unsupported" });
      return fallback("file-share-unsupported");
    }
    options.onStatus?.("completed");
    emit("share_completed", { method: "text-only" });
    return { status: "shared", method: "text-only" };
  } catch {
    emit("share_failed", { reason: "unknown" });
    return fallback("unknown");
  } finally {
    shareInFlight = false;
  }
}

async function convertBlobToJpeg(blob: Blob) {
  if (
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  ) {
    throw new Error("Image conversion is unavailable.");
  }
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Canvas is unavailable.");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (converted) =>
        converted
          ? resolve(converted)
          : reject(new Error("JPEG conversion failed.")),
      "image/jpeg",
      0.92,
    );
  });
}

function normalizeMimeType(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

function getDefaultBaseUrl() {
  return typeof window === "undefined"
    ? "https://rednote.local"
    : window.location.href;
}

function getDefaultNavigator(): ShareNavigator | undefined {
  return typeof navigator === "undefined" ? undefined : navigator;
}
