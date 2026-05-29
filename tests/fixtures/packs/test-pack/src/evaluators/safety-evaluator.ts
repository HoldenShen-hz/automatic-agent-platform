import { defineEvaluator } from "automatic-agent-platform/sdk/plugin-sdk";

export const safetyEvaluator = defineEvaluator({
  pluginId: "test-pack.safety",
  name: "Safety Evaluator",
  version: "1.0.0",
  capabilities: [{ name: "evaluate", description: "Evaluate safety", inputSchema: {}, outputSchema: {} }],
});
