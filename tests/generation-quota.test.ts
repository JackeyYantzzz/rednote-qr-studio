import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("global generation quota migration", () => {
  it("creates a locked singleton quota with service-role-only atomic functions", async () => {
    const sql = await readFile(
      new URL(
        "../supabase/migrations/202608150001_global_generation_quota.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(sql).toContain("limit_count integer not null default 25");
    expect(sql).toContain("for update");
    expect(sql).toContain("reserve_global_generation");
    expect(sql).toContain("reset_global_generation");
    expect(sql).toContain(
      "grant execute on function public.reserve_global_generation() to service_role",
    );
    expect(sql).toContain(
      "revoke all on table public.generation_quota from public, anon, authenticated",
    );
  });
});
