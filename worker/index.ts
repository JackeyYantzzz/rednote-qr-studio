import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getWorkerConfig } from "./config";
import { downloadImages } from "./downloader";
import { logger } from "./logger";
import { publishWithXhsMcp } from "./mcp-client";
import { failedJobPatch } from "./job-state";
import type { PublishJob } from "../types/database";

const config = getWorkerConfig();
const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const shutdownController = new AbortController();
let processing = false;

function requestShutdown(signal: string) {
  logger.info("Shutdown requested", { signal });
  shutdownController.abort();
}

process.on("SIGINT", () => requestShutdown("SIGINT"));
process.on("SIGTERM", () => requestShutdown("SIGTERM"));

async function claimJob() {
  const { data, error } = await supabase.rpc("claim_publish_job", {
    max_attempts: config.maxAttempts,
  });
  if (error) throw error;
  return ((data as PublishJob[] | null) ?? [])[0] ?? null;
}

async function updateJob(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("publish_jobs").update(patch).eq("id", id);
  if (error) throw error;
}

async function processJob(job: PublishJob) {
  const baseDir = path.resolve(config.tempDir);
  const jobDir = path.resolve(baseDir, job.id);
  if (!jobDir.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error("Unsafe worker temporary directory.");
  }
  await mkdir(baseDir, { recursive: true });
  logger.info("Claimed publish job", {
    jobId: job.id,
    attempt: job.attempt_count,
    visibility: job.visibility,
  });

  try {
    const imagePaths = await downloadImages({
      urls: job.image_urls,
      targetDir: jobDir,
      supabaseUrl: config.supabaseUrl,
      extraHosts: config.allowedImageHosts,
      maxBytes: config.maxImageBytes,
      signal: shutdownController.signal,
    });
    await updateJob(job.id, { status: "publishing" });
    const result = await publishWithXhsMcp({
      mcpUrl: config.mcpUrl,
      title: job.title,
      content: job.content,
      images: imagePaths,
      tags: job.tags,
      scheduleAt: job.schedule_at,
      isOriginal: job.is_original,
      visibility: job.visibility,
    });
    await updateJob(job.id, {
      status: "published",
      result,
      error_message: null,
      completed_at: new Date().toISOString(),
    });
    logger.info("Publish job completed", { jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : "Unknown worker error";
    await updateJob(job.id, failedJobPatch(job.attempt_count, config.maxAttempts, message));
    logger.error("Publish job failed", {
      jobId: job.id,
      attempt: job.attempt_count,
      willRetry: job.attempt_count < config.maxAttempts,
      error: message,
    });
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
}

async function tick() {
  if (processing || shutdownController.signal.aborted) return false;
  processing = true;
  try {
    const job = await claimJob();
    if (!job) return false;
    await processJob(job);
    return true;
  } finally {
    processing = false;
  }
}

async function main() {
  const once = process.argv.includes("--once");
  logger.info("Windows publisher worker started", {
    pollIntervalMs: config.pollIntervalMs,
    maxAttempts: config.maxAttempts,
    once,
  });
  do {
    try {
      const handled = await tick();
      if (once) break;
      if (handled) continue;
    } catch (error) {
      logger.error("Worker poll failed", {
        error: error instanceof Error ? error.message : "Unknown polling error",
      });
      if (once) process.exitCode = 1;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, config.pollIntervalMs);
      shutdownController.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  } while (!shutdownController.signal.aborted);
  logger.info("Windows publisher worker stopped");
}

void main();
