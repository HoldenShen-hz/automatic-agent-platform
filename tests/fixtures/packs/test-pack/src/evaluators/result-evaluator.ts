import { defineEvaluator } from "@platform/plugin-sdk";

export const resultEvaluator = defineEvaluator({
  pluginId: "test-pack.result",
  name: "Result Evaluator",
  version: "1.0.0",
  capabilities: [{ name: "evaluate", description: "Evaluate result quality", inputSchema: {}, outputSchema: {} }],
});
