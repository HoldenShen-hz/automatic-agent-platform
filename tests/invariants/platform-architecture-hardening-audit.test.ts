import { strict as assert } from "node:assert";
import test from "node:test";

import { EndpointClassAdmissionController } from "../../src/platform/execution/dispatcher/endpoint-class-admission.js";
import { BoundedDispatchQueueEventFactory } from "../../src/platform/execution/queue/bounded-dispatch-event.js";
import { BudgetReservationSweeper } from "../../src/platform/execution/budget-reservation-sweeper.js";
import { PluginCrashCleanupHook } from "../../src/platform/execution/plugin-executor/plugin-crash-cleanup.js";
import { ReplayBoundaryGuard } from "../../src/platform/execution/recovery/replay-boundary-guard.js";
import { ResumeCompatibilityCheck } from "../../src/platform/execution/recovery/resume-compatibility-check.js";
import { RunTerminationCleanup } from "../../src/platform/execution/run-termination-cleanup.js";
import { WorkerDrainProtocol } from "../../src/platform/execution/worker-pool/worker-drain-protocol.js";
import { WorkerServiceIdentityRegistry } from "../../src/platform/execution/worker-pool/worker-service-identity.js";
import { SdkVersionHandshakeService } from "../../src/platform/interface/api/middleware/sdk-version-handshake.js";
import { TenantScopeFilter } from "../../src/platform/interface/channel-gateway/tenant-scope-filter.js";
import { CacheWarmingDegradationGate } from "../../src/platform/model-gateway/cache/cache-warming-degradation-gate.js";
import { DeterministicHotPathGate } from "../../src/platform/model-gateway/degradation/deterministic-hot-path-gate.js";
import { CallDepthBudget } from "../../src/platform/orchestration/agent-delegation/call-depth-budget.js";
import { CollaborationProtocolService } from "../../src/platform/orchestration/agent-delegation/collaboration-protocol/protocol-service.js";
import { GuardrailVibrationBreaker } from "../../src/platform/orchestration/harness/guardrails/guardrail-vibration-breaker.js";
import { ImprovementRollbackStateMachine } from "../../src/platform/orchestration/improve-rollout/rollback-pending-state.js";
import { HighPrecisionTimer } from "../../src/platform/shared/async/high-precision-timer.js";
import { DrDrillGate } from "../../src/platform/stability/dr-drill-gate.js";
import { FeedbackCollectiveAnomalyDetector } from "../../src/platform/state-evidence/memory/feedback-collective-anomaly-detector.js";
import { MemorySelfReinforcementGuard } from "../../src/platform/state-evidence/memory/memory-self-reinforcement-guard.js";
import { CrossRegionTruthLeader } from "../../src/platform/state-evidence/truth/cross-region-truth-leader.js";
import { ConfigDriftReconciler } from "../../src/platform/control-plane/config-center/config-drift-reconciler.js";
import { PackCompatibilityTestGenerator } from "../../src/sdk/pack-sdk/pack-compatibility-test-generator.js";
import { JudgeUnavailableCanaryGate } from "../../src/ops-maturity/agent-lifecycle/canary-controller/judge-unavailable-canary-gate.js";
import { CapacityPlanningService } from "../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
import { ComplianceReportPipelineService } from "../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";
import { EmergencyHotfixEvidenceGate } from "../../src/ops-maturity/emergency/emergency-hotfix-evidence.js";
import { ApprovalDelegationChainPolicy } from "../../src/org-governance/approval-routing/delegation/approval-delegation-chain-policy.js";
import { GovernanceDelegationRevocationSaga } from "../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import { ChineseWallAccessSaga } from "../../src/org-governance/knowledge-boundary/chinese-wall-access-saga.js";
import { OrgGovernanceSaga } from "../../src/org-governance/org-model/org-governance-saga.js";
import { ScimDlqReconciliationService } from "../../src/org-governance/sso-scim/scim-dlq-reconciliation.js";

