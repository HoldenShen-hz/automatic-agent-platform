import assert from "node:assert/strict";
import test from "node:test";

import { HARNESS_RUN_TERMINAL_STATUSES } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { DurableHarnessService } from "../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import type { GuardrailAssessment } from "../../../../src/platform/five-plane-orchestration/harness/guardrails/guardrail-engine.js";
import { HarnessLoopController } from "../../../../src/platform/five-plane-orchestration/harness/loop/index.js";
import {
  GuardrailVibrationBreaker,
  HarnessRuntimeService,
  HitlRuntime,
  RecoveryController,
  type ConstraintPack,
  type HarnessRunRuntimeState,
} from "../../../../src/platform/five-plane-orchestration/harness/index.js";
import { LearningObjectValidator } from "../../../../src/platform/five-plane-orchestration/learn/learning-object-validator.js";
import { KnowledgePromotionService } from "../../../../src/platform/five-plane-orchestration/learn/knowledge-promotion-service.js";
import { parseLearningObject, type LearningObject } from "../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";
import type { TypedEventPublisher } from "../../../../src/platform/five-plane-state-evidence/events/typed-event-publisher.js";
import type { KnowledgePlaneService } from "../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-plane-service.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "supervised",
    tool_policy: {
      allowedTools: ["read", "summarize"],
    },
    risk_policy: {
      maxRiskScore: 70,
      escalationThreshold: 55,
    },
    output_policy: {
      requiredEvidence: [],
      redactSensitiveData: true,
    },
    budget: {
      maxSteps: 12,
      maxCost: 5,
      maxDurationMs: 60_000,
    },
    ...overrides,
  };
}

let runCounter = 0;

function createRun(overrides: Partial<HarnessRunRuntimeState> = {}): HarnessRunRuntimeState {
  runCounter += 1;
  const id = `reaudit-run-${runCounter}`;
  return {
    harnessRunId: id,
    runId: id,
    tenantId: "tenant:local",
    confirmedTaskSpecId: `confirmed_task_spec:${id}`,
    requestEnvelopeId: `request_envelope:${id}`,
    requestHash: `request_hash:${id}`,
    constraintPackRef: "constraint_pack:coding",
    versionLockId: `${id}:version_lock`,
    budgetLedgerId: `${id}:budget_ledger`,
    currentSeq: 0,
    taskId: "reaudit-task",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    planGraphBundle: {
      planGraphBundleId: `plan_graph_bundle:${id}`,
      harnessRunId: id,
      graphVersion: 1,
      graph: {
        graphId: `graph:${id}`,
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: `hash:${id}`,
      },
      schedulerPolicy: { policyId: "scheduler:harness.default", strategy: "deterministic_fifo" },
      budgetPlanRef: "budget:harness.initial",
      riskProfile: { riskClass: "medium", reasons: [] },
      validationReport: { valid: true, findings: [], normalizedNodeIds: [] },
      artifactRefs: [],
      createdAt: new Date().toISOString(),
    },
    steps: [],
    maxIterations: 10,
    currentIteration: 1,
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    pauseReason: null,
    decision: null,
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
    ...overrides,
  };
}

function createLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: overrides.learningObjectId ?? "learning-1",
    learningType: overrides.learningType ?? "failure_pattern",
    title: overrides.title ?? "Learning Title",
    summary: overrides.summary ?? "Learning summary",
    confidence: overrides.confidence ?? 0.8,
    evidenceRefs: overrides.evidenceRefs ?? ["evidence-1"],
    sourceSignalIds: overrides.sourceSignalIds ?? ["signal-1"],
    recommendation: overrides.recommendation ?? "Apply the learned pattern",
    validatedBy: overrides.validatedBy ?? "evidence",
    promotionStatus: overrides.promotionStatus ?? "validated",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

function createKnowledgePlane(): KnowledgePlaneService {
  return {
    ingest(input: { title: string; body: string; namespace: string }) {
      return {
        source: {
          sourceId: "source-1",
          trustLevel: "team_reviewed",
          ingestedAt: new Date().toISOString(),
        },
        document: {
          documentId: `doc-${input.title}`,
          sourceId: "source-1",
          title: input.title,
          version: 1,
          tags: [],
          domainScope: [],
          status: "indexed",
          namespace: input.namespace,
          mimeType: "text/plain",
          rawText: input.body,
          structuredText: null,
          archived: false,
          archivedAt: null,
        },
        chunks: [],
      };
    },
  } as unknown as KnowledgePlaneService;
}

