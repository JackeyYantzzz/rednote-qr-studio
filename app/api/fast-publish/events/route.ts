import { checkRateLimit, requestKey } from "@/lib/rate-limit";
import { fastPublishEventInputSchema } from "@/lib/schemas";
import {
  getCampaignBySlug,
  recordFastPublishEvent,
} from "@/lib/server/repository";
import { jsonError } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(
      requestKey(request, "fast-publish-events"),
      120,
      60 * 60 * 1000,
    );
    if (!limit.ok) return jsonError("Too many events.", 429);

    const input = fastPublishEventInputSchema.parse(await request.json());
    const campaign = await getCampaignBySlug(input.campaignSlug, true);
    if (!campaign || !campaign.fast_publish_enabled) {
      return jsonError("Fast Publish is not available.", 404);
    }
    await recordFastPublishEvent({
      campaignId: campaign.id,
      eventName: input.eventName,
      sessionId: input.sessionId,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return jsonError("Invalid Fast Publish event.", 400);
    }
    return jsonError("Unable to record Fast Publish event.", 500);
  }
}
