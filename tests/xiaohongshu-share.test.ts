import { describe, expect, it, vi } from "vitest";
import {
  SharePreparationError,
  ShareValidationError,
  buildXiaohongshuPostText,
  copyTextWithFallback,
  detectShareCapabilities,
  isAbortError,
  isAllowedImageUrl,
  normalizeXiaohongshuTags,
  oneTapPublishToXiaohongshu,
  prepareShareFiles,
} from "@/lib/share/xiaohongshu";

const baseUrl = "https://studio.example.com/p/campaign";

function imageResponse(
  content: string,
  type = "image/jpeg",
  headers: Record<string, string> = {},
) {
  return new Response(new Blob([content], { type }), {
    status: 200,
    headers: { "Content-Type": type, ...headers },
  });
}

function shareInput() {
  return {
    title: " 测试标题 ",
    body: " 测试正文 ",
    tags: ["空间", "#生活"],
    imageUrls: ["/api/assets/one/download"],
    campaignSlug: "campaign",
    generationId: "generation",
  };
}

function preparedFile(name = "xhs-01.jpg") {
  return new File(["image"], name, { type: "image/jpeg" });
}

const workingClipboard = {
  writeText: vi.fn(async () => undefined),
} as unknown as Clipboard;

describe("buildXiaohongshuPostText", () => {
  it("trims content and combines title, body and stable tags once", () => {
    expect(
      buildXiaohongshuPostText(
        "  标题  ",
        "  正文内容  ",
        [" #家居 ", "家居", " 生活 ", "##灵感", ""],
      ),
    ).toBe("标题\n\n正文内容\n\n#家居 #生活 #灵感");
  });

  it("cleans hashes, removes duplicates and preserves first-seen order", () => {
    expect(
      normalizeXiaohongshuTags([
        "##第二",
        "第一",
        "#第二",
        " 第三 ",
      ]),
    ).toEqual(["第二", "第一", "第三"]);
  });

  it("rejects empty title or body", () => {
    expect(() => buildXiaohongshuPostText(" ", "正文", [])).toThrow(
      ShareValidationError,
    );
    expect(() => buildXiaohongshuPostText("标题", " ", [])).toThrow(
      ShareValidationError,
    );
  });
});

describe("prepareShareFiles", () => {
  it("keeps URL order and creates ordered filenames", async () => {
    const files = await prepareShareFiles(
      ["/third", "/first", "/second"],
      {
        baseUrl,
        fetchFn: async (input) =>
          imageResponse(
            new URL(
              input instanceof Request ? input.url : String(input),
            ).pathname,
            "image/jpeg",
          ),
      },
    );

    expect(files.map((file) => file.name)).toEqual([
      "xhs-01.jpg",
      "xhs-02.jpg",
      "xhs-03.jpg",
    ]);
    expect(await Promise.all(files.map((file) => file.text()))).toEqual([
      "/third",
      "/first",
      "/second",
    ]);
  });

  it("keeps supported PNG and WebP extensions", async () => {
    const responses = [
      imageResponse("png", "image/png"),
      imageResponse("webp", "image/webp"),
    ];
    const files = await prepareShareFiles(["/one", "/two"], {
      baseUrl,
      fetchFn: async () => responses.shift() as Response,
    });
    expect(files.map((file) => file.name)).toEqual([
      "xhs-01.png",
      "xhs-02.webp",
    ]);
  });

  it("reports the exact failing image and never silently skips it", async () => {
    await expect(
      prepareShareFiles(["/one", "/two"], {
        baseUrl,
        fetchFn: async (input) =>
          new URL(
            input instanceof Request ? input.url : String(input),
          ).pathname === "/one"
            ? imageResponse("one")
            : new Response(null, { status: 404 }),
      }),
    ).rejects.toMatchObject({
      imageIndex: 2,
      reason: "download",
    } satisfies Partial<SharePreparationError>);
  });

  it("enforces per-file size and maximum image count", async () => {
    await expect(
      prepareShareFiles(["/large"], {
        baseUrl,
        maxFileBytes: 4,
        fetchFn: async () =>
          imageResponse("12345", "image/jpeg", {
            "Content-Length": "5",
          }),
      }),
    ).rejects.toMatchObject({ imageIndex: 1, reason: "size" });
    await expect(
      prepareShareFiles(["/one", "/two"], {
        baseUrl,
        maxFiles: 1,
      }),
    ).rejects.toBeInstanceOf(ShareValidationError);
  });

  it("rejects unsupported non-image MIME types", async () => {
    await expect(
      prepareShareFiles(["/plain"], {
        baseUrl,
        fetchFn: async () => imageResponse("text", "text/plain"),
      }),
    ).rejects.toMatchObject({ imageIndex: 1, reason: "mime" });
  });

  it("reports progress in input order", async () => {
    const progress: string[] = [];
    await prepareShareFiles(["/one", "/two", "/three"], {
      baseUrl,
      fetchFn: async () => imageResponse("image"),
      onProgress: ({ current, total }) =>
        progress.push(`${current}/${total}`),
    });
    expect(progress).toEqual(["1/3", "2/3", "3/3"]);
  });
});

