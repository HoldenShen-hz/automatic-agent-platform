import assert from "node:assert/strict";
import test from "node:test";

import { CostOptimizationService } from "../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";

test("integration: cost tracker feeds optimizer dashboard and what-if simulation", () => {
  const service = new CostOptimizationService();
  for (const record of [
    {
      subjectType: "agent" as const,
      subjectId: "agent_ops_1",
      costType: "runtime" as const,
      amountUsd: 20,
      decisionRef: "dec_1",
      capturedAt: "2026-04-20T00:00:00.000Z",
    },
    {
      subjectType: "agent" as const,
      subjectId: "agent_ops_1",
      costType: "model" as const,
      amountUsd: 30,
      decisionRef: "dec_2",
      modelRef: "gpt-5.4",
      capturedAt: "2026-04-20T00:05:00.000Z",
    },
  ]) {
    service.recordCost(record);
  }

  const dashboard = service.buildDashboardSlice("2026-04-20T01:00:00.000Z");
  assert.equal(dashboard.bySubject.agent_ops_1, 50);
  assert.equal(dashboard.recommendations.length, 1);

  const simulation = service.simulate([{ scenarioId: "cut_20", subjectId: "agent_ops_1", reductionPercent: 20 }]);
  assert.equal(simulation[0]?.simulatedCostUsd, 40);
});
