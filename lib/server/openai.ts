import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getServerEnv, isDemoMode } from "@/lib/config";
import { generateDemoPost } from "@/lib/demo-data";
import { generatedPostSchema, type GenerateRequest } from "@/lib/schemas";
import { normalizeGeneratedPost } from "@/lib/utils";
import type { Asset, Campaign, GeneratedPost } from "@/types/database";

function buildPrompt(campaign: Campaign, assets: Asset[], input: GenerateRequest) {
  return JSON.stringify(
    {
      task: "为普通用户生成一篇可编辑、可复制的小红书帖子草稿。",
      campaign: {
        brandName: campaign.brand_name,
        productName: campaign.product_name,
        productDescription: campaign.product_description,
        brandGuide: campaign.brand_guide,
        defaultKeywords: campaign.default_keywords,
        prohibitedPhrases: campaign.prohibited_phrases,
      },
      selectedImages: assets.map((asset) => ({
        name: asset.name,
        description: asset.description,
        category: asset.category,
        keywords: asset.keywords,
        url: asset.file_url,
      })),
      userInput: input,
      constraints: [
        "只能使用 Campaign、图片元数据和用户输入中明确提供的事实。",
        "不得虚构个人体验、产品参数、价格、材质、认证或功效。",
        "不得使用绝对化、误导性表达或禁止词。",
        "如果用户未提供亲身体验，用观察、灵感或期待的表达，不冒充真实体验。",
        "正文自然、具体、克制，不要像机器广告。",
        "标签中不要包含 #，fullPost 中需要自动组合 #标签。",
        "提供恰好 3 个不同标题，selectedTitle 必须等于其中一个。",
      ],
    },
    null,
    2,
  );
}

export async function generatePostWithAI(
  campaign: Campaign,
  assets: Asset[],
  input: GenerateRequest,
): Promise<GeneratedPost> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    if (isDemoMode()) {
      return normalizeGeneratedPost(generateDemoPost(campaign, input, assets));
    }
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: env.OPENAI_MODEL,
    store: false,
    input: [
      {
        role: "system",
        content:
          "你是品牌内容编辑。严格基于给定事实写中文小红书草稿，并遵守所有合规约束。",
      },
      { role: "user", content: buildPrompt(campaign, assets, input) },
    ],
    text: {
      format: zodTextFormat(generatedPostSchema, "generated_xiaohongshu_post"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a structured post.");
  }
  const parsed = generatedPostSchema.parse(response.output_parsed);
  return normalizeGeneratedPost(parsed as GeneratedPost);
}
