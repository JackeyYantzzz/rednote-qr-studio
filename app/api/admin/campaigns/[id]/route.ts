import { assertAdmin } from "@/lib/auth";
import {
  campaignInputSchema,
  campaignPatchSchema,
} from "@/lib/schemas";
import { getCampaignById, updateCampaign } from "@/lib/server/repository";
import { jsonError } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdmin();
    const { id } = await params;
    const campaign = await getCampaignById(id);
    if (!campaign) return jsonError("Campaign not found.", 404);
    return Response.json({ campaign });
  } catch (error) {
    return jsonError(
      error instanceof Error && error.message === "UNAUTHORIZED"
        ? "Unauthorized"
        : "Unable to load campaign.",
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500,
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdmin();
    const { id } = await params;
    const patch = campaignPatchSchema.parse(await request.json());
    if (Object.keys(patch).length === 0) return jsonError("No changes supplied.", 400);
    const existing = await getCampaignById(id);
    if (!existing) return jsonError("Campaign not found.", 404);
    const currentInput = {
      slug: existing.slug,
      name: existing.name,
      brand_name: existing.brand_name,
      product_name: existing.product_name,
      product_description: existing.product_description,
      brand_guide: existing.brand_guide,
      default_tone: existing.default_tone,
      default_keywords: existing.default_keywords,
      prohibited_phrases: existing.prohibited_phrases,
      allowed_post_types: existing.allowed_post_types,
      max_image_count: existing.max_image_count,
      fast_publish_enabled: existing.fast_publish_enabled,
      fast_publish_images: existing.fast_publish_images,
      fast_publish_content: existing.fast_publish_content,
      status: existing.status,
    };
    const input = campaignInputSchema.parse({ ...currentInput, ...patch });
    if (input.fast_publish_enabled) {
      const activeAssetIds = new Set(
        existing.assets
          .filter((asset) => asset.is_active)
          .map((asset) => asset.id),
      );
      if (
        input.fast_publish_images.some(
          (assetId) => !activeAssetIds.has(assetId),
        )
      ) {
        return jsonError(
          "快发图片必须来自当前 Campaign，并且处于启用状态。",
          400,
        );
      }
    }
    return Response.json({ campaign: await updateCampaign(id, input) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error && typeof error === "object" && "issues" in error) {
      return jsonError("Campaign 更新内容不符合要求。", 400);
    }
    return jsonError(error instanceof Error ? error.message : "Unable to update campaign.", 400);
  }
}
