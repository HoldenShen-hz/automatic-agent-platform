import { defineAdapter } from "automatic-agent-platform/sdk/plugin-sdk";

export const httpAdapter = defineAdapter({
  pluginId: "test-pack.http",
  name: "HTTP Adapter",
  version: "1.0.0",
  capabilities: [{ name: "adapt", description: "HTTP adapter", inputSchema: {}, outputSchema: {} }],
});