describe("image URL allowlist", () => {
  it("allows same-origin routes and explicitly approved HTTPS hosts", () => {
    expect(
      isAllowedImageUrl("/api/assets/id/download", [], baseUrl),
    ).toBe(true);
    expect(
      isAllowedImageUrl(
        "https://project.supabase.co/storage/image.jpg",
        ["project.supabase.co"],
        baseUrl,
      ),
    ).toBe(true);
  });

  it("blocks lookalike, credentialed and insecure cross-origin URLs", () => {
    expect(
      isAllowedImageUrl(
        "https://project.supabase.co.evil.test/image.jpg",
        ["project.supabase.co"],
        baseUrl,
      ),
    ).toBe(false);
    expect(
      isAllowedImageUrl(
        "https://user:secret@project.supabase.co/image.jpg",
        ["project.supabase.co"],
        baseUrl,
      ),
    ).toBe(false);
    expect(
      isAllowedImageUrl(
        "http://project.supabase.co/image.jpg",
        ["project.supabase.co"],
        baseUrl,
      ),
    ).toBe(false);
  });
});

describe("share capability and environment detection", () => {
  it("detects file sharing only after canShare accepts the files", () => {
    const files = [preparedFile()];
    expect(
      detectShareCapabilities(
        {
          share: vi.fn(async () => undefined),
          canShare: vi.fn(() => true),
        },
        files,
      ).canShareFiles,
    ).toBe(true);
    expect(
      detectShareCapabilities(
        {
          share: vi.fn(async () => undefined),
          canShare: vi.fn(() => false),
        },
        files,
      ).canShareFiles,
    ).toBe(false);
  });

  it("detects iOS, Android, WeChat and mobile environments", () => {
    const ios = detectShareCapabilities({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile",
    });
    const androidWechat = detectShareCapabilities({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15) Mobile MicroMessenger/8.0",
    });
    expect(ios).toMatchObject({
      isIOS: true,
      isAndroid: false,
      isMobile: true,
    });
    expect(androidWechat).toMatchObject({
      isIOS: false,
      isAndroid: true,
      isWeChatBrowser: true,
      isEmbeddedBrowser: true,
      isMobile: true,
    });
  });

  it("detects Android app webviews that should hand off to Chrome", () => {
    const androidWebview = detectShareCapabilities({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/124 Mobile Safari/537.36",
    });
    expect(androidWebview).toMatchObject({
      isAndroid: true,
      isWeChatBrowser: false,
      isEmbeddedBrowser: true,
      isMobile: true,
    });
  });
});

