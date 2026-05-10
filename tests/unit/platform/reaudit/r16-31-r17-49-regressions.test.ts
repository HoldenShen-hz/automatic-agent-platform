import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  ArtifactStore,
} from "../../../../src/platform/five-plane-state-evidence/artifacts/artifact-store.js";
import {
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
} from "../../../../src/platform/five-plane-state-evidence/checkpoints/workflow-step-checkpoint.js";
import {
  InMemoryLayeredEventInboxRepository,
  LayeredEventInbox,
} from "../../../../src/platform/five-plane-state-evidence/events/layered-event-inbox.js";
import {
  createPlatformFactEvent,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { RunTerminationCleanup } from "../../../../src/platform/five-plane-execution/run-termination-cleanup.js";
import { EscalationService } from "../../../../src/platform/five-plane-orchestration/escalation/index.js";
import { TopologyValidator } from "../../../../src/platform/five-plane-orchestration/agent-delegation/topology-validator.js";
import type { AgentContext, DelegationSpec } from "../../../../src/platform/five-plane-orchestration/agent-delegation/delegation-types.js";
import { DelegationManagerService } from "../../../../src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.js";
import {
  InMemoryDelegationRepository,
  type DelegationStatus,
} from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/delegation-repository.js";
import * as platformStability from "../../../../src/platform/stability/index.js";

function createCheckpoint() {
  return createWorkflowStepCheckpoint({
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    divisionId: "div-1",
    harnessRunId: "hr-1",
    nodeRunId: "node-1",
    planGraphId: "plan-1",
    stepId: "step-1",
    roleId: "role-1",
    outputKey: "summary",
    status: "completed",
    producedAt: "2026-05-10T00:00:00.000Z",
    output: { summary: "done" },
    decisionContext: {
      source: "judge",
      request: "continue",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-1"],
      nextStepId: null,
      outputKeys: ["summary"],
    },
  });
}

test("artifact-backed workflow step checkpoints are atomically materialized and checksum validated", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "reaudit-checkpoint-"));
  try {
    const store = new ArtifactStore({ rootDir });
    const written = store.writeJsonArtifact({
      taskId: "task-1",
      executionId: "exec-1",
      nodeRunId: "node-1",
      stepId: "step-1",
      kind: "workflow_step_snapshot",
      fileName: "checkpoint.json",
      content: createCheckpoint(),
    });

    const tempArtifacts = readdirSync(dirname(written.record.storagePath)).filter((name) => name.includes(".tmp-"));
    assert.equal(tempArtifacts.length, 0);
    assert.ok(readWorkflowStepCheckpoint(written.record) != null);

    writeFileSync(written.record.storagePath, "{\"schemaVersion\":\"workflow_step_checkpoint.v1\",\"broken\":true}", "utf8");
    assert.equal(readWorkflowStepCheckpoint(written.record), null);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("LayeredEventInbox can share consumer cursors and records across instances", () => {
  const repository = new InMemoryLayeredEventInboxRepository();
  const publisher = new LayeredEventInbox(repository);
  const subscriber = new LayeredEventInbox(repository);
  subscriber.registerConsumer({ consumerId: "truth-projector", kind: "truth" });

  publisher.append(createPlatformFactEvent({
    eventType: "platform.workflow.status_changed",
    aggregateType: "Workflow",
    aggregateId: "wf-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    traceId: "trace-1",
    payload: { status: "running" },
  }));

  const firstDrain = subscriber.drain("truth-projector");
  const secondDrain = publisher.drain("truth-projector");
  assert.equal(firstDrain.length, 1);
  assert.equal(secondDrain.length, 0);
});

test("RunTerminationCleanup executes cleanup callbacks and reports partial failures instead of always completing", async () => {
  const cleanup = new RunTerminationCleanup();
  const receipt = await cleanup.execute(
    {
      runId: "run-1",
      tenantId: "tenant-1",
      terminalStatus: "failed",
      terminalReason: "worker_exit",
      requestedAt: "2026-05-10T00:00:00.000Z",
      resources: [
        { resourceKind: "lease", resourceId: "lease-1", cleanupRequired: true },
        { resourceKind: "secret", resourceId: "secret-1", cleanupRequired: true },
      ],
    },
    {
      cleanup: {
        lease: async () => true,
        secret: async () => false,
        budget_reservation: async () => true,
        plugin_resource: async () => true,
        timer: async () => true,
        hitl_wait: async () => true,
        context_snapshot: async () => true,
        callback: async () => true,
      },
      stateEvidenceFlush: async () => ({ flushed: true, artifactCount: 2 }),
      compensationTrigger: async () => ({ triggered: true, compensationPlanId: "plan-1" }),
    },
  );

  assert.equal(receipt.cleanupStatus, "partial");
  assert.deepEqual(receipt.cleanedResourceIds, ["lease-1"]);
  assert.deepEqual(receipt.failedResourceIds, ["secret-1"]);
});

test("TopologyValidator rejects graph cycles that are outside the direct ancestor chain", () => {
  const validator = new TopologyValidator();
  assert.throws(() => validator.validate({
    currentDepth: 1,
    activeDelegations: 1,
    targetPackId: "pack-B",
    delegationChain: ["pack-root", "pack-C"],
    sourcePackId: "pack-C",
    existingEdges: [
      { fromId: "pack-root", toId: "pack-B" },
      { fromId: "pack-B", toId: "pack-C" },
    ],
  }));
});

test("EscalationService creates approval requests, notifies operators, and blocks execution", () => {
  const createdApprovals: string[] = [];
  const notifications: string[] = [];
  const service = new EscalationService({
    approvalRequestHandler: (request) => {
      createdApprovals.push(request.approvalRequestId);
      return request;
    },
    operatorNotificationHandler: (notification) => {
      notifications.push(notification.notificationId);
      return notification;
    },
  });

  const decision = service.decide({
    taskId: "task-1",
    executionId: "exec-1",
    tenantId: "tenant-1",
    stage: "execute",
    riskLevel: "high",
    reasonCode: "manual-review",
    estimatedCostUsd: 20,
    affectsProduction: false,
    slaDeadline: null,
    timeoutMs: null,
    costThresholdUsd: 5,
  });

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.blocksExecution, true);
  assert.equal(createdApprovals.length, 0);
  assert.equal(notifications.length, 1);

  const approvalDecision = service.decide({
    taskId: "task-2",
    executionId: "exec-2",
    tenantId: "tenant-1",
    stage: "plan",
    riskLevel: "medium",
    reasonCode: "cost-check",
    estimatedCostUsd: 20,
    affectsProduction: false,
    slaDeadline: null,
    timeoutMs: null,
  });
  assert.equal(approvalDecision.decision, "approval");
  assert.equal(approvalDecision.blocksExecution, true);
  assert.equal(createdApprovals.length, 1);
  assert.equal(notifications.length, 2);
});

