import { defineTool } from "automatic-agent-platform/sdk/plugin-sdk";

export const searchTool = defineTool({
  pluginId: "test-pack.search",
  name: "Search",
  version: "1.0.0",
  description: "Search resources",
  capabilities: [{ name: "search", description: "Search resources", inputSchema: {}, outputSchema: {} }],
});