test("entry security gates enforce tenant scope, endpoint class limits, SDK handshake, and worker identity", () => {
  const scopeFilter = new TenantScopeFilter((taskId) => (
    taskId === "task-1"
      ? { taskId, tenantId: "tenant-a", requiredScopes: ["admin"] }
      : null
  ));
  assert.equal(scopeFilter.evaluate({ actorId: "actor", tenantId: "tenant-b", scopes: ["admin"] }, "task-1").reasonCode, "scope.tenant_mismatch");
  assert.equal(scopeFilter.evaluate({ actorId: "actor", tenantId: "tenant-a", scopes: [] }, "task-1").reasonCode, "scope.missing_required_scope");
  assert.equal(scopeFilter.evaluate({ actorId: "actor", tenantId: "tenant-a", scopes: ["admin"] }, "task-1").allowed, true);

  const endpointAdmission = new EndpointClassAdmissionController([
    { endpointClass: "create_run", maxQueueDepth: 2, rateLimitPerMinute: 10 },
  ]);
  assert.equal(endpointAdmission.evaluate({ endpointClass: "create_run", queueDepthBefore: 2, requestsInCurrentMinute: 1 }).reasonCode, "endpoint_class.queue_depth_exceeded");

  const sdkHandshake = new SdkVersionHandshakeService({
    platformVersion: "4.3.0",
    contractVersion: "4.3.0",
    minimumSdkVersion: "2.0.0",
    recommendedSdkVersion: "2.1.0",
  });
  assert.equal(sdkHandshake.evaluate({ headers: { "X-SDK-Version": "1.9.0" } }).reasonCode, "sdk.upgrade_required");
  assert.equal(sdkHandshake.evaluate({ headers: { "X-SDK-Version": "2.0.0", "X-Contract-Version": "4.2.0" } }).warnings.length, 2);

  const mockTaskStore = {
  worker: {
    listWorkerSnapshots: () => [],
    getWorkerSnapshot: () => null,
    upsertWorkerSnapshot: () => {},
  },
} as unknown as import("../../src/platform/state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore;

  const workerIdentity = new WorkerServiceIdentityRegistry(mockTaskStore);
  workerIdentity.register({
    workerId: "worker-1",
    serviceIdentity: "spiffe://platform/worker-1",
    mtlsPeerFingerprint: "sha256:abc",
    allowedNodeRunTenants: ["tenant-a"],
  });
  assert.equal(workerIdentity.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "node-1",
    tenantId: "tenant-a",
    serviceIdentity: "spiffe://platform/worker-1",
    mtlsPeerFingerprint: "sha256:abc",
  }).accepted, true);
});

