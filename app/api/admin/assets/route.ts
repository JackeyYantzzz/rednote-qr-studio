import { assertAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { assetMetadataSchema } from "@/lib/schemas";
import { createAsset, getCampaignById, updateAsset } from "@/lib/server/repository";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  jsonError,
  sanitizeFilename,
  splitList,
} from "@/lib/utils";

function toBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, contentType: string) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function detectImageMime(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    await assertAdmin();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("请选择图片文件。", 400);
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type)) {
      return jsonError("仅支持 JPEG、PNG 和 WebP 图片。", 415);
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return jsonError("图片必须小于 10MB。", 413);
    }
    const fileBuffer = await file.arrayBuffer();
    const detectedMime = detectImageMime(new Uint8Array(fileBuffer));
    if (!detectedMime || detectedMime !== file.type) {
      return jsonError("图片内容与文件类型不一致。", 415);
    }

    const metadata = assetMetadataSchema.parse({
      campaign_id: form.get("campaign_id"),
      name: form.get("name"),
      description: form.get("description"),
      category: form.get("category"),
      keywords: splitList(form.get("keywords")),
      sort_order: form.get("sort_order") ?? 0,
      is_active: toBoolean(form.get("is_active")),
    });
    const campaign = await getCampaignById(metadata.campaign_id);
    if (!campaign) return jsonError("Campaign 不存在。", 404);

    const safeName = sanitizeFilename(file.name);
    const storagePath = `${metadata.campaign_id}/${crypto.randomUUID()}-${safeName}`;
    let fileUrl: string;

    if (isDemoMode()) {
      fileUrl = arrayBufferToDataUrl(fileBuffer, file.type);
    } else {
      const supabase = createServiceSupabaseClient();
      const { error } = await supabase.storage
        .from("campaign-assets")
        .upload(storagePath, new Uint8Array(fileBuffer), {
          contentType: file.type,
          upsert: false,
          cacheControl: "31536000",
        });
      if (error) throw error;
      fileUrl = supabase.storage.from("campaign-assets").getPublicUrl(storagePath).data.publicUrl;
    }

    const asset = await createAsset({
      ...metadata,
      file_url: fileUrl,
      storage_path: storagePath,
      thumbnail_url: null,
    });
    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error && typeof error === "object" && "issues" in error) {
      return jsonError("图片信息不符合要求。", 400);
    }
    return jsonError(error instanceof Error ? error.message : "Image upload failed.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    await assertAdmin();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Invalid asset id.", 400);
    const patch = assetMetadataSchema
      .omit({ campaign_id: true })
      .partial()
      .parse(body);
    return Response.json({ asset: await updateAsset(id, patch) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error && typeof error === "object" && "issues" in error) {
      return jsonError("图片更新内容不符合要求。", 400);
    }
    return jsonError(error instanceof Error ? error.message : "Unable to update image.", 400);
  }
}
