import { assertAdmin } from "@/lib/auth";
import { campaignInputSchema } from "@/lib/schemas";
import { createCampaign, listCampaigns } from "@/lib/server/repository";
import { jsonError } from "@/lib/utils";

export async function GET() {
  try {
    await assertAdmin();
    return Response.json({ campaigns: await listCampaigns() });
  } catch (error) {
    return jsonError(
      error instanceof Error && error.message === "UNAUTHORIZED"
        ? "Unauthorized"
        : "Unable to list campaigns.",
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500,
    );
  }
}

export async function POST(request: Request) {
  try {
    await assertAdmin();
    const input = campaignInputSchema.parse(await request.json());
    const campaign = await createCampaign(input);
    return Response.json({ campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error && typeof error === "object" && "issues" in error) {
      return jsonError("Campaign 配置不符合要求。", 400, (error as { issues: unknown }).issues);
    }
    return jsonError(error instanceof Error ? error.message : "Unable to create campaign.", 400);
  }
}
