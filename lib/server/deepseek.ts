import "server-only";

import OpenAI from "openai";
import { getServerEnv, isDemoMode } from "@/lib/config";
import { generateDemoPost } from "@/lib/demo-data";
import { generatedPostSchema, type GenerateRequest } from "@/lib/schemas";
import { normalizeGeneratedPost } from "@/lib/utils";
import type { Asset, Campaign, GeneratedPost } from "@/types/database";

function buildPrompt(campaign: Campaign, assets: Asset[], input: GenerateRequest) {
  return JSON.stringify(
    {
      task: "为普通用户生成一篇可编辑、可复制的小红书帖子草稿，并只返回 JSON。",
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
      outputFormat: {
        titleOptions: ["标题一", "标题二", "标题三"],
        selectedTitle: "标题一",
        body: "正文",
        tags: ["标签一", "标签二", "标签三"],
        fullPost: "标题一\n\n正文\n\n#标签一 #标签二 #标签三",
      },
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
  if (!env.DEEPSEEK_API_KEY) {
    if (isDemoMode()) {
      return normalizeGeneratedPost(generateDemoPost(campaign, input, assets));
    }
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const deepseek = new OpenAI({
    apiKey: env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
  const response = await deepseek.chat.completions.create({
    model: env.DEEPSEEK_MODEL,
    store: false,
    stream: false,
    max_tokens: 2400,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "你是品牌内容编辑。严格基于给定事实写中文小红书草稿，遵守所有合规约束，并只返回符合示例结构的 JSON 对象。",
      },
      { role: "user", content: buildPrompt(campaign, assets, input) },
    ],
  }, {
    body: { thinking: { type: "disabled" } },
  });

  const content = response.choices[0]?.message.content?.trim();
  if (!content) {
    throw new Error("DeepSeek did not return any content.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("DeepSeek returned invalid JSON.");
  }

  const parsed = generatedPostSchema.parse(parsedJson);
  if (!parsed.titleOptions.includes(parsed.selectedTitle)) {
    throw new Error("DeepSeek selected a title outside titleOptions.");
  }
  return normalizeGeneratedPost(parsed as GeneratedPost);
}
