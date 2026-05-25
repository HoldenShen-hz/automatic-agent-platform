import assert from "node:assert/strict";
import test from "node:test";

import { PlatformPanicService } from "../../../../src/ops-maturity/emergency/platform-panic-service.js";
import { canResumeFromPanic, type ResumePlan } from "../../../../src/ops-maturity/emergency/resume-protocol/index.js";
import {
  HITLExplainabilityService,
  type DecisionExplanation,
} from "../../../../src/platform/five-plane-orchestration/hitl/hitl-explainability-service.js";
import { HumanTakeoverService } from "../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service.js";

test("platform panic directives support scopeRef expiry and panic drill lifecycle", () => {
  const service = new PlatformPanicService();
  const expired = service.activate({
    scope: "platform/core",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "secops",
    scopeRef: "run://core",
    expiresAt: "2000-01-01T00:00:00.000Z",
    requiredApprovers: ["secops", "platform-admin"],
  });

  assert.equal(expired.directive.scopeRef, "run://core");
  assert.equal(service.evaluateExecution({ scope: "platform/core", mode: "deploy" }).blocked, false);

  const drill = service.startDrill({
    scope: "platform/core",
    initiatedBy: "secops",
    drillType: "simulation",
    notes: "reaudit",
  });
  const completed = service.completeDrill(drill.drillId, {
    status: "completed",
    acknowledgmentsReceived: 5,
    findingsJson: JSON.stringify({ result: "ok" }),
  });

  assert.equal(completed.status, "completed");
  assert.equal(service.listDrills().length, 1);
});

test("platform panic directives treat malformed expiresAt as expired", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/core",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "secops",
    expiresAt: "invalid-date",
    requiredApprovers: ["secops", "platform-admin"],
  });

  assert.equal(service.evaluateExecution({ scope: "platform/core", mode: "deploy" }).blocked, false);
});

test("resume protocol requires canonical plan metadata before panic can clear", () => {
  const invalidPlan: ResumePlan = {
    planId: "",
    scope: "platform/core",
    scopeRef: "run://core",
    approvedBy: ["platform-admin", "security-admin"],
    approvalCount: 2,
    approvedRoles: ["platform_admin", "security_team"],
    compatibilityCheckRef: "compat-1",
    mode: "standard",
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
    createdAt: "2026-05-09T00:00:00.000Z",
  };
  const validPlan: ResumePlan = {
    ...invalidPlan,
    planId: "resume-1",
  };

  assert.equal(canResumeFromPanic(invalidPlan), false);
  assert.equal(canResumeFromPanic(validPlan), true);
});

test("HITL explainability exposes canonical decision sub-objects and remediation fields", () => {
  const service = new HITLExplainabilityService({} as never);
  const explanation: DecisionExplanation = service.generateExplanation(
    "task-1",
    "approval_required",
    [{ name: "policy", weight: 1, value: "policy.high_risk", reason: "required" }],
    {
      matchedRuleOrPolicy: "policy.high_risk",
      reasonSource: "policy_engine",
      remediationHint: "request manual approval",
      routingExplanation: {
        routeId: "route-1",
        selectedPath: "human",
        candidatePaths: ["auto", "human"],
        rationale: "high risk",
      },
      riskExplanation: {
        riskLevel: "high",
        riskDrivers: ["sensitive_data"],
        mitigationStatus: "partial",
      },
      fallbackExplanation: {
        fallbackMode: "handoff",
        trigger: "policy",
        expectedImpact: "human approval required",
      },
      takeoverJustification: {
        takeoverType: "approval_gate",
        operatorId: "operator-1",
        justification: "risk threshold exceeded",
      },
    },
  );

  assert.equal(explanation.matched_rule_or_policy, "policy.high_risk");
  assert.equal(explanation.reason_source, "policy_engine");
  assert.equal(explanation.remediation_hint, "request manual approval");
  assert.equal(explanation.routingExplanation?.selectedPath, "human");
  assert.equal(explanation.takeoverJustification?.takeoverType, "approval_gate");
});

test("human takeover actions emit feedback and incident context for manual overrides", () => {
  const events: Array<{ eventType: string; payloadJson: string }> = [];
  const snapshot = {
    task: {
      id: "task-1",
      inputJson: "{\"before\":true}",
    },
    workflow: null,
    execution: {
      id: "exec-1",
      agentId: "agent-1",
    },
    session: null,
    stepOutputs: [],
    events: [],
  };
  const service = new HumanTakeoverService({
    transaction<T>(fn: () => T): T {
      return fn();
    },
  } as never, {
    operations: {
      loadTaskSnapshot() {
        return snapshot as never;
      },
    },
    approval: {
      getTakeoverSession() {
        return {
          id: "takeover-1",
          taskId: "task-1",
          executionId: "exec-1",
          operatorId: "operator-1",
          status: "open",
        } as never;
      },
      insertOperatorAction() {},
    },
    task: {
      updateTaskInput(_taskId: string, inputJson: string) {
        snapshot.task.inputJson = inputJson;
      },
    },
    event: {
      insertEvent(event: { eventType: string; payloadJson: string }) {
        events.push(event);
      },
    },
  } as never);

  service.modifyInput({
    takeoverSessionId: "takeover-1",
    inputJson: "{\"after\":true}",
    reasonCode: "operator.fix",
  });

  const takeoverEvent = events.find((event) => event.eventType === "takeover:action_applied");
  assert.ok(takeoverEvent);
  const payload = JSON.parse(takeoverEvent!.payloadJson) as Record<string, unknown>;

  assert.equal(events.some((event) => event.eventType === "feedback:signal_received"), true);
  assert.equal(events.some((event) => event.eventType === "improve:candidate_proposed"), true);
  assert.equal((payload.manualOverride as { actionType: string }).actionType, "input_modification");
  assert.equal(((payload.incidentContextBundle as { overrideIds: string[] }).overrideIds).length, 1);
});
