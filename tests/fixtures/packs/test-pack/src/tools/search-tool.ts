import { defineTool } from "@platform/plugin-sdk";

export const searchTool = defineTool({
  pluginId: "test-pack.search",
  name: "Search",
  version: "1.0.0",
  description: "Search resources",
  capabilities: [{ name: "search", description: "Search resources", inputSchema: {}, outputSchema: {} }],
});
