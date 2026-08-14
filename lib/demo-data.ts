import type {
  Asset,
  Campaign,
  CampaignWithAssets,
  FastPublishEvent,
  GeneratedPost,
  Generation,
  PublishJob,
} from "@/types/database";
import type { GenerateRequest } from "@/lib/schemas";
import { composeFullPost } from "@/lib/utils";

const now = "2026-07-31T00:00:00.000Z";

export const demoCampaign: Campaign = {
  id: "0f10db5e-19ac-4a4a-a227-5055fe79db2c",
  slug: "soft-living",
  name: "Soft Living 冬日生活灵感",
  brand_name: "Mori Living",
  product_name: "云感休闲椅",
  product_description:
    "一款适合客厅与阅读角的浅米色休闲椅，强调柔和轮廓、轻盈视觉与日常空间搭配。",
  brand_guide: "像朋友分享新发现一样自然；具体、克制、有生活画面，避免夸张销售感。",
  default_tone: "自然、松弛、有画面感",
  default_keywords: ["冬日家居", "阅读角", "松弛感"],
  prohibited_phrases: ["全网第一", "绝对必买", "零缺点", "治愈一切"],
  allowed_post_types: ["真实体验", "产品推荐", "空间灵感", "到店打卡", "新品介绍", "活动分享"],
  max_image_count: 6,
  fast_publish_enabled: true,
  fast_publish_images: [
    "a9df49b2-cbb7-46bd-9d84-228c66aa6750",
    "c3fc36cb-7a10-45ed-9e29-77996ab92cf0",
    "275ec9a7-7d43-49dd-a523-5da7be62f4c5",
  ],
  fast_publish_content: {
    title: "把松弛感搬进家里的阅读角",
    body:
      "最近很喜欢这种克制又柔和的空间感。浅色休闲椅搭配自然光、木质和低饱和织物，不会抢走空间里的注意力，却能让阅读角多一点舒服的层次。\n\n这组搭配更适合慢下来坐一会儿，也给日常留出一点呼吸感。以上内容只基于现场可见信息与品牌提供的产品说明。",
    tags: ["冬日家居", "阅读角", "松弛感", "家居灵感"],
  },
  status: "active",
  created_at: now,
  updated_at: now,
};

export const demoAssets: Asset[] = [
  {
    id: "a9df49b2-cbb7-46bd-9d84-228c66aa6750",
    campaign_id: demoCampaign.id,
    file_url: "/demo/reading-chair.jpg",
    storage_path: "demo/reading-chair.jpg",
    thumbnail_url: null,
    name: "阅读角全景",
    description: "自然光下的浅色休闲椅与安静阅读角。",
    category: "空间",
    keywords: ["自然光", "阅读角", "米色"],
    sort_order: 1,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: "c3fc36cb-7a10-45ed-9e29-77996ab92cf0",
    campaign_id: demoCampaign.id,
    file_url: "/demo/soft-room.jpg",
    storage_path: "demo/soft-room.jpg",
    thumbnail_url: null,
    name: "柔和空间",
    description: "暖色织物与木质元素组成的松弛居家氛围。",
    category: "氛围",
    keywords: ["暖色", "木质", "松弛"],
    sort_order: 2,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: "275ec9a7-7d43-49dd-a523-5da7be62f4c5",
    campaign_id: demoCampaign.id,
    file_url: "/demo/detail.jpg",
    storage_path: "demo/detail.jpg",
    thumbnail_url: null,
    name: "空间细节",
    description: "简洁线条、绿植与柔和光影的搭配细节。",
    category: "细节",
    keywords: ["绿植", "线条", "光影"],
    sort_order: 3,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: "af7f30e2-84d5-4fce-9be3-aebfe22ea24e",
    campaign_id: demoCampaign.id,
    file_url: "/demo/home.jpg",
    storage_path: "demo/home.jpg",
    thumbnail_url: null,
    name: "居家场景",
    description: "通透、克制的现代居家场景。",
    category: "空间",
    keywords: ["现代", "通透", "居家"],
    sort_order: 4,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
];

export function getDemoCampaignWithAssets(): CampaignWithAssets {
  return { ...demoCampaign, assets: demoAssets.map((asset) => ({ ...asset })) };
}

export function generateDemoPost(
  campaign: Campaign,
  input: GenerateRequest,
  assets: Asset[],
): GeneratedPost {
  const location = input.location ? `在${input.location}看到它时，` : "";
  const detail = (assets[0]?.description || campaign.product_description).replace(
    /[。！？!?，,；;]+$/,
    "",
  );
  const titleOptions: [string, string, string] = [
    `把松弛感搬进家里｜${campaign.product_name}`,
    `最近很喜欢的阅读角小变化`,
    `${campaign.brand_name} 的温柔空间灵感`,
  ];
  const body = `${location}第一眼喜欢的是它克制又柔和的轮廓。${detail}，放进日常空间里不会抢戏，却能让阅读角多一点舒服的层次。\n\n这次更想分享的是搭配思路：用自然光、木质和低饱和织物做背景，再留一点呼吸感。${input.userNotes ? `我特别留意了${input.userNotes}。` : ""}\n\n以上内容只基于现场可见信息与 Campaign 提供的产品说明，没有代替真实使用体验。`;
  const tags = [
    campaign.brand_name,
    campaign.product_name,
    ...campaign.default_keywords,
    input.postType,
    "家居灵感",
  ].slice(0, 8);
  return {
    titleOptions,
    selectedTitle: titleOptions[0],
    body,
    tags,
    fullPost: composeFullPost(titleOptions[0], body, tags),
  };
}

type DemoStore = {
  campaigns: Campaign[];
  assets: Asset[];
  generations: Generation[];
  publishJobs: PublishJob[];
  fastPublishEvents: FastPublishEvent[];
};

declare global {
  var __rednoteDemoStore: DemoStore | undefined;
}

export function getDemoStore(): DemoStore {
  globalThis.__rednoteDemoStore ??= {
    campaigns: [{ ...demoCampaign }],
    assets: demoAssets.map((asset) => ({ ...asset })),
    generations: [],
    publishJobs: [],
    fastPublishEvents: [],
  };
  return globalThis.__rednoteDemoStore;
}