test("runtime cleanup and recovery receipts cover drain, terminal cleanup, budget, plugin, dispatch, DR, and replay boundaries", () => {
  const drain = new WorkerDrainProtocol().createReceipt({
    workerId: "worker-1",
    requestedBy: "ops",
    requestedAt: "2026-04-27T00:00:00.000Z",
    deadlineAt: "2026-04-27T00:01:00.000Z",
    activeLeases: [{ leaseId: "lease-1", nodeRunId: "node-1", expiresAt: "2026-04-27T00:02:00.000Z", handoverRequired: true }],
    drainReason: "graceful_shutdown",
  });
  assert.equal(drain.runTerminationCleanupRequired, true);
  assert.deepEqual(drain.handoverLeaseIds, ["lease-1"]);

  const cleanup = new RunTerminationCleanup().execute({
    runId: "run-1",
    tenantId: "tenant-a",
    terminalStatus: "cancelled",
    requestedAt: "2026-04-27T00:00:00.000Z",
    resources: [
      { resourceKind: "timer", resourceId: "timer-1", cleanupRequired: true },
      { resourceKind: "lease", resourceId: "lease-1", cleanupRequired: true },
    ],
  }, {
    emitCleanupCompleted: () => {},
    emitCleanupFailed: () => {},
  });
  assert.deepEqual(cleanup.cleanedResourceIds, ["lease-1", "timer-1"]);

  const pluginCleanup = new PluginCrashCleanupHook().cleanup({
    pluginId: "plugin-1",
    runId: "run-1",
    crashedAt: "2026-04-27T00:00:00.000Z",
    resources: [{ resourceKind: "secret", resourceId: "secret-1" }, { resourceKind: "callback", resourceId: "cb-1" }],
  });
  assert.deepEqual(pluginCleanup.secretResourceIds, ["secret-1"]);
  assert.equal(pluginCleanup.callbacksDetached, 1);

  const budgetSweep = new BudgetReservationSweeper().sweep({
    reservations: [
      { reservationId: "budget-1", runId: "run-dead", status: "reserved", expiresAt: "2026-04-27T00:00:00.000Z", updatedAt: "2026-04-27T00:00:00.000Z" },
      { reservationId: "budget-2", runId: "run-live", status: "reserved", expiresAt: "2026-04-27T00:00:00.000Z", updatedAt: "2026-04-27T00:00:00.000Z" },
    ],
    activeRunIds: new Set(["run-live"]),
    dbTime: "2026-04-27T00:00:02.000Z",
    clockSkewSafetyMarginMs: 1000,
  });
  assert.equal(budgetSweep.metric.name, "harness.budget.orphaned_reservation_count");
  assert.deepEqual(budgetSweep.releaseReservationIds, ["budget-1"]);

  const dispatchEvent = new BoundedDispatchQueueEventFactory().create({
    queueName: "create-run",
    queueDepthBefore: 4,
    maxQueueDepth: 4,
    dlqName: "dispatch-dlq",
  }, "node-create-run", "tenant-a", "trace-dispatch-001");
  assert.equal(dispatchEvent.eventType, "platform.dispatch.queue.rejected");
  assert.equal(dispatchEvent.queueDepthBefore, 4);
  assert.equal(dispatchEvent.maxQueueDepth, 4);

  const drGate = new DrDrillGate().evaluate({
    drillId: "dr-1",
    regionPair: "a-b",
    failoverCompleted: true,
    quorumPreserved: true,
    tombstoneReplayBoundaryPreserved: true,
    recoveryTimeMs: 500,
    maxRecoveryTimeMs: 1000,
  });
  assert.equal(drGate.slaEligible, true);

  const replay = new ReplayBoundaryGuard().evaluate("trace_replay", [
    { operationId: "tool-1", resourceKind: "tool", hasRealSideEffect: true, tombstoneReplay: false },
  ]);
  assert.equal(replay.reasonCode, "replay.real_side_effect_blocked");
});

