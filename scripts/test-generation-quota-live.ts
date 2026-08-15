import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.",
  );
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface QuotaResult {
  allowed: boolean;
  usedCount: number;
  limitCount: number;
  remaining: number;
  locked: boolean;
}

function parseQuota(value: unknown): QuotaResult {
  if (!value || typeof value !== "object") {
    throw new Error("Supabase returned an invalid quota payload.");
  }
  const quota = value as Record<string, unknown>;
  const result = {
    allowed: quota.allowed,
    usedCount: quota.usedCount,
    limitCount: quota.limitCount,
    remaining: quota.remaining,
    locked: quota.locked,
  };
  if (
    typeof result.allowed !== "boolean" ||
    typeof result.usedCount !== "number" ||
    typeof result.limitCount !== "number" ||
    typeof result.remaining !== "number" ||
    typeof result.locked !== "boolean"
  ) {
    throw new Error("Supabase returned incomplete quota fields.");
  }
  return result as QuotaResult;
}

async function reset(label: string) {
  const { data, error } = await supabase.rpc("reset_global_generation", {
    reset_email: label,
  });
  if (error) throw new Error(`Reset failed: ${error.message}`);
  return parseQuota(data);
}

async function reserve() {
  const { data, error } = await supabase.rpc("reserve_global_generation");
  if (error) throw new Error(`Reservation failed: ${error.message}`);
  return parseQuota(data);
}

async function main() {
  console.log("Starting live quota test. DeepSeek will not be called.");
  await reset("automated-quota-test");

  try {
    for (let attempt = 1; attempt <= 25; attempt += 1) {
      const quota = await reserve();
      if (
        !quota.allowed ||
        quota.usedCount !== attempt ||
        quota.limitCount !== 25 ||
        quota.remaining !== 25 - attempt
      ) {
        throw new Error(
          `Attempt ${attempt} failed: ${JSON.stringify(quota)}`,
        );
      }
      console.log(
        `✓ Attempt ${attempt}/25 accepted; ${quota.remaining} remaining`,
      );
    }

    const blocked = await reserve();
    if (
      blocked.allowed ||
      !blocked.locked ||
      blocked.usedCount !== 25 ||
      blocked.remaining !== 0
    ) {
      throw new Error(
        `Attempt 26 should be blocked: ${JSON.stringify(blocked)}`,
      );
    }

    console.log("✓ Attempt 26 blocked at the global limit.");
    console.log("✓ Live Supabase quota test passed.");
  } finally {
    const restored = await reset("automated-quota-test-cleanup");
    console.log(
      `✓ Quota restored to ${restored.usedCount}/${restored.limitCount}.`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
