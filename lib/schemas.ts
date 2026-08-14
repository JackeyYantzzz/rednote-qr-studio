import { z } from "zod";

const shortText = (max: number) => z.string().trim().max(max);
const stringList = (maxItems = 20, maxLength = 80) =>
  z.array(shortText(maxLength)).max(maxItems);

const normalizedTagSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((tag) => tag.replace(/^#+/, "").replace(/\s+/g, ""))
  .pipe(z.string().min(1).max(32));

export const fastPublishContentSchema = z.object({
  title: z.string().trim().min(1).max(40),
  body: z.string().trim().min(1).max(2200),
  tags: z
    .array(normalizedTagSchema)
    .min(1)
    .max(12)
    .transform((tags) => [...new Set(tags)]),
});

export const generatedPostSchema = z.object({
  titleOptions: z.array(z.string().trim().min(1).max(40)).length(3),
  selectedTitle: z.string().trim().min(1).max(40),
  body: z.string().trim().min(1).max(2200),
  tags: z.array(z.string().trim().min(1).max(32)).min(3).max(12),
  fullPost: z.string().trim().min(1).max(3000),
});

export const generateRequestSchema = z.object({
  campaignSlug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  assetIds: z.array(z.string().uuid()).min(1).max(12),
  postType: shortText(40).min(1),
  tone: shortText(80).min(1),
  location: shortText(120).default(""),
  userNotes: shortText(600).default(""),
});

const campaignFieldsSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: shortText(100).min(1),
  brand_name: shortText(100).min(1),
  product_name: shortText(120).min(1),
  product_description: shortText(2000),
  brand_guide: shortText(2000),
  default_tone: shortText(120).default("自然、真诚、简洁"),
  default_keywords: stringList(20),
  prohibited_phrases: stringList(30),
  allowed_post_types: stringList(12, 40).min(1),
  max_image_count: z.coerce.number().int().min(1).max(12).default(9),
  fast_publish_enabled: z.boolean().default(false),
  fast_publish_images: z
    .array(z.string().uuid())
    .max(12)
    .refine((ids) => new Set(ids).size === ids.length, "快发图片不能重复。")
    .default([]),
  fast_publish_content: fastPublishContentSchema.nullable().default(null),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const campaignInputSchema = campaignFieldsSchema.superRefine(
  (campaign, context) => {
    if (!campaign.fast_publish_enabled) return;
    if (campaign.fast_publish_images.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["fast_publish_images"],
        message: "启用快发模式前，请至少选择一张图片。",
      });
    }
    if (campaign.fast_publish_images.length > campaign.max_image_count) {
      context.addIssue({
        code: "custom",
        path: ["fast_publish_images"],
        message: "快发图片数量不能超过 Campaign 图片上限。",
      });
    }
    if (!campaign.fast_publish_content) {
      context.addIssue({
        code: "custom",
        path: ["fast_publish_content"],
        message: "启用快发模式前，请填写审核后的帖子内容。",
      });
    }
  },
);

export const campaignPatchSchema = campaignFieldsSchema.partial();

export const assetMetadataSchema = z.object({
  campaign_id: z.string().uuid(),
  name: shortText(120).min(1),
  description: shortText(1000),
  category: shortText(80),
  keywords: stringList(20),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});

export const publishJobInputSchema = z.object({
  generationId: z.string().uuid(),
  title: z.string().trim().min(1).max(20),
  content: z.string().trim().min(1).max(1000),
  tags: z.array(z.string().trim().min(1).max(32)).min(1).max(12),
  imageUrls: z.array(z.string().url()).max(12).default([]),
  visibility: z.enum(["private", "public"]).default("private"),
  scheduleAt: z.string().datetime().nullable().default(null),
  isOriginal: z.boolean().default(true),
});

export const publishJobActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    confirmPublic: z.boolean().default(false),
  }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("retry") }),
]);

export const fastPublishEventInputSchema = z.object({
  campaignSlug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  eventName: z.enum([
    "fast_page_view",
    "fast_share_clicked",
    "fast_share_completed",
    "fast_share_cancelled",
    "fast_share_failed",
  ]),
  sessionId: z.string().uuid(),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;
export type CampaignPatch = z.infer<typeof campaignPatchSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GeneratedPostInput = z.infer<typeof generatedPostSchema>;
