import assert from "node:assert/strict";
import test from "node:test";

import { EdgeRiskGate } from "../../../../src/ops-maturity/edge-runtime/edge-risk-gate.js";

const baseRequest = {
  edgeNodeId: "edge_1",
  taskId: "task_1",
  modality: "text",
  createdAt: "2026-05-20T00:00:00.000Z",
};

test("EdgeRiskGate fail-closes when riskScore is missing", () => {
  const result = new EdgeRiskGate().check({
    ...baseRequest,
    taskType: "read",
  });

  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /risk_score_required/);
});

test("EdgeRiskGate fail-closes when taskType is missing", () => {
  const result = new EdgeRiskGate().check({
    ...baseRequest,
    riskScore: 0.1,
  });

  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /task_type_required/);
});

test("EdgeRiskGate allows explicit low-risk request", () => {
  const result = new EdgeRiskGate().check({
    ...baseRequest,
    riskScore: 0.1,
    taskType: "read",
  });

  assert.equal(result.allowed, true);
});
