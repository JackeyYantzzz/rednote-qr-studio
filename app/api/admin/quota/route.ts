import { assertAdmin } from "@/lib/auth";
import {
  getGlobalGenerationQuota,
  resetGlobalGeneration,
} from "@/lib/server/generation-quota";
import { jsonError } from "@/lib/utils";

export const dynamic = "force-dynamic";

function isUnauthorized(error: unknown) {
  return error instanceof Error && error.message === "UNAUTHORIZED";
}

export async function GET() {
  try {
    await assertAdmin();
    return Response.json(await getGlobalGenerationQuota());
  } catch (error) {
    if (isUnauthorized(error)) return jsonError("未登录或没有管理员权限。", 401);
    console.error("Quota read failed", error);
    return jsonError("暂时无法读取全局额度。", 500);
  }
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("origin");
    if (origin && origin !== requestUrl.origin) {
      return jsonError("请求来源无效。", 403);
    }

    const admin = await assertAdmin();
    return Response.json(await resetGlobalGeneration(admin.email));
  } catch (error) {
    if (isUnauthorized(error)) return jsonError("未登录或没有管理员权限。", 401);
    console.error("Quota reset failed", error);
    return jsonError("额度重置失败，请稍后重试。", 500);
  }
}