describe("clipboard and share results", () => {
  it("uses the legacy clipboard fallback after Clipboard API failure", async () => {
    const legacyCopy = vi.fn(() => true);
    await expect(
      copyTextWithFallback("完整帖子", {
        navigatorLike: {
          clipboard: {
            writeText: vi.fn(async () => {
              throw new Error("Permission denied");
            }),
          } as unknown as Clipboard,
        },
        legacyCopy,
      }),
    ).resolves.toBe(true);
    expect(legacyCopy).toHaveBeenCalledWith("完整帖子");
  });

  it("recognizes AbortError without treating it as a technical failure", () => {
    expect(isAbortError(new DOMException("cancel", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("network"))).toBe(false);
  });

  it("returns cancelled and records cancellation when the user closes share", async () => {
    const events: string[] = [];
    const result = await oneTapPublishToXiaohongshu(shareInput(), {
      preparedFiles: [preparedFile()],
      navigatorLike: {
        clipboard: workingClipboard,
        share: vi.fn(async () => {
          throw new DOMException("cancel", "AbortError");
        }),
        canShare: vi.fn(() => true),
      },
      onEvent: (event) => events.push(event.name),
    });
    expect(result).toEqual({ status: "cancelled" });
    expect(events).toContain("share_cancelled");
    expect(events).not.toContain("xiaohongshu_published");
  });

  it("falls back to text-only share when file sharing is unsupported", async () => {
    const share = vi.fn(async (data?: ShareData) => {
      void data;
    });
    const result = await oneTapPublishToXiaohongshu(shareInput(), {
      preparedFiles: [preparedFile()],
      navigatorLike: {
        clipboard: workingClipboard,
        share,
        canShare: vi.fn(() => false),
      },
    });
    expect(result).toEqual({ status: "shared", method: "text-only" });
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "测试标题",
        text: expect.stringContaining("#空间 #生活"),
      }),
    );
    expect(share.mock.calls[0]?.[0]).not.toHaveProperty("files");
  });

  it("returns a safe fallback when Web Share is unavailable", async () => {
    const result = await oneTapPublishToXiaohongshu(shareInput(), {
      preparedFiles: [preparedFile()],
      navigatorLike: { clipboard: workingClipboard },
    });
    expect(result).toEqual({
      status: "fallback",
      reason: "share-unsupported",
    });
  });

  it("does not start concurrent shares after a repeated click", async () => {
    let releaseShare: () => void = () => undefined;
    const pendingShare = new Promise<void>((resolve) => {
      releaseShare = () => resolve();
    });
    const share = vi.fn(() => pendingShare);
    const first = oneTapPublishToXiaohongshu(shareInput(), {
      preparedFiles: [preparedFile()],
      navigatorLike: {
        clipboard: workingClipboard,
        share,
        canShare: vi.fn(() => true),
      },
    });
    const second = await oneTapPublishToXiaohongshu(shareInput(), {
      preparedFiles: [preparedFile()],
      navigatorLike: {
        clipboard: workingClipboard,
        share,
        canShare: vi.fn(() => true),
      },
    });
    releaseShare();
    await first;
    expect(second).toEqual({ status: "fallback", reason: "unknown" });
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("records webpage share events without claiming publication", async () => {
    const events: string[] = [];
    const result = await oneTapPublishToXiaohongshu(shareInput(), {
      preparedFiles: [preparedFile()],
      navigatorLike: {
        clipboard: workingClipboard,
        share: vi.fn(async () => undefined),
        canShare: vi.fn(() => true),
      },
      onEvent: (event) => events.push(event.name),
    });
    expect(result).toEqual({
      status: "shared",
      method: "files-and-text",
    });
    expect(events).toEqual([
      "share_started",
      "share_menu_opened",
      "share_completed",
    ]);
    expect(events).not.toContain("xiaohongshu_published");
  });

  it("shares image files only on Android and copies the full post in parallel", async () => {
    let finishClipboard: (value: void) => void = () => undefined;
    const clipboardPending = new Promise<void>((resolve) => {
      finishClipboard = resolve;
    });
    const share = vi.fn(async (data?: ShareData) => {
      void data;
    });
    const resultPromise = oneTapPublishToXiaohongshu(shareInput(), {
      preparedFiles: [preparedFile()],
      navigatorLike: {
        userAgent:
          "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36",
        clipboard: {
          writeText: vi.fn(() => clipboardPending),
        } as unknown as Clipboard,
        share,
        canShare: vi.fn(() => true),
      },
    });

    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share).toHaveBeenCalledWith({
      files: [expect.objectContaining({ name: "xhs-01.jpg" })],
    });
    expect(share.mock.calls[0]?.[0]).not.toHaveProperty("title");
    expect(share.mock.calls[0]?.[0]).not.toHaveProperty("text");

    finishClipboard();
    await expect(resultPromise).resolves.toEqual({
      status: "shared",
      method: "files-only",
    });
  });

  it("uses the dedicated WeChat fallback instead of claiming file sharing", async () => {
    const result = await oneTapPublishToXiaohongshu(shareInput(), {
      preparedFiles: [preparedFile()],
      navigatorLike: {
        userAgent:
          "Mozilla/5.0 (iPhone) Mobile MicroMessenger/8.0",
        clipboard: workingClipboard,
        share: vi.fn(async () => undefined),
        canShare: vi.fn(() => true),
      },
    });
    expect(result).toEqual({
      status: "fallback",
      reason: "wechat-browser",
    });
  });

  it("does not call Web Share inside an Android app webview", async () => {
    const share = vi.fn(async () => undefined);
    const result = await oneTapPublishToXiaohongshu(shareInput(), {
      preparedFiles: [preparedFile()],
      navigatorLike: {
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Mobile",
        clipboard: workingClipboard,
        share,
        canShare: vi.fn(() => true),
      },
    });
    expect(result).toEqual({
      status: "fallback",
      reason: "embedded-browser",
    });
    expect(share).not.toHaveBeenCalled();
  });
});
