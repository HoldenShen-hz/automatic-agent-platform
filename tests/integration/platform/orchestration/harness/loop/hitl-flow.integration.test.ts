/**
 * Integration Test: Harness HITL Flow
 *
 * Tests human-in-the-loop integration:
 * - runLoop with requiresHuman=true -> waiting_hitl -> resolveHitlReview(approved/rejected)
 * - Multiple HITL resolution scenarios
 * - HITL state transitions and persistence
 *
 * Uses in-memory SQLite and temp directories for integration testing.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createIntegrationContext } from "../../../../../helpers/integration-context.js";
import {
  HarnessRuntimeService,
  HitlRuntime,
  type ConstraintPack,
  type HarnessTimelineEvent,
} from "../../../../../../src/platform/orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.hitl.test"],
    approvalMode: "required",
    autonomyMode: "supervised",
    toolPolicy: {
      allowedTools: ["read", "write", "bash", "delete"],
    },
    risk_policy: {
      maxRiskScore: 80,
      escalationThreshold: 50,
    },
    output_policy: {
      requiredEvidence: ["security_scan", "code_review"],
      redactSensitiveData: true,
    },
    budget: {
      maxSteps: 12,
      maxCost: 5.0,
      maxDurationMs: 120_000,
    },
    ...overrides,
  };
}

test("runLoop with requiresHuman=true transitions to waiting_hitl status", () => {
  const ctx = createIntegrationContext("aa-hitl-requires-human-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-hitl-human-001",
      domainId: "security",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-security-001" },
      generatorOutput: { artifact: "security-config.json" },
      evaluatorOutput: { verdict: "needs-review" },
      evaluatorScore: 0.78,
      requiresHuman: true,
      producedEvidenceRefs: ["security_scan"],
    });

    assert.equal(run.status, "waiting_hitl");
    assert.equal(run.decision?.action, "escalate_to_human");
    assert.ok(run.hitlRequest);
    assert.equal(run.hitlRequest?.runId, run.runId);
    assert.equal(run.hitlRequest?.domainId, "security");
    assert.equal(run.hitlRequest?.status, "pending");
    assert.ok(run.hitlRequest?.evidenceRefs.includes("security_scan"));
  } finally {
    ctx.cleanup();
  }
});

test("resolveHitlReview with approved resumes the run", () => {
  const ctx = createIntegrationContext("aa-hitl-approve-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-hitl-approve-001",
      domainId: "legal",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-legal-001" },
      generatorOutput: { artifact: "contract-review.pdf" },
      evaluatorOutput: { verdict: "needs-approval" },
      evaluatorScore: 0.82,
      requiresHuman: true,
      producedEvidenceRefs: [],
    });

    assert.equal(run.status, "waiting_hitl");
    assert.ok(run.hitlRequest);

    const approved = service.resolveHitlReview(run, "approved", "legal_manager_jane");

    assert.equal(approved.status, "running");
    assert.equal(approved.hitlRequest?.status, "approved");
    assert.equal(approved.hitlRequest?.resolvedBy, "legal_manager_jane");
    assert.ok(approved.hitlRequest?.resolvedAt);
    assert.equal(approved.completedAt, null); // Resumed runs should not have completedAt

    // Verify HITL resolution timeline event
    const hitlResolvedEvent = approved.timeline.find((e: HarnessTimelineEvent) => e.type === "hitl_resolved");
    assert.ok(hitlResolvedEvent);
    assert.deepEqual(hitlResolvedEvent.payload, {
      resolution: "approved",
      actorId: "legal_manager_jane",
    });
  } finally {
    ctx.cleanup();
  }
});

test("resolveHitlReview with rejected aborts the run", () => {
  const ctx = createIntegrationContext("aa-hitl-reject-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-hitl-reject-001",
      domainId: "security",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-security-reject" },
      generatorOutput: { artifact: "firewall-config.json" },
      evaluatorOutput: { verdict: "needs-review" },
      evaluatorScore: 0.75,
      requiresHuman: true,
      producedEvidenceRefs: [],
      riskScore: 65,
    });

    assert.equal(run.status, "waiting_hitl");
    const rejected = service.resolveHitlReview(run, "rejected", "security_admin");

    assert.equal(rejected.status, "aborted");
    assert.equal(rejected.hitlRequest?.status, "rejected");
    assert.equal(rejected.hitlRequest?.resolvedBy, "security_admin");
    assert.ok(rejected.hitlRequest?.resolvedAt);
    assert.ok(rejected.completedAt); // Aborted runs should have completedAt

    // Verify HITL resolution timeline event
    const hitlResolvedEvent = rejected.timeline.find((e: HarnessTimelineEvent) => e.type === "hitl_resolved");
    assert.ok(hitlResolvedEvent);
    assert.deepEqual(hitlResolvedEvent.payload, {
      resolution: "rejected",
      actorId: "security_admin",
    });
  } finally {
    ctx.cleanup();
  }
});

test("openHitlReview and resolveHitlReview can be called manually", () => {
  const ctx = createIntegrationContext("aa-hitl-manual-");
  try {
    const service = new HarnessRuntimeService();

    let run = service.createRun({
      taskId: "task-hitl-manual-001",
      domainId: "compliance",
      constraintPack: createConstraintPack(),
    });

    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: "task-hitl-manual-001" },
      outputs: { planId: "plan-compliance-001" },
    });

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: { planId: "plan-compliance-001" },
      outputs: { artifact: "compliance-report.pdf" },
    });

    // Manually open HITL review
    run = service.openHitlReview(run, "Compliance checkpoint requires approval", [
      "security_scan_001",
      "code_review_001",
      "legal_sign_off",
    ]);

    assert.equal(run.status, "waiting_hitl");
    assert.ok(run.hitlRequest);
    assert.equal(run.hitlRequest?.reason, "Compliance checkpoint requires approval");
    assert.equal(run.hitlRequest?.evidenceRefs.length, 3);

    // Resolve as approved
    const approved = service.resolveHitlReview(run, "approved", "compliance_officer");
    assert.equal(approved.status, "running");
    assert.equal(approved.hitlRequest?.status, "approved");
  } finally {
    ctx.cleanup();
  }
});

test("resolveHitlReview throws when run has no hitlRequest", () => {
  const ctx = createIntegrationContext("aa-hitl-error-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.createRun({
      taskId: "task-hitl-no-request-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    });

    assert.throws(
      () => service.resolveHitlReview(run, "approved", "someone"),
      /harness\.hitl\.request_not_found/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("HITL run persists correctly after opening review", () => {
  const ctx = createIntegrationContext("aa-hitl-persist-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-hitl-persist-001",
      domainId: "security",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-persist-001" },
      generatorOutput: { artifact: "secure-config.json" },
      evaluatorOutput: { verdict: "needs-review" },
      evaluatorScore: 0.8,
      requiresHuman: true,
      producedEvidenceRefs: [],
    });

    assert.equal(run.status, "waiting_hitl");

    // Persist the run
    const persisted = service.persistRun(run);
    assert.equal(persisted.run.runId, run.runId);
    assert.equal(persisted.run.status, "waiting_hitl");

    // Restore and verify
    const restored = service.restoreRun(run.runId);
    assert.ok(restored);
    assert.equal(restored.status, "waiting_hitl");
    assert.ok(restored.hitlRequest);
    assert.equal(restored.hitlRequest?.status, "pending");
  } finally {
    ctx.cleanup();
  }
});

test("HITL with high riskScore triggers escalation via guardrail", () => {
  const ctx = createIntegrationContext("aa-hitl-risk-");
  try {
    const service = new HarnessRuntimeService();

    // Use a constraint pack with lower escalation threshold to trigger via risk
    const run = service.runLoop({
      taskId: "task-hitl-risk-001",
      domainId: "security",
      constraintPack: createConstraintPack({
        risk_policy: {
          maxRiskScore: 80,
          escalationThreshold: 50, // Low threshold
        },
      }),
      plannerOutput: { planId: "plan-risk-001" },
      generatorOutput: { artifact: "firewall-rule.json" },
      evaluatorOutput: { verdict: "needs-review" },
      evaluatorScore: 0.75,
      riskScore: 60, // Above escalationThreshold but below maxRiskScore
      producedEvidenceRefs: ["security_scan", "code_review"], // Include required evidence
    });

    // Risk score at escalation threshold should trigger warning that requires human
    assert.ok(run.guardrailAssessment);
    assert.equal(run.guardrailAssessment.passed, true); // Still passed - no blocker

    // Run should be waiting_hitl due to guardrail assessment requiring human
    assert.equal(run.status, "waiting_hitl");
    assert.equal(run.decision?.action, "escalate_to_human");
  } finally {
    ctx.cleanup();
  }
});

test("HITL with blocked tools returns abort instead of waiting_hitl", () => {
  const ctx = createIntegrationContext("aa-hitl-blocked-");
  try {
    const service = new HarnessRuntimeService();

    // Use a constraint pack that blocks the requested tool
    const run = service.runLoop({
      taskId: "task-hitl-blocked-001",
      domainId: "security",
      constraintPack: createConstraintPack({
        toolPolicy: {
          allowedTools: ["read"], // Only read is allowed
        },
      }),
      plannerOutput: { planId: "plan-blocked-001" },
      generatorOutput: { artifact: "secure-delete.json" },
      evaluatorOutput: { verdict: "needs-review" },
      evaluatorScore: 0.8,
      requiresHuman: true,
      requestedTools: ["delete"], // Requesting blocked tool
      producedEvidenceRefs: [],
    });

    // Should abort because blocked tools are a blocker
    assert.ok(run.guardrailAssessment);
    assert.equal(run.guardrailAssessment.passed, false);
    assert.equal(run.guardrailAssessment.suggestedAction, "abort");
    assert.equal(run.status, "aborted");
  } finally {
    ctx.cleanup();
  }
});

test("HITL timeline records all relevant events", () => {
  const ctx = createIntegrationContext("aa-hitl-timeline-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-hitl-timeline-001",
      domainId: "legal",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-timeline-001" },
      generatorOutput: { artifact: "contract.pdf" },
      evaluatorOutput: { verdict: "needs-approval" },
      evaluatorScore: 0.8,
      requiresHuman: true,
      producedEvidenceRefs: [],
    });

    // Verify timeline contains expected events
    const eventTypes = run.timeline.map((e: HarnessTimelineEvent) => e.type);

    assert.ok(eventTypes.includes("run_created"));
    assert.ok(eventTypes.includes("step_completed"));
    assert.ok(eventTypes.includes("guardrails_evaluated"));
    assert.ok(eventTypes.includes("decision_recorded"));
    assert.ok(eventTypes.includes("hitl_requested"));

    // Find the hitl_requested event
    const hitlRequestedEvent = run.timeline.find((e: HarnessTimelineEvent) => e.type === "hitl_requested");
    assert.ok(hitlRequestedEvent);
    assert.ok(hitlRequestedEvent.payload.reason);
    assert.ok(typeof hitlRequestedEvent.payload.evidenceCount === "number");
  } finally {
    ctx.cleanup();
  }
});

test("HITL with multiple evidence refs preserves all references", () => {
  const ctx = createIntegrationContext("aa-hitl-evidence-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-hitl-evidence-001",
      domainId: "compliance",
      constraintPack: createConstraintPack({
        output_policy: {
          requiredEvidence: [],
          redactSensitiveData: true,
        },
      }),
      plannerOutput: { planId: "plan-evidence-001" },
      generatorOutput: { artifact: "compliance-report.pdf" },
      evaluatorOutput: { verdict: "needs-review" },
      evaluatorScore: 0.78,
      requiresHuman: true,
      producedEvidenceRefs: [
        "security_scan_result",
        "code_review_result",
        "legal_sign_off",
        "manager_approval",
        "audit_log",
      ],
    });

    assert.equal(run.status, "waiting_hitl");
    assert.ok(run.hitlRequest);
    assert.equal(run.hitlRequest?.evidenceRefs.length, 5);
    assert.ok(run.hitlRequest?.evidenceRefs.includes("security_scan_result"));
    assert.ok(run.hitlRequest?.evidenceRefs.includes("code_review_result"));
    assert.ok(run.hitlRequest?.evidenceRefs.includes("legal_sign_off"));
    assert.ok(run.hitlRequest?.evidenceRefs.includes("manager_approval"));
    assert.ok(run.hitlRequest?.evidenceRefs.includes("audit_log"));
  } finally {
    ctx.cleanup();
  }
});

test("Separate HitlRuntime instances maintain isolated request state", () => {
  const ctx = createIntegrationContext("aa-hitl-isolate-");
  try {
    const hitlRuntime1 = new HitlRuntime();
    const hitlRuntime2 = new HitlRuntime();

    // Open requests in separate instances
    const request1 = hitlRuntime1.open({
      runId: "run-1",
      domainId: "domain1",
      reason: "First request",
      evidenceRefs: ["evidence-1"],
    });

    const request2 = hitlRuntime2.open({
      runId: "run-2",
      domainId: "domain2",
      reason: "Second request",
      evidenceRefs: ["evidence-2"],
    });

    // Verify isolation - each runtime only has its own requests
    assert.ok(hitlRuntime1.get(request1.requestId));
    assert.equal(hitlRuntime1.get(request2.requestId), null); // Not in runtime1

    assert.ok(hitlRuntime2.get(request2.requestId));
    assert.equal(hitlRuntime2.get(request1.requestId), null); // Not in runtime2

    // Resolve in one runtime doesn't affect the other
    const resolved1 = hitlRuntime1.resolve(request1.requestId, "approved", "actor-1");
    assert.equal(resolved1.status, "approved");
    assert.equal(hitlRuntime2.get(request1.requestId), null); // Still not in runtime2
  } finally {
    ctx.cleanup();
  }
});

test("HITL approved run can be checkpointed and restored", () => {
  const ctx = createIntegrationContext("aa-hitl-cp-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-hitl-cp-001",
      domainId: "legal",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-cp-001" },
      generatorOutput: { artifact: "contract.pdf" },
      evaluatorOutput: { verdict: "needs-approval" },
      evaluatorScore: 0.8,
      requiresHuman: true,
      producedEvidenceRefs: [],
    });

    // Approve the run
    const approved = service.resolveHitlReview(run, "approved", "legal_manager");

    // Checkpoint and restore
    const checkpointRef = service.checkpointRun(approved);
    assert.equal(typeof checkpointRef, "string");

    const restored = service.restoreFromCheckpoint(checkpointRef);
    assert.ok(restored);
    assert.equal(restored.status, "running"); // After approval, status is "running"
    assert.equal(restored.hitlRequest?.status, "approved");
  } finally {
    ctx.cleanup();
  }
});
