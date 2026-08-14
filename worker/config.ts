import "dotenv/config";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";

const blankAsUndefined = (value: unknown) => (value === "" ? undefined : value);

const workerEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  XHS_MCP_URL: z.preprocess(
    blankAsUndefined,
    z.string().url().default("http://localhost:18060/mcp"),
  ),
  WORKER_POLL_INTERVAL_MS: z.preprocess(
    blankAsUndefined,
    z.coerce.number().int().min(1000).max(300_000).default(10_000),
  ),
  WORKER_MAX_ATTEMPTS: z.preprocess(
    blankAsUndefined,
    z.coerce.number().int().min(1).max(10).default(3),
  ),
  WORKER_TEMP_DIR: z.preprocess(
    blankAsUndefined,
    z.string().min(3).default(path.join(tmpdir(), "xhs-publisher")),
  ),
  WORKER_MAX_IMAGE_BYTES: z.preprocess(
    blankAsUndefined,
    z.coerce
      .number()
      .int()
      .min(1024)
      .max(50 * 1024 * 1024)
      .default(15 * 1024 * 1024),
  ),
  ALLOWED_IMAGE_HOSTS: z.string().default(""),
});

export type WorkerConfig = ReturnType<typeof getWorkerConfig>;

export function getWorkerConfig() {
  const parsed = workerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Worker environment validation failed: ${fields}`);
  }
  return {
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    mcpUrl: parsed.data.XHS_MCP_URL,
    pollIntervalMs: parsed.data.WORKER_POLL_INTERVAL_MS,
    maxAttempts: parsed.data.WORKER_MAX_ATTEMPTS,
    tempDir: parsed.data.WORKER_TEMP_DIR,
    maxImageBytes: parsed.data.WORKER_MAX_IMAGE_BYTES,
    allowedImageHosts: parsed.data.ALLOWED_IMAGE_HOSTS.split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  };
}
