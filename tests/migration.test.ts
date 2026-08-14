import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("publish job migration", () => {
  it("claims jobs atomically and prevents duplicate active jobs", async () => {
    const sql = await readFile(
      new URL("../supabase/migrations/202607310001_initial_schema.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("attempt_count <");
    expect(sql).toContain("publish_jobs_no_duplicate_active_idx");
    expect(sql).toContain("grant execute on function public.claim_publish_job(integer) to service_role");
  });
});

describe("Fast Publish migration", () => {
  it("adds Campaign settings and handoff-only analytics events", async () => {
    const sql = await readFile(
      new URL(
        "../supabase/migrations/202607310002_fast_publish_mode.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain("fast_publish_enabled boolean");
    expect(sql).toContain("fast_publish_images jsonb");
    expect(sql).toContain("fast_publish_content jsonb");
    expect(sql).toContain("'fast_page_view'");
    expect(sql).toContain("'fast_share_clicked'");
    expect(sql).toContain("'fast_share_completed'");
    expect(sql).toContain("'fast_share_cancelled'");
    expect(sql).toContain("'fast_share_failed'");
    expect(sql).not.toContain("fast_publish_published");
  });
});
