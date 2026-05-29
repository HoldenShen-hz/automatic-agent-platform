import { defineAdapter } from "automatic-agent-platform/sdk/plugin-sdk";

export const dbAdapter = defineAdapter({
  pluginId: "test-pack.db",
  name: "Database Adapter",
  version: "1.0.0",
  capabilities: [{ name: "adapt", description: "Database adapter", inputSchema: {}, outputSchema: {} }],
});
