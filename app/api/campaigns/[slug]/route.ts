import { getCampaignBySlug } from "@/lib/server/repository";
import { jsonError } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return jsonError("Invalid campaign slug.", 400);
    }
    const campaign = await getCampaignBySlug(slug, true);
    if (!campaign) return jsonError("Campaign not found.", 404);
    return Response.json({ campaign });
  } catch {
    return jsonError("Unable to load the campaign.", 500);
  }
}
