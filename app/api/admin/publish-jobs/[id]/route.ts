import { assertAdmin } from "@/lib/auth";
import { publishJobActionSchema } from "@/lib/schemas";
import {
  getPublishJob,
  setPublishJobStatus,
} from "@/lib/server/repository";
import { jsonError } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdmin();
    const job = await getPublishJob((await params).id);
    if (!job) return jsonError("Publish job not found.", 404);
    return Response.json({ job });
  } catch (error) {
    return jsonError(
      error instanceof Error && error.message === "UNAUTHORIZED"
        ? "Unauthorized"
        : "Unable to load publish job.",
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
    const id = (await params).id;
    const action = publishJobActionSchema.parse(await request.json());
    const job = await getPublishJob(id);
    if (!job) return jsonError("Publish job not found.", 404);

    if (action.action === "approve") {
      if (job.status !== "pending" && job.status !== "failed") {
        return jsonError("只有待确认或失败任务可以批准。", 409);
      }
      if (job.visibility === "public" && !action.confirmPublic) {
        return jsonError("公开发布需要再次明确确认。", 400);
      }
      return Response.json({ job: await setPublishJobStatus(id, "approved") });
    }

    if (action.action === "retry") {
      if (job.status !== "failed") return jsonError("只有失败任务可以重试。", 409);
      return Response.json({ job: await setPublishJobStatus(id, "approved") });
    }

    if (["published", "cancelled"].includes(job.status)) {
      return jsonError("该任务不能取消。", 409);
    }
    return Response.json({ job: await setPublishJobStatus(id, "cancelled") });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error && typeof error === "object" && "issues" in error) {
      return jsonError("发布任务操作不符合要求。", 400);
    }
    return jsonError(error instanceof Error ? error.message : "Unable to update job.", 400);
  }
}
