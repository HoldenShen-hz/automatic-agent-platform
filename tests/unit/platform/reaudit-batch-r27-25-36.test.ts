import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  AgentDefinitionSchema,
  isTerminalState,
  listActiveAgents,
  toDocumentedAgentLifecycleState,
} from "../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";
import {
  EdgeRuntimeSyncService,
  type EdgeRuntimeProfile,
} from "../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";
import {
  ApprovalService,
  type ApprovalEscalationHop,
} from "../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { PolicyEngine } from "../../../src/platform/five-plane-control-plane/iam/policy-engine.js";
import {
  transitionLock,
  type LockTransitionCommand,
} from "../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";
import { canonicalMemoryLayerToScope, DEFAULT_LAYER_TTL_CONFIGS, scopeToCanonicalMemoryLayer } from "../../../src/platform/state-evidence/memory/memory-layer-model.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";

function createApprovalHarness(prefix: string) {
  const tmpDir = join("/tmp", `${prefix}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, "test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { tmpDir, db, store };
}

function cleanupApprovalHarness(harness: { tmpDir: string; db: SqliteDatabase }) {
  harness.db.close();
  rmSync(harness.tmpDir, { recursive: true, force: true });
}

function createTask(store: AuthoritativeTaskStore, taskId: string, now: string): void {
  store.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: null,
    title: "Reaudit task",
    status: "in_progress",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

function createEdgeProfile(): EdgeRuntimeProfile {
  return {
    edgeNodeId: "edge-001",
    stateful: true,
    leaseMigrationSupported: true,
    checkpointRequiredBeforePreempt: true,
    capabilities: ["cloud_sync"],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    allowedModels: ["local-small"],
    syncPolicy: {
      allowRestrictedDataUpload: true,
      requireOrdering: false,
    },
  };
}

test("R27-25/R27-35 edge runtime sync exposes canonical conflict taxonomy and contract profile fields", () => {
  const service = new EdgeRuntimeSyncService();
  const profile = createEdgeProfile();
  const record = {
    edgeNodeId: profile.edgeNodeId,
    taskId: "task-edge",
    createdAt: "2026-05-11T00:00:00.000Z",
  } as const;
  const acceptedEnvelope = service.buildSyncEnvelope(profile, record as never, "digest-edge");
  const accepted = service.sync(profile, [acceptedEnvelope], {});
  assert.equal(accepted.decisions[0]?.resolution, "accept_edge");
  assert.equal(profile.stateful, true);
  assert.equal(profile.leaseMigrationSupported, true);
  assert.equal(profile.checkpointRequiredBeforePreempt, true);

  const conflictedEnvelope = service.buildSyncEnvelope(profile, record as never, "digest-local");
  const conflicted = service.sync(
    profile,
    [conflictedEnvelope],
    { [conflictedEnvelope.recordId]: "digest-cloud" },
    { [conflictedEnvelope.recordId]: "{\"winner\":\"cloud\"}" },
  );
  assert.equal(conflicted.decisions[0]?.resolution, "accept_cloud");
});

test("R27-26 agent registry accepts canonical lifecycle aliases while preserving internal transitions", () => {
  const parsed = AgentDefinitionSchema.parse({
    agentId: "agent-001",
    name: "Reaudit Agent",
    domainId: "ops",
    owner: {
      orgNodeId: "org-1",
      path: "/ops",
    },
    components: {
      pack: {
        packId: "pack-1",
        version: "1.0.0",
      },
      promptBundle: {
        bundleId: "bundle-1",
        version: "1.0.0",
      },
      modelBinding: {
        provider: "openai",
        model: "gpt-test",
      },
      trustProfile: {
        initialLevel: "manual-only",
        scoringConfig: {},
      },
      autonomyConfig: {},
    },
    currentVersionId: "v1",
    lifecycleState: "production",
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  });

  assert.equal(parsed.lifecycleState, "active");
  assert.equal(listActiveAgents([parsed]).length, 1);
  assert.equal(isTerminalState("retired"), true);
  assert.equal(toDocumentedAgentLifecycleState("archived"), "retired");
});

test("R27-27 memory layer model exposes canonical ADR layer aliases", () => {
  assert.equal(canonicalMemoryLayerToScope("RuntimeCache"), "runtime");
  assert.equal(scopeToCanonicalMemoryLayer("evolution"), "EvolutionMemory");
  assert.ok(DEFAULT_LAYER_TTL_CONFIGS.every((config) => config.canonicalLayerName.length > 0));
});

test("R27-28/R27-29 NL gateway and risk engine source stay aligned with ADR naming and config-driven weighting", () => {
  const nlGatewaySource = readFileSync(join(process.cwd(), "src/interaction/nl-gateway/index.ts"), "utf8");
  assert.match(nlGatewaySource, /overall_risk\?/);
  assert.match(nlGatewaySource, /risk_factors\?/);
  assert.match(nlGatewaySource, /side_effects\?/);
  assert.match(nlGatewaySource, /approval_needed\?/);

  const riskEngineSource = readFileSync(join(process.cwd(), "src/platform/five-plane-control-plane/risk-control/risk-evaluation-engine.ts"), "utf8");
  assert.match(riskEngineSource, /weights are sourced from `config\/risk\/default\.json`/);
  assert.doesNotMatch(riskEngineSource, /weight\s*=\s*4/);
});

test("R27-30 approval requests now carry contract-required runtime and escalation fields", () => {
  const harness = createApprovalHarness("reaudit-r27-30");
  try {
    const now = "2026-05-11T00:00:00.000Z";
    createTask(harness.store, "task-r27-30", now);
    const service = new ApprovalService(harness.db, harness.store);
    const escalationChain: readonly ApprovalEscalationHop[] = [{
      level: 1,
      reviewerType: "user",
      reviewerRef: "ops-oncall",
      timeoutMs: 60_000,
      onTimeout: "escalate",
    }];
    const created = service.createRequest({
      taskId: "task-r27-30",
      executionId: null,
      sourceAgentId: "agent-001",
      reason: "Need approval for rollout",
      riskLevel: "high",
      stageViewRef: "execute",
      options: ["approve", "reject"],
      context: {
        harnessRunId: "harness-001",
        node_run_id: "node-001",
      },
      timeoutPolicy: "approve",
      escalationChain,
    });

    assert.equal(created.harnessRunId, "harness-001");
    assert.equal(created.harness_run_id, "harness-001");
    assert.equal(created.nodeRunId, "node-001");
    assert.equal(created.stageViewRef, "execute");
    assert.equal(created.timeoutAutoAction, "continue_readonly");
    assert.equal(created.escalationChain?.length, 1);
  } finally {
    cleanupApprovalHarness(harness);
  }
});

test("R27-31/R27-32/R27-33/R27-36 policy engine accepts canonical modes and extended actions with explain/audit fields", () => {
  const engine = new PolicyEngine({
    budgetPolicy: {
      maxTaskCostUsd: 100,
      maxDailyCostUsd: 500,
      maxMonthlyCostUsd: 1000,
      warnAtRatio: 0.8,
      mode: "auto",
    },
  });

  const rolloutDecision = engine.evaluate({
    decisionId: "decision-rollout",
    taskId: "task-rollout",
    harnessRunId: "harness-rollout",
    nodeRunId: "node-rollout",
    attemptId: "attempt-rollout",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "advance_rollout",
    riskCategory: "governance_sensitive",
    mode: "no-rollout",
    stageViewRef: "release",
    estimatedCostUsd: 5,
    metadata: {},
  });
  assert.equal(rolloutDecision.decision, "deny");
  assert.equal(rolloutDecision.reasonCode, "policy.no_rollout_mode_denied");
  assert.equal(rolloutDecision.matchedRuleRefs.includes("mode.no_rollout"), true);
  assert.equal(rolloutDecision.decisionTtlMs, 30_000);
  assert.equal(rolloutDecision.explain?.policyPaths.includes("mode.no_rollout"), true);
  assert.equal(rolloutDecision.auditRecord?.decisionId, "decision-rollout");

  const improvementDecision = engine.evaluate({
    decisionId: "decision-improve",
    taskId: "task-improve",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "promote_improvement",
    riskCategory: "strategy_affecting",
    mode: "manual-only",
    estimatedCostUsd: 5,
    metadata: {},
  });
  assert.equal(improvementDecision.decision, "escalate_for_approval");
  assert.equal(improvementDecision.requiresApproval, true);
});

test("R27-34 distributed lock exposes LockTransitionCommand and validates transition payloads", () => {
  const command: LockTransitionCommand = {
    lockId: "lock-001",
    lockType: "execution_lease",
    resourceKey: "worker:lease:001",
    fromStatus: "held",
    toStatus: "extended",
    ownerId: "worker-001",
    reasonCode: "lease.refresh",
    traceId: "trace-001",
    occurredAt: "2026-05-11T00:00:00.000Z",
    fencingToken: 7,
  };
  const result = transitionLock(command);
  assert.equal(result.accepted, true);
  assert.equal(result.command.toStatus, "extended");

  assert.throws(
    () => transitionLock({ ...command, toStatus: "held" }),
    /distributed_lock.transition_noop/,
  );
});
