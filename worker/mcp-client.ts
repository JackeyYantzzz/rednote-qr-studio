import {
  Client,
  StreamableHTTPClientTransport,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/client";

export const loginToolCandidates = [
  "check_login_status",
  "get_login_status",
  "login_status",
  "check_login",
];

export function selectLoginTool(tools: Array<Pick<Tool, "name">>) {
  return loginToolCandidates.find((candidate) =>
    tools.some((tool) => tool.name === candidate),
  );
}

export function resolveVisibilityValue(
  publishTool: Pick<Tool, "inputSchema">,
  visibility: "private" | "public",
) {
  const schema = publishTool.inputSchema as {
    properties?: { visibility?: { enum?: unknown[] } };
  };
  const allowed = (schema.properties?.visibility?.enum ?? []).filter(
    (item): item is string => typeof item === "string",
  );
  const candidates =
    visibility === "private"
      ? ["self-only", "仅自己可见", "private"]
      : ["public", "公开可见"];
  return candidates.find((candidate) => allowed.length === 0 || allowed.includes(candidate))
    ?? candidates[0];
}

function resultText(result: CallToolResult) {
  return result.content
    .map((content) => ("text" in content && typeof content.text === "string" ? content.text : ""))
    .join("\n");
}

export function reportsLoggedOut(result: CallToolResult) {
  if (result.isError) return true;
  const text = resultText(result).trim();
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed.logged_in === false || parsed.loggedIn === false || parsed.isLoggedIn === false) {
      return true;
    }
  } catch {
    // Plain-text login status is common in third-party MCP servers.
  }
  return /未登录|not\s+logged|logged[_\s-]?in["']?\s*:\s*false/i.test(text);
}

export async function withXhsMcp<T>(
  mcpUrl: string,
  run: (client: Client, tools: Tool[]) => Promise<T>,
) {
  const client = new Client({ name: "rednote-windows-publisher", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    return await run(client, tools);
  } finally {
    await client.close();
  }
}

export async function assertXhsLoggedIn(client: Client, tools: Tool[]) {
  const loginTool = selectLoginTool(tools);
  if (!loginTool) {
    throw new Error(
      `xiaohongshu-mcp does not expose a supported login status tool (${loginToolCandidates.join(", ")}).`,
    );
  }
  const result = await client.callTool({ name: loginTool, arguments: {} });
  if (reportsLoggedOut(result)) {
    throw new Error("xiaohongshu-mcp reports that the fixed brand account is not logged in.");
  }
}

export async function publishWithXhsMcp(options: {
  mcpUrl: string;
  title: string;
  content: string;
  images: string[];
  tags: string[];
  scheduleAt: string | null;
  isOriginal: boolean;
  visibility: "private" | "public";
}) {
  return withXhsMcp(options.mcpUrl, async (client, tools) => {
    await assertXhsLoggedIn(client, tools);
    const publishTool = tools.find((tool) => tool.name === "publish_content");
    if (!publishTool) {
      throw new Error("xiaohongshu-mcp does not expose publish_content.");
    }
    const result = await client.callTool({
      name: "publish_content",
      arguments: {
        title: options.title,
        content: options.content,
        images: options.images,
        tags: options.tags,
        schedule_at: options.scheduleAt,
        is_original: options.isOriginal,
        visibility: resolveVisibilityValue(publishTool, options.visibility),
      },
    });
    if (result.isError) {
      throw new Error(`publish_content failed: ${resultText(result).slice(0, 500)}`);
    }
    return result;
  });
}
