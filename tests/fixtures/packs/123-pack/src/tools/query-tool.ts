import { defineTool } from "automatic-agent-platform/sdk/plugin-sdk";

export const queryTool = defineTool({
  pluginId: "123-pack.query",
  name: "Query",
  version: "1.0.0",
  description: "Execute a query",
  capabilities: [{ name: "query", description: "Execute a query", inputSchema: {}, outputSchema: {} }],
});
