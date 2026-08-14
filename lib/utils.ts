import type { GeneratedPost } from "@/types/database";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function sanitizeFilename(filename: string) {
  const extension = filename.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[0] ?? "";
  const stem = filename
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "image";
  return `${stem}${extension}`;
}

export function normalizeTag(tag: string) {
  return tag.trim().replace(/^#+/, "").replace(/\s+/g, "");
}

export function composeFullPost(title: string, body: string, tags: string[]) {
  const cleanTags = tags.map(normalizeTag).filter(Boolean);
  return `${title.trim()}\n\n${body.trim()}\n\n${cleanTags.map((tag) => `#${tag}`).join(" ")}`.trim();
}

export function normalizeGeneratedPost(post: GeneratedPost): GeneratedPost {
  const tags = [...new Set(post.tags.map(normalizeTag).filter(Boolean))].slice(0, 12);
  return {
    ...post,
    tags,
    fullPost: composeFullPost(post.selectedTitle, post.body, tags),
  };
}

export function splitList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}
