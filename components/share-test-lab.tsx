"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FlaskConical, Play } from "lucide-react";
import Link from "next/link";
import {
  copyTextWithFallback,
  detectShareCapabilities,
  isAbortError,
  oneTapPublishToXiaohongshu,
  prepareShareFiles,
  type ShareCapabilities,
  type ShareEventName,
} from "@/lib/share/xiaohongshu";

const scenarios = [
  ["share-1", "分享 1 张图片"],
  ["share-3", "分享 3 张图片"],
  ["share-6", "分享 6 张图片"],
  ["share-9", "分享 9 张图片"],
  ["text-only", "只分享文字"],
  ["invalid-url", "图片地址失效"],
  ["invalid-mime", "图片 MIME 类型不支持"],
  ["oversized", "图片过大"],
  ["clipboard-failed", "剪贴板权限失败"],
  ["share-unsupported", "不支持 navigator.share"],
  ["file-share-unsupported", "不支持文件分享"],
  ["cancelled", "用户取消分享"],
  ["wechat", "微信内置浏览器提示"],
  ["duplicate", "重复点击按钮"],
  ["order", "图片顺序验证"],
  ["events", "share 状态记录"],
] as const;

type ScenarioId = (typeof scenarios)[number][0];

const emptyCapabilities: ShareCapabilities = {
  userAgent: "",
  hasNavigatorShare: false,
  hasNavigatorCanShare: false,
  canShareFiles: false,
  hasClipboard: false,
  isIOS: false,
  isAndroid: false,
  isWeChatBrowser: false,
  isEmbeddedBrowser: false,
  isMobile: false,
};

