import { assertAdmin } from "@/lib/auth";
import { publishJobInputSchema } from "@/lib/schemas";
import {
  createPublishJob,
  getAssetsByIds,
  getGeneration,
  listPublishJobs,
} from "@/lib/server/repository";
import { jsonError, normalizeTag } from "@/lib/utils";

export async function GET() {
  try {
    await assertAdmin();
    return Response.json({ jobs: await listPublishJobs() });
  } catch (error) {
    return jsonError(
      error instanceof Error && error.message === "UNAUTHORIZED"
        ? "Unauthorized"
        : "Unable to list publish jobs.",
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500,
    );
  }
}

export async function POST(request: Request) {
  try {
    await assertAdmin();
    const input = publishJobInputSchema.parse(await request.json());
    const generation = await getGeneration(input.generationId);
    if (!generation) return jsonError("Generation not found.", 404);

    const assets = await getAssetsByIds(
      generation.campaign_id,
      generation.selected_asset_ids,
    );
    if (assets.length !== generation.selected_asset_ids.length) {
      return jsonError("生成记录中的图片已停用或不存在。", 409);
    }

    const job = await createPublishJob({
      generation_id: input.generationId,
      title: input.title,
      content: input.content,
      tags: [...new Set(input.tags.map(normalizeTag).filter(Boolean))],
      image_urls: assets.map((asset) => asset.file_url),
      visibility: input.visibility,
      schedule_at: input.scheduleAt,
      is_original: input.isOriginal,
    });
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error && typeof error === "object" && "issues" in error) {
      return jsonError("发布任务内容不符合要求。", 400);
    }
    return jsonError(error instanceof Error ? error.message : "Unable to create job.", 400);
  }
}
