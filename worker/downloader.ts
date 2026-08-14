import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedImageUrl(
  rawUrl: string,
  supabaseUrl: string,
  extraHosts: string[] = [],
) {
  let url: URL;
  let supabase: URL;
  try {
    url = new URL(rawUrl);
    supabase = new URL(supabaseUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const allowed = new Set([supabase.hostname.toLowerCase(), ...extraHosts]);
  return allowed.has(url.hostname.toLowerCase());
}

export async function downloadImages(options: {
  urls: string[];
  targetDir: string;
  supabaseUrl: string;
  extraHosts: string[];
  maxBytes: number;
  signal: AbortSignal;
}) {
  const resolvedTarget = path.resolve(options.targetDir);
  await mkdir(resolvedTarget, { recursive: true });

  const paths: string[] = [];
  for (const [index, rawUrl] of options.urls.entries()) {
    if (!isAllowedImageUrl(rawUrl, options.supabaseUrl, options.extraHosts)) {
      throw new Error(`Image ${index + 1} uses an unapproved host.`);
    }
    const response = await fetch(rawUrl, {
      redirect: "error",
      signal: options.signal,
      headers: { Accept: "image/jpeg,image/png,image/webp" },
    });
    if (!response.ok) throw new Error(`Image ${index + 1} download failed (${response.status}).`);
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > options.maxBytes) {
      throw new Error(`Image ${index + 1} exceeds the configured size limit.`);
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > options.maxBytes) {
      throw new Error(`Image ${index + 1} has an invalid size.`);
    }
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !allowedMimeTypes.has(detected.mime)) {
      throw new Error(`Image ${index + 1} has an unsupported MIME type.`);
    }
    const filename = `${String(index + 1).padStart(2, "0")}.${detected.ext}`;
    const outputPath = path.resolve(resolvedTarget, filename);
    if (!outputPath.startsWith(`${resolvedTarget}${path.sep}`)) {
      throw new Error("Unsafe image output path.");
    }
    await writeFile(outputPath, buffer, { flag: "wx" });
    paths.push(outputPath);
  }
  return paths;
}