test("compatibility, drift, resume, sequencing, timers, and guardrail breakers are executable", () => {
  const drift = new ConfigDriftReconciler().reconcile({
    baseline: { sourceName: "run_version_lock", values: { featureA: true, maxDepth: 8 } },
    observed: [{ sourceName: "runtime", values: { featureA: false, maxDepth: 8 } }],
    blockingKeys: ["featureA"],
    generatedAt: "2026-04-27T00:00:00.000Z",
  });
  assert.equal(drift.blocking, true);

  const packPlan = new PackCompatibilityTestGenerator().generate({
    manifestId: "pack-a",
    openApiOperationIds: ["createRun"],
    eventTypes: ["platform.run.created"],
    contractSchemaIds: ["RequestEnvelope"],
  }, "2026-04-27T00:00:00.000Z");
  assert.equal(packPlan.testCases.length, 4);

  const resume = new ResumeCompatibilityCheck().compare(
    { runId: "run-1", contractVersion: "4.3", runtimeVersion: "1", graphHash: "a", artifactLockHash: "a" },
    { runId: "run-1", contractVersion: "4.3", runtimeVersion: "1", graphHash: "b", artifactLockHash: "a" },
    { timeoutMs: 1000, startedAtMs: 0, nowMs: 10 },
  );
  assert.equal(resume.compatible, false);
  assert.equal(resume.differences[0]?.field, "graphHash");

  const protocol = new CollaborationProtocolService();
  const context = {
    parentPermissions: { resources: ["task"], actions: ["read"], constraints: {} },
    parentRiskMode: 10,
    parentConstraints: {},
    parentBudgetRemaining: 100,
    globalCallDepth: 8,
  };
  const message = protocol.createMessage("task_request", {
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "a",
    receiver_agent_id: "b",
    domain_id: "domain",
    risk_level: 1,
    budget_remaining: 10,
    trace_id: "trace",
    payload: {},
  });
  assert.equal(protocol.validateAndSend(message, context).accepted, true);
  assert.equal(protocol.validateAndSend(message, context).violations.includes("delegation.message_duplicate"), true);

  const timer = new HighPrecisionTimer().buildReceipt({
    timerId: "timer-1",
    scheduledAtNs: 1_000n,
    deadlineAtNs: 2_000n,
    firedAtNs: 1_500n,
  });
  assert.equal(timer.precision, "nanosecond");
  assert.equal(timer.withinDeadline, true);

  const breaker = new GuardrailVibrationBreaker(1, 5000);
  const first = breaker.evaluate({ runId: "run-1", signature: "same", observedAtMs: 1000 }, {
    guardrailActionCount: 0,
    lastGuardrailSignature: null,
    guardrailCooldownUntilMs: null,
  });
  const second = breaker.evaluate({ runId: "run-1", signature: "same", observedAtMs: 1100 }, first.state);
  assert.equal(second.reasonCode, "guardrail.cooldown");

  assert.equal(new CallDepthBudget().evaluate({
    currentCallDepth: 2,
    goalDecompositionDepth: 5,
    delegationDepth: 9,
  }).reasonCode, "call_depth.exceeded");

  // R13-41: Autonomy boundary enforcement
  assert.equal(new DeterministicHotPathGate().evaluate({
    routeId: "pricing",
    latencyClass: "low_latency",
    usesLlmHotPath: true,
    deterministicFallbackAvailable: true,
    allowedAutonomyLevel: "full_auto",
  }).reasonCode, "hot_path.llm_blocked");

  // R13-41: Autonomy exceeded blocks LLM hot path
  assert.equal(new DeterministicHotPathGate().evaluate({
    routeId: "pricing",
    latencyClass: "low_latency",
    usesLlmHotPath: true,
    deterministicFallbackAvailable: true,
    allowedAutonomyLevel: "suggestion",
  }).reasonCode, "hot_path.autonomy_exceeded");

  assert.equal(new CrossRegionTruthLeader().evaluate({
    tenantId: "tenant-a",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 7,
    fencingToken: "token-7",
  }, {
    tenantId: "tenant-a",
    region: "us-west",
    epoch: 7,
    fencingToken: "token-7",
  }).reasonCode, "truth_leader.not_home_region");
});

test("governance sagas, delegation TTL, SCIM DLQ, and Chinese Wall 2PC produce auditable receipts", () => {
  const delegationPolicy = new ApprovalDelegationChainPolicy(2, 60_000);
  assert.equal(delegationPolicy.evaluate({
    chainId: "chain-1",
    delegateActorIds: ["a", "b", "c"],
    createdAtMs: 0,
    expiresAtMs: 10,
  }).reasonCode, "approval_delegation.chain_too_long");

  const orgSaga = new OrgGovernanceSaga().execute("saga-1", [
    { stepId: "prepare-1", targetOrgNodeId: "org-1", action: "prepare", phase: "domain" as const },
    { stepId: "commit-1", targetOrgNodeId: "org-1", action: "commit", phase: "domain" as const },
    { stepId: "audit-1", targetOrgNodeId: "org-1", action: "audit", phase: "domain" as const },
  ]);
  assert.equal(orgSaga.status, "committed");
  assert.deepEqual(orgSaga.auditStepIds, ["audit-1"]);

  const scim = new ScimDlqReconciliationService().reconcile("report-1", [
    { recordId: "dlq-1", identityId: "user-1", retryCount: 1, maxRetries: 3, lastError: "timeout" },
    { recordId: "dlq-2", identityId: "user-2", retryCount: 3, maxRetries: 3, lastError: "conflict" },
  ]);
  assert.deepEqual(scim.retryRecordIds, ["dlq-1"]);
  assert.deepEqual(scim.unresolvedIdentityIds, ["user-2"]);

  const chineseWall = new ChineseWallAccessSaga().execute("access-1", [
    { stepId: "prepare", action: "prepare_grant", succeeded: true },
    { stepId: "commit", action: "commit_grant", succeeded: false },
  ]);
  assert.equal(chineseWall.status, "rolled_back");

  const revocation = new GovernanceDelegationRevocationSaga().revoke({
    delegationId: "delegation-1",
    requestedAtMs: 0,
    derivedResourceIds: ["approval-1", "token-1"],
  }, 30_000);
  assert.equal(revocation.revokeWithinSlo, true);
  assert.deepEqual(revocation.frozenResourceIds, ["approval-1", "token-1"]);
});

