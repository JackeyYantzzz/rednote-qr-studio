import { getServerEnv, isDemoMode } from "@/lib/config";
import { getAssetById } from "@/lib/server/repository";
import { jsonError, sanitizeFilename } from "@/lib/utils";

const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;

function isApprovedAssetUrl(url: URL) {
  if (isDemoMode() && ["images.unsplash.com"].includes(url.hostname)) return true;
  const supabaseUrl = getServerEnv().NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;
  return url.protocol === "https:" && url.hostname === new URL(supabaseUrl).hostname;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const asset = await getAssetById((await params).id);
    if (!asset) return jsonError("Image not found.", 404);

    if (
      isDemoMode() &&
      /^\/demo\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/i.test(asset.file_url)
    ) {
      return Response.redirect(new URL(asset.file_url, request.url), 307);
    }

    const url = new URL(asset.file_url);
    if (url.protocol === "data:" && isDemoMode()) {
      const response = await fetch(url);
      return new Response(response.body, {
        headers: {
          "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(asset.name)}.jpg"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    }
    if (!isApprovedAssetUrl(url)) return jsonError("Image host is not approved.", 403);

    const upstream = await fetch(url, { redirect: "error" });
    if (!upstream.ok) return jsonError("Unable to download image.", 502);
    const length = Number(upstream.headers.get("content-length") ?? 0);
    if (length > MAX_DOWNLOAD_BYTES) return jsonError("Image is too large.", 413);
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!["image/jpeg", "image/png", "image/webp"].some((type) => contentType.startsWith(type))) {
      return jsonError("Unexpected image type.", 415);
    }
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_DOWNLOAD_BYTES) return jsonError("Image is too large.", 413);

    const extension = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitizeFilename(asset.name)}.${extension}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return jsonError("Unable to download image.", 500);
  }
}