export function ShareTestLab() {
  const [capabilities, setCapabilities] =
    useState<ShareCapabilities>(emptyCapabilities);
  const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(
    null,
  );
  const [result, setResult] = useState<unknown>({
    message: "选择一个场景运行。所有场景均使用本地模拟数据，不依赖 OpenAI。",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const testFile = new File(["test"], "xhs-01.jpg", {
        type: "image/jpeg",
      });
      setCapabilities(detectShareCapabilities(navigator, [testFile]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function runScenario(id: ScenarioId) {
    setActiveScenario(id);
    try {
      setResult(await executeScenario(id));
    } catch (caught) {
      setResult({
        error: caught instanceof Error ? caught.message : "未知错误",
      });
    } finally {
      setActiveScenario(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbf8f4] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          className="button-ghost !px-0"
          href="/p/soft-living"
        >
          <ArrowLeft size={16} /> 返回扫码页
        </Link>
        <div className="mt-5 flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f9e3e0] text-[#d9453b]">
            <FlaskConical size={23} />
          </span>
          <div>
            <p className="eyebrow">DEVELOPMENT ONLY</p>
            <h1 className="mt-1 text-3xl font-black">小红书分享能力测试</h1>
            <p className="mt-2 text-sm leading-6 text-[#746d65]">
              此页面仅在开发环境开放。模拟结果只验证网页逻辑，不代表任何手机或小红书真机行为。
            </p>
          </div>
        </div>

        <section className="surface mt-7 rounded-[26px] p-5">
          <h2 className="font-black">当前设备能力</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#24211e] p-4 text-xs leading-6 text-[#f7eee6]">
            {JSON.stringify(capabilities, null, 2)}
          </pre>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="surface rounded-[26px] p-5">
            <h2 className="font-black">隔离测试场景</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {scenarios.map(([id, label]) => (
                <button
                  className="button-secondary !min-h-11 !justify-between !rounded-2xl !px-4 text-left text-xs"
                  disabled={activeScenario !== null}
                  key={id}
                  onClick={() => void runScenario(id)}
                  type="button"
                >
                  {label}
                  <Play size={13} />
                </button>
              ))}
            </div>
          </section>

          <section className="surface rounded-[26px] p-5">
            <h2 className="font-black">实际返回结果</h2>
            <pre
              aria-live="polite"
              className="mt-4 min-h-72 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-[#f5ecdf] p-4 text-xs leading-6 text-[#504840]"
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </section>
        </div>
      </div>
    </main>
  );
}

async function executeScenario(id: ScenarioId) {
  const preparedFile = new File(["image"], "xhs-01.jpg", {
    type: "image/jpeg",
  });
  const shareInput = {
    title: "测试标题",
    body: "测试正文",
    tags: ["测试"],
    imageUrls: ["/api/assets/test/download"],
    campaignSlug: "share-test",
    generationId: "dev-generation",
  };
  const successfulClipboard = {
    writeText: async () => undefined,
  } as unknown as Clipboard;
  const imageResponse = (label = "image") =>
    new Response(new Blob([label], { type: "image/jpeg" }), {
      status: 200,
      headers: { "Content-Type": "image/jpeg" },
    });

  if (id.startsWith("share-")) {
    const count = Number(id.split("-")[1]);
    const files = await prepareShareFiles(
      Array.from({ length: count }, (_, index) => `/image-${index + 1}`),
      {
        baseUrl: window.location.href,
        maxFiles: 9,
        fetchFn: async (input) => imageResponse(String(input)),
      },
    );
    return {
      prepared: files.length,
      orderedFilenames: files.map((file) => file.name),
      note: "文件已按输入顺序准备；未自动打开真实系统分享菜单。",
    };
  }

  if (id === "invalid-url") {
    return prepareShareFiles(["/missing-image"], {
      baseUrl: window.location.href,
      fetchFn: async () => new Response(null, { status: 404 }),
    });
  }
  if (id === "invalid-mime") {
    return prepareShareFiles(["/not-an-image"], {
      baseUrl: window.location.href,
      fetchFn: async () =>
        new Response("plain text", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
    });
  }
  if (id === "oversized") {
    return prepareShareFiles(["/large-image"], {
      baseUrl: window.location.href,
      maxFileBytes: 4,
      fetchFn: async () =>
        new Response(new Blob(["12345"], { type: "image/jpeg" }), {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": "5",
          },
        }),
    });
  }
  if (id === "clipboard-failed") {
    return {
      copied: await copyTextWithFallback("测试文案", {
        navigatorLike: {
          clipboard: {
            writeText: async () => {
              throw new Error("Permission denied");
            },
          } as unknown as Clipboard,
        },
        legacyCopy: () => false,
      }),
    };
  }
  if (id === "share-unsupported") {
    return detectShareCapabilities({
      userAgent: "Mobile Test Browser",
    });
  }
  if (id === "file-share-unsupported" || id === "text-only") {
    return oneTapPublishToXiaohongshu(shareInput, {
      preparedFiles: [preparedFile],
      navigatorLike: {
        userAgent: "Android Test Browser",
        clipboard: successfulClipboard,
        share: async () => undefined,
        canShare: () => false,
      },
    });
  }
  if (id === "cancelled") {
    const shareResult = await oneTapPublishToXiaohongshu(shareInput, {
      preparedFiles: [preparedFile],
      navigatorLike: {
        userAgent: "iPhone Test Browser",
        clipboard: successfulClipboard,
        share: async () => {
          throw new DOMException("User cancelled", "AbortError");
        },
        canShare: () => true,
      },
    });
    return {
      shareResult,
      abortErrorRecognized: isAbortError(
        new DOMException("User cancelled", "AbortError"),
      ),
    };
  }
  if (id === "wechat") {
    return detectShareCapabilities({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile MicroMessenger/8.0",
    });
  }
  if (id === "order") {
    const files = await prepareShareFiles(
      ["/third", "/first", "/second"],
      {
        baseUrl: window.location.href,
        fetchFn: async (input) =>
          imageResponse(
            new URL(
              input instanceof Request ? input.url : String(input),
            ).pathname,
          ),
      },
    );
    return {
      names: files.map((file) => file.name),
      contents: await Promise.all(files.map((file) => file.text())),
    };
  }
  if (id === "duplicate") {
    let releaseShare: (() => void) | undefined;
    const first = oneTapPublishToXiaohongshu(shareInput, {
      preparedFiles: [preparedFile],
      navigatorLike: {
        clipboard: successfulClipboard,
        share: () =>
          new Promise<void>((resolve) => {
            releaseShare = resolve;
          }),
        canShare: () => true,
      },
    });
    await Promise.resolve();
    const second = await oneTapPublishToXiaohongshu(shareInput, {
      preparedFiles: [preparedFile],
      navigatorLike: {
        clipboard: successfulClipboard,
        share: async () => undefined,
        canShare: () => true,
      },
    });
    while (!releaseShare) await Promise.resolve();
    releaseShare();
    return { first: await first, second };
  }
  if (id === "events") {
    const events: ShareEventName[] = [];
    const shareResult = await oneTapPublishToXiaohongshu(shareInput, {
      preparedFiles: [preparedFile],
      navigatorLike: {
        clipboard: successfulClipboard,
        share: async () => undefined,
        canShare: () => true,
      },
      onEvent: (event) => events.push(event.name),
    });
    return { shareResult, events };
  }

  return { error: "未实现的测试场景" };
}
