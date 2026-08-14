import { describe, expect, it } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/client";
import { isAllowedImageUrl } from "@/worker/downloader";
import { failedJobPatch } from "@/worker/job-state";
import {
  reportsLoggedOut,
  resolveVisibilityValue,
  selectLoginTool,
} from "@/worker/mcp-client";

describe("Windows worker safety", () => {
  it("allows only HTTPS images from configured storage hosts", () => {
    const supabase = "https://project.supabase.co";
    expect(
      isAllowedImageUrl(
        "https://project.supabase.co/storage/v1/object/public/campaign-assets/a.jpg",
        supabase,
      ),
    ).toBe(true);
    expect(isAllowedImageUrl("http://project.supabase.co/a.jpg", supabase)).toBe(false);
    expect(isAllowedImageUrl("https://evil.example/a.jpg", supabase)).toBe(false);
  });

  it("selects a known login-status tool without inventing a protocol", () => {
    expect(selectLoginTool([{ name: "publish_content" }, { name: "check_login_status" }])).toBe(
      "check_login_status",
    );
    expect(selectLoginTool([{ name: "publish_content" }])).toBeUndefined();
  });

  it("maps private jobs to the MCP server's self-only visibility value", () => {
    expect(
      resolveVisibilityValue(
        {
          inputSchema: {
            type: "object",
            properties: { visibility: { enum: ["public", "self-only", "friends-only"] } },
          },
        },
        "private",
      ),
    ).toBe("self-only");
    expect(
      resolveVisibilityValue(
        {
          inputSchema: {
            type: "object",
            properties: { visibility: { enum: ["公开可见", "仅自己可见"] } },
          },
        },
        "private",
      ),
    ).toBe("仅自己可见");
  });

  it("detects MCP logged-out responses", () => {
    const loggedOut = {
      content: [{ type: "text", text: '{"logged_in":false}' }],
      isError: false,
    } as CallToolResult;
    const loggedIn = {
      content: [{ type: "text", text: '{"logged_in":true}' }],
      isError: false,
    } as CallToolResult;
    expect(reportsLoggedOut(loggedOut)).toBe(true);
    expect(reportsLoggedOut(loggedIn)).toBe(false);
  });

  it("marks failures and stops scheduling retries at the configured attempt limit", () => {
    expect(failedJobPatch(1, 3, "MCP failed").completed_at).toBeNull();
    expect(failedJobPatch(3, 3, "MCP failed").completed_at).toMatch(/T/);
    expect(failedJobPatch(3, 3, "MCP failed").status).toBe("failed");
  });
});
