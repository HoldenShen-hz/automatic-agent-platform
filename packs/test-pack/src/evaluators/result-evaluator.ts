import { defineEvaluator } from "@platform/plugin-sdk";

export const resultEvaluator = defineEvaluator({
  evaluatorId: "test-pack.result",
  name: "Result Evaluator",
  async evaluate(input: { result: unknown }) {
    return { passed: true, score: 1.0 };
  },
});