import { defineRetriever } from "@platform/plugin-sdk";

export const contextRetriever = defineRetriever({
  pluginId: "test-pack.context",
  name: "Context Retriever",
  version: "1.0.0",
  capabilities: [{ name: "retrieve", description: "Retrieve context", inputSchema: {}, outputSchema: {} }],
});
