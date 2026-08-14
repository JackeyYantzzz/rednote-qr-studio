import { generateRequestSchema } from "@/lib/schemas";
import { checkRateLimit, requestKey } from "@/lib/rate-limit";
import { generatePostWithAI } from "@/lib/server/openai";
import {
  getAssetsByIds,
  getCampaignBySlug,
  saveGeneration,
} from "@/lib/server/repository";
import { jsonError } from "@/lib/utils";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(requestKey(request, "generate"), 8, 60_000);
  if (!rateLimit.ok) {
    return Response.json(
      { error: "生成请求过于频繁，请稍后再试。" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 1000) / 1000)),
        },
      },
    );
  }

  try {
    const input = generateRequestSchema.parse(await request.json());
    const campaign = await getCampaignBySlug(input.campaignSlug, true);
    if (!campaign) return jsonError("Campaign 不存在或已停用。", 404);
    if (!campaign.allowed_post_types.includes(input.postType)) {
      return jsonError("不支持所选帖子类型。", 400);
    }
    if (input.assetIds.length > campaign.max_image_count) {
      return jsonError(`最多选择 ${campaign.max_image_count} 张图片。`, 400);
    }

    const assets = await getAssetsByIds(campaign.id, input.assetIds);
    if (assets.length !== input.assetIds.length) {
      return jsonError("部分图片不存在、已停用或不属于此 Campaign。", 400);
    }

    const post = await generatePostWithAI(campaign, assets, input);
    const generation = await saveGeneration({
      campaignId: campaign.id,
      assetIds: input.assetIds,
      userInput: input,
      generatedContent: post,
    });
    return Response.json({ generationId: generation.id, ...post });
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return jsonError("输入内容不符合要求。", 400, (error as { issues: unknown }).issues);
    }
    console.error("Generation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonError("内容生成失败，请保留当前选择并稍后重试。", 502);
  }
}
