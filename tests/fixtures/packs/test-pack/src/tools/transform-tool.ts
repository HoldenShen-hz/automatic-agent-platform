import { defineTool } from "@platform/plugin-sdk";

export const transformTool = defineTool({
  pluginId: "test-pack.transform",
  name: "Transform",
  version: "1.0.0",
  description: "Transform data",
  capabilities: [{ name: "transform", description: "Transform data", inputSchema: {}, outputSchema: {} }],
});