test("DelegationManagerService survives restart with repository-backed active delegations", async () => {
  const repository = new InMemoryDelegationRepository();
  const service = new DelegationManagerService({}, repository);
  const parent: AgentContext = {
    agentId: "parent-agent",
    agentType: "planner",
    packId: "pack-root",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["workspace"],
      actions: ["tool:invoke"],
      constraints: {},
    },
    sandboxTier: "workspace_write",
    correlationId: "corr-1",
    tenantId: "tenant-1",
  };
  const spec: DelegationSpec = {
    targetAgentId: "child-agent",
    targetAgentType: "worker",
    targetPackId: "pack-child",
    requiredPermissions: {
      resources: ["workspace"],
      actions: ["tool:invoke"],
      constraints: {},
    },
    timeout: 60_000,
    requiresApproval: true,
  };

  const handle = await service.delegate(parent, spec);
  const reloadedService = new DelegationManagerService({}, repository);
  const reloadedDelegation = await reloadedService.getDelegation(handle.delegationId);
  const activeDelegations = await reloadedService.getActiveDelegations(parent.agentId);

  assert.ok(reloadedDelegation != null);
  assert.equal(activeDelegations.some((delegation) => delegation.delegationId === handle.delegationId), true);
  assert.equal(reloadedDelegation?.status, "pending_approval");

  const statuses: DelegationStatus[] = ["pending", "pending_approval", "discovery", "bid", "awarded", "active"];
  assert.equal(statuses.includes("discovery"), true);
  assert.equal(statuses.includes("awarded"), true);
});

test("platform stability exports both SLO tracking entrypoints", () => {
  assert.equal(typeof platformStability.SloTracker, "function");
  assert.equal(typeof platformStability.SloTrackerService, "function");
});
