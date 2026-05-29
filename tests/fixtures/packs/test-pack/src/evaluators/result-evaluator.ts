import { defineEvaluator } from "automatic-agent-platform/sdk/plugin-sdk";

export const resultEvaluator = defineEvaluator({
  pluginId: "test-pack.result",
  name: "Result Evaluator",
  version: "1.0.0",
  capabilities: [{ name: "evaluate", description: "Evaluate result quality", inputSchema: {}, outputSchema: {} }],
});