test("R23-33: HitlRuntime supports edit, delegate, and escalate actions", () => {
  const runtime = new HitlRuntime();

  const editRequest = runtime.open({
    runId: "run-hitl-edit",
    domainId: "coding",
    reason: "edit needed",
    evidenceRefs: ["e1"],
  });
  const edited = runtime.edit(editRequest.requestId, "human:editor", { file: "patch.diff" }, "manual_edit");
  assert.equal(edited.request.mode, "edit");
  assert.equal(edited.request.status, "completed");
  assert.equal(edited.record.action, "edit");

  const delegateRequest = runtime.open({
    runId: "run-hitl-delegate",
    domainId: "coding",
    reason: "delegate review",
    evidenceRefs: ["e2"],
  });
  const delegated = runtime.delegate(delegateRequest.requestId, "human:lead", "human:sre", "delegate_review");
  assert.equal(delegated.request.mode, "delegate");
  assert.equal(delegated.request.status, "paused");
  assert.equal(delegated.record.action, "delegate");

  const escalateRequest = runtime.open({
    runId: "run-hitl-escalate",
    domainId: "coding",
    reason: "escalate decision",
    evidenceRefs: ["e3"],
  });
  const escalated = runtime.escalate(escalateRequest.requestId, "human:reviewer", "policy_escalation");
  assert.equal(escalated.request.mode, "escalate");
  assert.equal(escalated.request.status, "paused");
  assert.equal(escalated.record.action, "escalate");
});

test("R23-34: HitlRuntime resolve rejects double resolution", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-hitl-idempotent",
    domainId: "coding",
    reason: "approval",
    evidenceRefs: ["e1"],
  });

  runtime.resolve(request.requestId, "approved", "human:approver");

  assert.throws(
    () => runtime.resolve(request.requestId, "rejected", "human:approver"),
    /harness\.hitl\.request_already_resolved/,
  );
});

test("R23-35: RecoveryController enforces retry budget exhaustion for transient failures", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);
  const exhaustedLease = {
    leaseId: "lease-exhausted",
    runId: "reaudit-run-exhausted",
    reason: "retry",
    resumeAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    retryAttempt: 5,
  };

  const llmResult = controller.handleFailure({
    ...runtime.createRun({
      taskId: "reaudit-llm",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    }),
    sleepLease: exhaustedLease,
  }, "llm_provider_unavailable");
  const workerResult = controller.handleFailure({
    ...runtime.createRun({
      taskId: "reaudit-worker",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    }),
    sleepLease: exhaustedLease,
  }, "worker_crash");

  assert.equal(llmResult.pauseReason, "hitl");
  assert.ok(llmResult.hitlRequest != null);
  assert.equal(workerResult.pauseReason, "hitl");
  assert.ok(workerResult.hitlRequest != null);
});

test("R23-36: RecoveryController records tool_timeout retries before sleeping", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const published: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const publisher: TypedEventPublisher = {
    publish(event) {
      published.push(event as { eventType: string; payload: Record<string, unknown> });
    },
  } as TypedEventPublisher;
  const customLoop = new HarnessLoopController(createConstraintPack(), {}, {
    retryAttempt: 1,
    lastRetryAt: Date.now() - 5_000,
  });
  const controller = new RecoveryController(durableService, runtime, customLoop, publisher);

  const result = controller.handleFailure(runtime.createRun({
    taskId: "reaudit-timeout",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  }), "tool_timeout");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "sleep");
  assert.ok(result.sleepLease?.reason.includes("tool_timeout"));
  assert.ok(published.some((event) => event.eventType === "recovery:repair_applied"));
  assert.ok(published.some((event) => event.payload.reasonCode === "tool_timeout"));
});

test("R23-37: LearningObject lifecycle supports quarantine, validating, and quarantined states", () => {
  const parsedDefault = parseLearningObject({
    ...createLearningObject({ learningObjectId: "lo-default" }),
    promotionStatus: undefined,
  });
  assert.equal(parsedDefault.promotionStatus, "quarantine");

  const validator = new LearningObjectValidator();
  const validated = validator.validate(createLearningObject({
    learningObjectId: "lo-validated",
    promotionStatus: "quarantine",
  }));
  assert.equal(validated.learningObject.promotionStatus, "validated");

  const quarantined = validator.validate(createLearningObject({
    learningObjectId: "lo-quarantine-legacy",
    promotionStatus: "quarantine",
    evidenceRefs: [],
  }));
  assert.equal(quarantined.learningObject.promotionStatus, "quarantined");
});

