import { defineTool } from "@platform/plugin-sdk";

export const queryTool = defineTool({
  pluginId: "123test.query",
  name: "Query",
  version: "1.0.0",
  description: "Execute a query",
  capabilities: [{ name: "query", description: "Execute a query", inputSchema: {}, outputSchema: {} }],
});