test("ops maturity gates cover cache warming, canary judge availability, memory guard, feedback anomaly, rollback, compliance signoff, capacity recalibration, and emergency hotfix", () => {
  assert.equal(new CacheWarmingDegradationGate().evaluate({
    cacheName: "prompt-health",
    warmedKeyCount: 1,
    requiredKeyCount: 2,
    d2Ready: true,
    d3Ready: false,
  }).degradationMode, "degradation_unready");

  assert.equal(new JudgeUnavailableCanaryGate().evaluate({
    judgeProviderId: "judge-1",
    available: false,
    checkedAt: "2026-04-27T00:00:00.000Z",
  }).paused, true);

  assert.equal(new MemorySelfReinforcementGuard().evaluate({
    memoryId: "mem-1",
    evaluatorGeneratedByCandidate: true,
    holdoutPassed: true,
    differentJudgePassed: true,
    humanReviewRequired: false,
    humanApproved: false,
  }).promotable, false);

  assert.equal(new FeedbackCollectiveAnomalyDetector(10, 0.2).evaluate({
    segmentId: "tenant-a",
    sampleCount: 20,
    positiveRatio: 0.9,
    historicalPositiveRatio: 0.5,
  }).biasSuspected, true);

  const rollbackMachine = new ImprovementRollbackStateMachine();
  const pending = rollbackMachine.requestRollback("improve-1", "released");
  assert.equal(pending.toState, "rollback_pending");
  assert.equal(rollbackMachine.completeRollback("improve-1", pending.toState).toState, "rolled_back");

  const compliance = new ComplianceReportPipelineService([{
    templateId: "soc2",
    framework: "SOC2",
    reportType: "readiness",
    requiredEvidenceTypes: [],
    renderSchema: [],
    version: "1",
    lockedOnGeneration: true,
    reportVersionLock: null,
    requiredDataSources: [],
    legalVersion: null,
    migrationRule: null,
    effectiveDate: null,
    lastReviewDate: null,
  }]);
  const artifact = compliance.generate({ templateId: "soc2", evidence: [], requestedBy: "auditor", generatedAt: "2026-04-27T00:00:00.000Z" });
  assert.equal(compliance.evaluateHumanSignoff({
    artifact,
    signoffDueAt: "2026-04-27T01:00:00.000Z",
    now: "2026-04-27T02:00:00.000Z",
  }).status, "not_attested_expired");

  const capacity = new CapacityPlanningService();
  const comparison = capacity.compareForecastToActual({
    forecast: {
      resourceType: "worker",
      trainingWindow: { start: "a", end: "b", sampleCount: 1 },
      projectedUsage: [100],
      confidenceInterval: { low: 90, high: 110 },
      trend: "flat",
      generatedAt: "2026-04-27T00:00:00.000Z",
    },
    actualUsage: 150,
    maxErrorRatio: 0.2,
  });
  assert.equal(comparison.needsRecalibration, true);

  assert.equal(new EmergencyHotfixEvidenceGate().evaluate({
    hotfixId: "hotfix-1",
    expiresAt: "2026-04-28T00:00:00.000Z",
    followUpTicketId: "ticket-1",
    rollbackRunbookId: "runbook-1",
    evidenceBundleId: "evidence-1",
  }, "2026-04-27T00:00:00.000Z").allowed, true);
});