test("R23-38: LearningObjectValidator quarantines PII and secret tainted content", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate(createLearningObject({
    learningObjectId: "lo-pii",
    summary: "Customer email is alice@example.com and SSN is 123-45-6789",
    recommendation: "password=secret123",
  }));

  assert.equal(result.valid, false);
  assert.equal(result.learningObject.promotionStatus, "quarantined");
  assert.equal(result.reasonCode, "learning.pii_secret_detected");
});

test("R23-39: HarnessRunStatus exposes cancelled and HITL rejection resolves to cancelled", () => {
  assert.ok(HARNESS_RUN_TERMINAL_STATUSES.includes("cancelled"));

  const service = new HarnessRuntimeService();
  const paused = service.openHitlReview(
    service.createRun({
      taskId: "task-cancelled",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    }),
    "manual review",
    ["e1"],
  );
  const cancelled = service.resolveHitlReview(paused, "rejected", "human:approver");

  assert.equal(cancelled.status, "cancelled");
  assert.ok(cancelled.completedAt != null);
});

test("R23-40: GuardrailVibrationBreaker trips on alternating signatures inside a time window", () => {
  const breaker = new GuardrailVibrationBreaker(2, 10_000, 5_000);
  let state = { guardrailActionCount: 0, lastGuardrailSignature: null, guardrailCooldownUntilMs: null, recentSignals: [] };

  state = breaker.evaluate({ runId: "run-breaker", signature: "retry_same_plan", observedAtMs: 1_000 }, state).state;
  state = breaker.evaluate({ runId: "run-breaker", signature: "escalate_to_human", observedAtMs: 2_000 }, state).state;
  const decision = breaker.evaluate({ runId: "run-breaker", signature: "retry_same_plan", observedAtMs: 3_000 }, state);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "guardrail.cooldown");
});

test("R23-41: HarnessRuntimeService integrates the vibration breaker into runLoop", () => {
  const assessment: GuardrailAssessment = {
    passed: false,
    requiresHuman: false,
    suggestedAction: "retry_same_plan",
    findings: [],
  };
  const service = new HarnessRuntimeService({
    guardrailEngine: {
      assess() {
        return assessment;
      },
    } as any,
    vibrationBreaker: new GuardrailVibrationBreaker(0, 60_000, 60_000),
  });

  const run = service.runLoop({
    taskId: "task-vibration",
    domainId: "coding",
    constraintPack: createConstraintPack({
      budget: {
        maxSteps: 15,
        maxCost: 5,
        maxDurationMs: 60_000,
      },
    }),
    plannerOutput: { planId: "plan-vibration" },
    generatorOutput: { artifact: "draft.patch" },
    evaluatorOutput: { verdict: "retry" },
    evaluatorScore: 0.45,
  });

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "hitl");
  assert.equal(run.hitlRequest?.reason, "guardrail_vibration_detected");
});

test("R23-42: KnowledgePromotionService enforces approval gates for sync and async promotion", async () => {
  const blockedService = new KnowledgePromotionService({
    knowledgePlane: createKnowledgePlane(),
    requireApproval: true,
    approvalGate: () => false,
  });
  const blocked = blockedService.promote([createLearningObject({ learningObjectId: "lo-blocked" })], "task-blocked");
  assert.deepEqual(blocked, { promotedCount: 0, failedCount: 0, knowledgeDocumentIds: [] });

  const asyncService = new KnowledgePromotionService({
    knowledgePlane: createKnowledgePlane(),
    requireApproval: true,
    approvalGate: async () => true,
  });
  const promoted = await asyncService.promoteAsync([createLearningObject({ learningObjectId: "lo-approved" })], "task-approved");
  assert.equal(promoted.promotedCount, 1);
  assert.deepEqual(promoted.knowledgeDocumentIds, ["doc-Learning Title"]);
  assert.throws(
    () => asyncService.promote([createLearningObject({ learningObjectId: "lo-sync-denied" })], "task-sync"),
    /knowledge_promotion\.approval_gate_async_requires_promote_async/,
  );
});
