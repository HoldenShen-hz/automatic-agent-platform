import { defineEvaluator } from "@platform/plugin-sdk";

export const safetyEvaluator = defineEvaluator({
  evaluatorId: "test-pack.safety",
  name: "Safety Evaluator",
  async evaluate(input: { result: unknown }) {
    return { passed: true, score: 1.0, findings: [] };
  },
});