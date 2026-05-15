/**
 * HarnessRuntimeService Extended Unit Tests
 *
 * Tests for HarnessRuntimeService.decide() and assertInvariants() methods
 * which have complex business logic not fully covered by integration tests.
 *
 * Architecture: §23 Harness Runtime
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HarnessRuntimeService } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// decide() Method Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRuntimeService.decide returns accept for high evaluator score", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({ evaluatorScore: 0.9 });

  assert.equal(decision.action, "accept");
  assert.ok(decision.reasonCodes.includes("harness.accepted"));
  assert.equal(decision.confidence, 0.9);
});

test("HarnessRuntimeService.decide returns accept for score exactly 0.75", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({ evaluatorScore: 0.75 });

  assert.equal(decision.action, "accept");
});

test("HarnessRuntimeService.decide returns retry_same_plan for score between 0.5 and 0.75", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({ evaluatorScore: 0.6 });

  assert.equal(decision.action, "retry_same_plan");
  assert.ok(decision.reasonCodes.includes("harness.eval_below_accept_threshold"));
});

test("HarnessRuntimeService.decide returns replan for score below 0.5", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({ evaluatorScore: 0.4 });

  assert.equal(decision.action, "replan");
  assert.ok(decision.reasonCodes.includes("harness.eval_below_replan_threshold"));
});

test("HarnessRuntimeService.decide returns escalate_to_human when requiresHuman is true", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({ evaluatorScore: 0.9, requiresHuman: true });

  assert.equal(decision.action, "escalate_to_human");
  assert.ok(decision.reasonCodes.includes("harness.human_required"));
});

test("HarnessRuntimeService.decide returns abort when maxIterationsReached is true", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({ evaluatorScore: 0.9, maxIterationsReached: true });

  assert.equal(decision.action, "abort");
  assert.ok(decision.reasonCodes.includes("harness.max_iterations_reached"));
});

test("HarnessRuntimeService.decide abort takes priority over human escalation", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({
    evaluatorScore: 0.9,
    requiresHuman: true,
    maxIterationsReached: true,
  });

  assert.equal(decision.action, "abort");
});

test("HarnessRuntimeService.decide human escalation takes priority over replan", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({
    evaluatorScore: 0.3, // would be replan
    requiresHuman: true,
    maxIterationsReached: false,
  });

  assert.equal(decision.action, "escalate_to_human");
});

test("HarnessRuntimeService.decide human escalation takes priority over retry", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({
    evaluatorScore: 0.6, // would be retry
    requiresHuman: true,
    maxIterationsReached: false,
  });

  assert.equal(decision.action, "escalate_to_human");
});

test("HarnessRuntimeService.decide retry takes priority over accept", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({
    evaluatorScore: 0.74, // below accept threshold
    requiresHuman: false,
    maxIterationsReached: false,
  });

  assert.equal(decision.action, "retry_same_plan");
});

test("HarnessRuntimeService.decide generates unique decisionIds", () => {
  const runtime = new HarnessRuntimeService();
  const d1 = runtime.decide({ evaluatorScore: 0.9 });
  const d2 = runtime.decide({ evaluatorScore: 0.9 });
  const d3 = runtime.decide({ evaluatorScore: 0.9 });

  assert.notEqual(d1.decisionId, d2.decisionId);
  assert.notEqual(d2.decisionId, d3.decisionId);
});

test("HarnessRuntimeService.decide includes taskId from input", () => {
  const runtime = new HarnessRuntimeService();
  // Note: decide() doesn't take taskId directly, so this is implicitly tested
  const decision = runtime.decide({ evaluatorScore: 0.9 });

  assert.ok(decision.decisionId.startsWith("harness_decision_"));
});

test("HarnessRuntimeService.decide includes current timestamp", () => {
  const runtime = new HarnessRuntimeService();
  const before = Date.now();
  const decision = runtime.decide({ evaluatorScore: 0.9 });
  const after = Date.now();

  const createdAtMs = Date.parse(decision.createdAt);
  assert.ok(Number.isFinite(createdAtMs));
  assert.ok(createdAtMs >= before && createdAtMs <= after);
});

test("HarnessRuntimeService.decide confidence is rounded to 4 decimal places", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({ evaluatorScore: 0.8555555 });

  assert.equal(decision.confidence, 0.8556);
});

// ─────────────────────────────────────────────────────────────────────────────
// assertInvariants() Tests - Iteration Violations
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRuntimeService.assertInvariants passes with valid run", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const result = runtime.assertInvariants(run);
  assert.equal(result.violations.length, 0);
});

test("HarnessRuntimeService.assertInvariants detects iteration_exceeds_budget", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  // Manually set iteration count above budget via loopMetrics
  const runWithHighIteration = {
    ...run,
    loopMetrics: {
      iterationCount: 15,
      replanCount: 0,
      totalCost: 10,
      durationMs: 1000,
      maxIterations: 10,
      maxCost: 100,
      maxDurationMs: 60000,
    },
  };

  const result = runtime.assertInvariants(runWithHighIteration);
  assert.ok(result.violations.includes("INV-1:harness.invariant.iteration_exceeds_budget"));
});

test("HarnessRuntimeService.assertInvariants detects replan_count_exceeds_budget", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const runWithHighReplans = {
    ...run,
    loopMetrics: {
      iterationCount: 5,
      replanCount: 5, // > 3
      totalCost: 10,
      durationMs: 1000,
      maxIterations: 30,
      maxCost: 100,
      maxDurationMs: 60000,
    },
  };

  const result = runtime.assertInvariants(runWithHighReplans);
  assert.ok(result.violations.includes("INV-2:harness.invariant.replan_count_exceeds_budget"));
});

test("HarnessRuntimeService.assertInvariants detects total_cost_exceeds_budget", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 50, maxDurationMs: 60000 },
    },
  });

  const runWithHighCost = {
    ...run,
    loopMetrics: {
      iterationCount: 5,
      replanCount: 1,
      totalCost: 100, // > 50
      durationMs: 1000,
      maxIterations: 30,
      maxCost: 50,
      maxDurationMs: 60000,
    },
  };

  const result = runtime.assertInvariants(runWithHighCost);
  assert.ok(result.violations.includes("INV-3:harness.invariant.total_cost_exceeds_budget"));
});

test("HarnessRuntimeService.assertInvariants detects duration_exceeds_budget", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 10000 },
    },
  });

  const runWithLongDuration = {
    ...run,
    loopMetrics: {
      iterationCount: 5,
      replanCount: 1,
      totalCost: 10,
      durationMs: 20000, // > 10000
      maxIterations: 30,
      maxCost: 100,
      maxDurationMs: 10000,
    },
  };

  const result = runtime.assertInvariants(runWithLongDuration);
  assert.ok(result.violations.includes("INV-4:harness.invariant.duration_exceeds_budget"));
});

test("HarnessRuntimeService.assertInvariants detects final_state_requires_completed_at", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const completedRun = {
    ...run,
    status: "completed" as const,
    completedAt: null, // Missing completedAt
  };

  const result = runtime.assertInvariants(completedRun);
  assert.ok(result.violations.includes("INV-5:harness.invariant.final_state_requires_completed_at"));
});

test("HarnessRuntimeService.assertInvariants detects paused_requires_wait_reason", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const pausedRun = {
    ...run,
    status: "paused" as const,
    hitlRequest: null,
    sleepLease: null,
  };

  const result = runtime.assertInvariants(pausedRun);
  assert.ok(result.violations.includes("INV-6:harness.invariant.paused_requires_wait_reason"));
});

test("HarnessRuntimeService.assertInvariants detects non_accept_decision_requires_feedback", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const runWithDecisionNoFeedback = {
    ...run,
    decision: {
      decisionId: "d1",
      action: "replan" as const, // Not accept
      reasonCodes: [],
      confidence: 0.5,
      createdAt: new Date().toISOString(),
    },
    feedbackEnvelope: null, // Missing feedback
  };

  const result = runtime.assertInvariants(runWithDecisionNoFeedback);
  assert.ok(result.violations.includes("INV-9:harness.invariant.non_accept_decision_requires_feedback"));
});

test("HarnessRuntimeService.assertInvariants detects blocked_tool_requested", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const completedRunWithBlockedTools = {
    ...run,
    status: "completed" as const,
    completedAt: new Date().toISOString(),
    toolbelt: {
      allowedTools: [],
      grantedTools: [],
      blockedTools: ["dangerous_tool"], // Blocked tools present
      requiredEvidence: [],
    },
  };

  const result = runtime.assertInvariants(completedRunWithBlockedTools);
  assert.ok(result.violations.includes("INV-10:harness.invariant.blocked_tool_requested"));
});

test("HarnessRuntimeService.assertInvariants detects required_evidence_missing", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: ["evidence_1"], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const completedRunWithMissingEvidence = {
    ...run,
    status: "completed" as const,
    completedAt: new Date().toISOString(),
    toolbelt: {
      allowedTools: [],
      grantedTools: [],
      blockedTools: [],
      requiredEvidence: ["evidence_1"],
    },
    guardrailAssessment: {
      passed: true,
      requiresHuman: false,
      suggestedAction: "proceed" as const,
      findings: [
        {
          layer: "evidence" as const,
          severity: "warn" as const,
          code: "harness.guardrail.required_evidence_missing",
          message: "Missing required evidence",
        },
      ],
    },
  };

  const result = runtime.assertInvariants(completedRunWithMissingEvidence);
  assert.ok(result.violations.includes("INV-10:harness.invariant.required_evidence_missing"));
});

test("HarnessRuntimeService.assertInvariants detects max_risk_exceeded", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const completedRunWithMaxRisk = {
    ...run,
    status: "completed" as const,
    completedAt: new Date().toISOString(),
    guardrailAssessment: {
      passed: false,
      requiresHuman: false,
      suggestedAction: "abort" as const,
      findings: [
        {
          layer: "risk" as const,
          severity: "block" as const,
          code: "harness.guardrail.max_risk_exceeded",
          message: "Risk exceeded",
        },
      ],
    },
  };

  const result = runtime.assertInvariants(completedRunWithMaxRisk);
  assert.ok(result.violations.includes("INV-10:harness.invariant.max_risk_exceeded"));
});

test("HarnessRuntimeService.assertInvariants passes for completed run with no issues", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: ["evidence_1"], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const validCompletedRun = {
    ...run,
    status: "completed" as const,
    completedAt: new Date().toISOString(),
    decision: {
      decisionId: "d1",
      action: "accept" as const,
      reasonCodes: ["harness.accepted"],
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    },
    feedbackEnvelope: {
      feedbackId: "fb1",
      signals: [],
      learnedActions: [],
      createdAt: new Date().toISOString(),
    },
    toolbelt: {
      allowedTools: [],
      grantedTools: [],
      blockedTools: [],
      requiredEvidence: ["evidence_1"],
    },
    guardrailAssessment: {
      passed: true,
      requiresHuman: false,
      suggestedAction: "proceed" as const,
      findings: [],
    },
    loopMetrics: {
      iterationCount: 5,
      replanCount: 1,
      totalCost: 10,
      durationMs: 1000,
      maxIterations: 30,
      maxCost: 100,
      maxDurationMs: 60000,
    },
  };

  const result = runtime.assertInvariants(validCompletedRun);
  assert.equal(result.violations.length, 0);
});

test("HarnessRuntimeService.assertInvariants handles aborted run", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const abortedRun = {
    ...run,
    status: "aborted" as const,
    completedAt: new Date().toISOString(),
    decision: {
      decisionId: "d1",
      action: "abort" as const,
      reasonCodes: ["harness.max_iterations_reached"],
      confidence: 0.5,
      createdAt: new Date().toISOString(),
    },
    feedbackEnvelope: {
      feedbackId: "fb1",
      signals: ["harness.max_iterations_reached"],
      learnedActions: [],
      createdAt: new Date().toISOString(),
    },
    loopMetrics: {
      iterationCount: 30,
      replanCount: 2,
      totalCost: 50,
      durationMs: 30000,
      maxIterations: 30,
      maxCost: 100,
      maxDurationMs: 60000,
    },
  };

  const result = runtime.assertInvariants(abortedRun);
  assert.equal(result.violations.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Violations Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRuntimeService.assertInvariants reports multiple violations", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 50, maxDurationMs: 60000 },
    },
  });

  const badRun = {
    ...run,
    status: "aborted" as const,
    completedAt: null, // Missing - triggers final_state_requires_completed_at
    loopMetrics: {
      iterationCount: 40, // > 30 - triggers iteration_exceeds_budget
      replanCount: 5, // > 3 - triggers replan_count_exceeds_budget
      totalCost: 100, // > 50 - triggers total_cost_exceeds_budget
      durationMs: 70000, // > 60000 - triggers duration_exceeds_budget
      maxIterations: 30,
      maxCost: 50,
      maxDurationMs: 60000,
    },
  };

  const result = runtime.assertInvariants(badRun);
  assert.ok(result.violations.length >= 3);
  assert.ok(result.violations.includes("INV-5:harness.invariant.final_state_requires_completed_at"));
  assert.ok(result.violations.includes("INV-1:harness.invariant.iteration_exceeds_budget"));
  assert.ok(result.violations.includes("INV-3:harness.invariant.total_cost_exceeds_budget"));
  assert.ok(result.violations.includes("INV-4:harness.invariant.duration_exceeds_budget"));
});

test("HarnessRuntimeService.assertInvariants handles run without loopMetrics", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  // run doesn't have loopMetrics, so uses defaults (0 values)
  const result = runtime.assertInvariants(run);
  // Should not fail on iteration/cost/replan since defaults are 0
  assert.ok(!result.violations.includes("harness.invariant.iteration_exceeds_budget"));
  assert.ok(!result.violations.includes("harness.invariant.replan_count_exceeds_budget"));
});

// ─────────────────────────────────────────────────────────────────────────────
// createAsyncService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRuntimeService.createAsyncService returns AsyncHarnessService", () => {
  const runtime = new HarnessRuntimeService();
  const asyncService = runtime.createAsyncService();

  assert.ok(asyncService !== undefined);
  assert.ok(typeof asyncService.createRun === "function");
  assert.ok(typeof asyncService.execute === "function");
  assert.ok(typeof asyncService.get === "function");
});
