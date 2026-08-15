import "server-only";

import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { GenerationQuotaStatus } from "@/types/database";

function readNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid generation quota field: ${field}`);
  }
  return value;
}

function normalizeQuota(value: unknown): GenerationQuotaStatus {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid generation quota response.");
  }
  const quota = value as Record<string, unknown>;
  const usedCount = readNumber(quota.usedCount ?? quota.used_count, "usedCount");
  const limitCount = readNumber(quota.limitCount ?? quota.limit_count, "limitCount");
  const remaining = readNumber(
    quota.remaining ?? Math.max(limitCount - usedCount, 0),
    "remaining",
  );
  const updatedAt = quota.updatedAt ?? quota.updated_at;

  if (typeof updatedAt !== "string") {
    throw new Error("Invalid generation quota field: updatedAt");
  }

  return {
    allowed: typeof quota.allowed === "boolean" ? quota.allowed : usedCount < limitCount,
    usedCount,
    limitCount,
    remaining,
    locked: typeof quota.locked === "boolean" ? quota.locked : usedCount >= limitCount,
    updatedAt,
    lastResetAt:
      typeof (quota.lastResetAt ?? quota.last_reset_at) === "string"
        ? String(quota.lastResetAt ?? quota.last_reset_at)
        : null,
    lastResetBy:
      typeof (quota.lastResetBy ?? quota.last_reset_by) === "string"
        ? String(quota.lastResetBy ?? quota.last_reset_by)
        : null,
  };
}

export async function getGlobalGenerationQuota(): Promise<GenerationQuotaStatus> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("generation_quota")
    .select("used_count, limit_count, updated_at, last_reset_at, last_reset_by")
    .eq("id", "global")
    .single();

  if (error) throw new Error(`Unable to load generation quota: ${error.message}`);
  return normalizeQuota(data);
}

export async function reserveGlobalGeneration(): Promise<GenerationQuotaStatus> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.rpc("reserve_global_generation");
  if (error) throw new Error(`Unable to reserve generation quota: ${error.message}`);
  return normalizeQuota(data);
}

export async function resetGlobalGeneration(
  adminEmail: string,
): Promise<GenerationQuotaStatus> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.rpc("reset_global_generation", {
    reset_email: adminEmail,
  });
  if (error) throw new Error(`Unable to reset generation quota: ${error.message}`);
  return normalizeQuota(data);
}
