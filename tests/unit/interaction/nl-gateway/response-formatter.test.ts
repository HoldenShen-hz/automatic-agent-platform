import test from "node:test";
import assert from "node:assert/strict";

import {
  ResponseFormatter,
  type RiskPreview,
  type ClarificationState,
  type CostEstimate,
} from "../../../../src/interaction/nl-gateway/index.js";

function makeRiskPreview(overrides: Partial<RiskPreview> = {}): RiskPreview {
  return {
    overallRisk: "low",
    riskFactors: [],
    reversible: true,
    sideEffects: [],
    approvalNeeded: false,
    ...overrides,
  };
}

function makeClarificationState(overrides: Partial<ClarificationState> = {}): ClarificationState {
  return {
    state: "none",
    reasonCodes: [],
    questions: [],
    rounds: 0,
    maxRounds: 3,
    ...overrides,
  };
}

function makeCostEstimate(overrides: Partial<CostEstimate> = {}): CostEstimate {
  return {
    estimatedCostUsd: 0.05,
    confidence: "default",
    sampleCount: 0,
    divisionId: null,
    basedOn: "default",
    ...overrides,
  };
}

test("ResponseFormatter.formatTaskSummary includes divisionId", () => {
  const formatter = new ResponseFormatter();

  const summary = formatter.formatTaskSummary({
    divisionId: "devops",
    workflowId: "wf_001",
    costEstimate: makeCostEstimate(),
    riskPreview: makeRiskPreview(),
    clarificationState: makeClarificationState(),
  });

  assert.ok(summary.includes("devops"));
});

test("ResponseFormatter.formatTaskSummary includes workflowId", () => {
  const formatter = new ResponseFormatter();

  const summary = formatter.formatTaskSummary({
    divisionId: "general-ops",
    workflowId: "deploy_wf",
    costEstimate: makeCostEstimate(),
    riskPreview: makeRiskPreview(),
    clarificationState: makeClarificationState(),
  });

  assert.ok(summary.includes("deploy_wf"));
});

test("ResponseFormatter.formatTaskSummary includes cost estimate", () => {
  const formatter = new ResponseFormatter();

  const summary = formatter.formatTaskSummary({
    divisionId: "general-ops",
    workflowId: "wf_001",
    costEstimate: makeCostEstimate({ estimatedCostUsd: 1.25 }),
    riskPreview: makeRiskPreview(),
    clarificationState: makeClarificationState(),
  });

  assert.ok(summary.includes("1.25"));
});

test("ResponseFormatter.formatTaskSummary includes risk level", () => {
  const formatter = new ResponseFormatter();

  const summary = formatter.formatTaskSummary({
    divisionId: "general-ops",
    workflowId: "wf_001",
    costEstimate: makeCostEstimate(),
    riskPreview: makeRiskPreview({ overallRisk: "critical" }),
    clarificationState: makeClarificationState(),
  });

  assert.ok(summary.includes("critical"));
});

test("ResponseFormatter.formatTaskSummary indicates clarification needed", () => {
  const formatter = new ResponseFormatter();

  const summary = formatter.formatTaskSummary({
    divisionId: "general-ops",
    workflowId: "wf_001",
    costEstimate: makeCostEstimate(),
    riskPreview: makeRiskPreview(),
    clarificationState: makeClarificationState({ state: "required" }),
  });

  assert.ok(summary.includes("澄清"));
});

test("ResponseFormatter.formatTaskSummary indicates blocked by policy", () => {
  const formatter = new ResponseFormatter();

  const summary = formatter.formatTaskSummary({
    divisionId: "general-ops",
    workflowId: "wf_001",
    costEstimate: makeCostEstimate(),
    riskPreview: makeRiskPreview(),
    clarificationState: makeClarificationState({ state: "blocked" }),
  });

  assert.ok(summary.includes("安全防护") || summary.includes("人工确认"));
});

test("ResponseFormatter.formatTaskSummary indicates can proceed", () => {
  const formatter = new ResponseFormatter();

  const summary = formatter.formatTaskSummary({
    divisionId: "general-ops",
    workflowId: "wf_001",
    costEstimate: makeCostEstimate(),
    riskPreview: makeRiskPreview(),
    clarificationState: makeClarificationState({ state: "none" }),
  });

  assert.ok(summary.includes("直接进入执行编排"));
});

test("ResponseFormatter.formatTaskSummary formats high risk correctly", () => {
  const formatter = new ResponseFormatter();

  const summary = formatter.formatTaskSummary({
    divisionId: "devops",
    workflowId: "release_wf",
    costEstimate: makeCostEstimate({ estimatedCostUsd: 5.00 }),
    riskPreview: makeRiskPreview({ overallRisk: "high" }),
    clarificationState: makeClarificationState(),
  });

  assert.ok(summary.includes("high"));
  assert.ok(summary.includes("5"));
});
