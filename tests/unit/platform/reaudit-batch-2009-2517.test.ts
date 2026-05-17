import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createGameDevAdapterPlugin } from "../../../src/plugins/adapters/game-dev-adapter.js";
import {
  generateArtifactHash,
  generateSigningKeyPair,
  scanPackSecurity,
  signPackArtifact,
  verifyPackArtifact,
} from "../../../src/sdk/pack-sdk/pack-manifest.js";
import { createBudgetLedger } from "../../../src/platform/contracts/executable-contracts/index.js";
import { DataLineageService } from "../../../src/platform/compliance/lineage/index.js";
import { RuntimeStateMachine } from "../../../src/platform/five-plane-execution/runtime-state-machine.js";
import { ReplayBoundaryGuard } from "../../../src/platform/five-plane-execution/recovery/replay-boundary-guard.js";
import { BudgetAllocator } from "../../../src/platform/five-plane-execution/budget-allocator.js";
import {
  createDistributedCasService,
  type CasRecord,
  type CasRepository,
} from "../../../src/platform/five-plane-state-evidence/events/cas/cas-service.js";
import { AgentVersionManager } from "../../../src/ops-maturity/agent-lifecycle/version-manager/agent-version-manager.js";
import { DurableEventBus } from "../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

test("2009: harness SDK wires beforeRun/afterRun/onError/onTimeout lifecycle hooks", () => {
  const text = source("src/sdk/harness-sdk/index.ts");
  assert.match(text, /beforeRun\?:/);
  assert.match(text, /afterRun\?:/);
  assert.match(text, /onError\?:/);
  assert.match(text, /onTimeout\?:/);
  assert.match(text, /this\.lifecycleHooks\?\.beforeRun\?\.\(input\)/);
  assert.match(text, /this\.lifecycleHooks\?\.afterRun\?\.\((?:run|publicRun)\)/);
  assert.match(text, /this\.lifecycleHooks\?\.onError\?\.\(error as Error/);
  assert.match(text, /this\.lifecycleHooks\?\.onTimeout\?\.\(timeoutMs/);
});

test("2010: client SDK exposes explicit version handshake flow", () => {
  const text = source("src/sdk/client-sdk/api-client.ts");
  assert.match(text, /performVersionHandshakeOnInit/);
  assert.match(text, /async performVersionHandshake\(\)/);
  assert.match(text, /\/handshake/);
});

test("2011: client SDK wraps API failures into typed application errors", () => {
  const text = source("src/sdk/client-sdk/api-client.ts");
  assert.match(text, /wrapApiError/);
  assert.match(text, /new AuthError/);
  assert.match(text, /new BusinessError/);
  assert.match(text, /new NetworkError/);
  assert.match(text, /new ValidationError/);
});

test("2012: admin SDK includes tenant, config, and audit management surface", () => {
  const text = source("src/sdk/admin-sdk/index.ts");
  for (const methodName of [
    "createTenant",
    "getTenant",
    "listTenants",
    "updateTenant",
    "deleteTenant",
    "activateTenant",
    "suspendTenant",
    "getConfig",
    "listConfigs",
    "setConfig",
    "updateConfig",
    "deleteConfig",
    "listConfigRevisions",
    "rollbackConfig",
    "queryAuditLogs",
    "getAuditLog",
    "exportAuditLogs",
    "getAuditStats",
    "archiveAuditLogs",
  ]) {
    assert.match(text, new RegExp(`public ${methodName}<|public ${methodName}\\(`));
  }
});

test("2013: pack SDK performs security scanning and artifact signing/verification", () => {
  const manifest = {
    packId: "pack.demo",
    version: "1.0.0",
    domainId: "demo",
    owner: "owner",
    capabilities: [{ capabilityKey: "demo.capability" }],
  };
  const sourceCode = "export function safe() { return 1; }";
  const artifactHash = generateArtifactHash(sourceCode);
  const scan = scanPackSecurity(sourceCode, artifactHash);
  assert.equal(scan.passed, true);

  const keys = generateSigningKeyPair();
  const signature = signPackArtifact(manifest, keys.privateKey);
  const verification = verifyPackArtifact({
    manifest,
    sourceCode,
    signature,
    publicKey: keys.publicKey,
    requireSignature: true,
    performSecurityScan: true,
  });
  assert.equal(verification.valid, true);
  assert.equal(verification.signatureValid, true);
  assert.equal(verification.securityScan?.passed, true);
});

test("2014: game-dev adapter blocks execution until authenticated", async () => {
  const plugin = createGameDevAdapterPlugin();
  await assert.rejects(
    () => plugin.execute("build.status", {}),
    /not_authenticated/,
  );
  await plugin.authenticate({ token: "secret-token-123" });
  const result = await plugin.execute("build.status", { projectSlug: "demo", buildTarget: "ios" });
  assert.equal(result.success, true);
});

test("2024: CAS service supports distributed locking around compare-and-set", () => {
  const operations: string[] = [];
  const repository: CasRepository = {
    get(_key: string): CasRecord | undefined {
      return { value: "old", version: 1, updatedAt: new Date("2026-05-12T00:00:00.000Z") };
    },
    set() {},
    delete() { return true; },
    has() { return true; },
    compareAndSwap(key: string, expectedValue: string, newValue: string) {
      operations.push(`swap:${key}:${expectedValue}:${newValue}`);
      return { success: true, currentValue: newValue, currentVersion: 2 };
    },
    compareAndSet(key: string, expectedVersion: number, newValue: string) {
      operations.push(`set:${key}:${expectedVersion}:${newValue}`);
      return { success: true, currentValue: newValue, currentVersion: expectedVersion + 1 };
    },
  };
  const lockAdapter = {
    acquire({ lockKey }: { lockKey: string }) {
      operations.push(`acquire:${lockKey}`);
      return { acquired: true };
    },
    release(lockKey: string) {
      operations.push(`release:${lockKey}`);
      return true;
    },
  };

  const service = createDistributedCasService(repository, lockAdapter as never);
  const result = service.compareAndSet("workflow-1", 1, "new");
  assert.equal(result.success, true);
  assert.deepEqual(operations, [
    "acquire:cas:workflow-1",
    "set:workflow-1:1:new",
    "release:cas:workflow-1",
  ]);
});

test("2087: execution path prewrites cost WAL before work and commits it inside transaction", () => {
  const billingText = source("src/platform/five-plane-state-evidence/truth/sqlite/repositories/billing-repository.ts");
  const supervisorText = source("src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts");
  assert.match(billingText, /insertCostEventWAL/);
  assert.match(billingText, /commitCostEventWAL/);

  const walIndex = supervisorText.indexOf("insertCostEventWAL");
  const transactionIndex = supervisorText.indexOf("deps.db.transaction(() => {", walIndex);
  const commitIndex = supervisorText.indexOf("commitCostEventWAL", transactionIndex);
  assert.ok(walIndex >= 0);
  assert.ok(transactionIndex > walIndex);
  assert.ok(commitIndex > transactionIndex);
});

test("2092: lineage service is append-only and hash-verifiable", () => {
  const service = new DataLineageService();
  const first = service.recordEdge({
    sourceRef: "artifact:a",
    targetRef: "artifact:b",
    kind: "derived_from",
    actorRef: "agent:1",
  });
  const second = service.recordEdge({
    sourceRef: "artifact:b",
    targetRef: "artifact:c",
    kind: "released_as",
    actorRef: "agent:1",
  });

  assert.equal(first.prevHash, null);
  assert.equal(second.prevHash, first.integrityHash);
  assert.equal(service.verifyChain().valid, true);
  assert.notEqual(service.listEdges()[0]?.integrityHash, "");
});

test("2106: rollout manager persists records and supports actual rollback handlers", () => {
  const text = source("src/ops-maturity/drift-detection/learning/rollout-manager.ts");
  assert.match(text, /repository\.listAll\(\)/);
  assert.match(text, /rollbackHandlerFactory/);
  assert.match(text, /const handler = this\.rollbackHandlerFactory\(\)/);
  assert.match(text, /await handler\(proposalId, reason\)/);
});

test("2115: agent version manager keeps blue and green slots active during switch", () => {
  const manager = new AgentVersionManager();
  const blue = manager.registerVersion({
    agentId: "agent-1",
    version: "1.0.0",
    stage: "stable",
    stable: true,
    deprecatedAt: null,
    deploymentSlot: "blue",
    changelog: "",
    metrics: { totalExecutions: 0, successRate: 0, avgDurationMs: 0 },
  });
  const green = manager.registerVersion({
    agentId: "agent-1",
    version: "1.1.0",
    stage: "beta",
    stable: false,
    deprecatedAt: null,
    deploymentSlot: null,
    changelog: "",
    metrics: { totalExecutions: 0, successRate: 0, avgDurationMs: 0 },
  });

  manager.assignDeploymentSlot("agent-1", green.versionId, "green");
  assert.equal(manager.getActiveSlot("agent-1", "blue")?.versionId, blue.versionId);
  assert.equal(manager.getActiveSlot("agent-1", "green")?.versionId, green.versionId);
});

test("2117: marketplace security scan executes sandbox path instead of permission-only scanning", () => {
  const text = source("src/scale-ecosystem/marketplace/pack-security-service.ts");
  assert.match(text, /runSandboxTest/);
  assert.match(text, /await this\.executeInSandbox\(input\)/);
  assert.match(text, /vm\.runInContext/);
});

test("2148: workflow transition service wraps state change in transaction and CAS update", () => {
  const text = source("src/platform/five-plane-execution/state-transition/transition-service.ts");
  assert.match(text, /public transition\(command: WorkflowStatusTransitionCommand\): void {\s*this\.db\.transaction\(\(\) => {/s);
  assert.match(text, /updateWorkflowStateCas/);
});

test("2152: recovery decision apply re-reads execution and candidate inside a transaction", () => {
  const text = source("src/platform/five-plane-execution/recovery/runtime-recovery-decision-service.ts");
  assert.match(text, /await this\.db\.transaction\(async \(\) => {/);
  assert.match(text, /const execution = this\.store\.dispatch\.getExecution\(executionId\)/);
  assert.match(text, /const recoveryView = await this\.recoveryService\.buildRuntimeRecoveryView\(execution\.taskId\)/);
});

test("2156: replay boundary guard blocks real side effects during reexecution replay", () => {
  const result = new ReplayBoundaryGuard().evaluate("reexecution_replay", [
    {
      operationId: "tool-1",
      resourceKind: "tool",
      hasRealSideEffect: true,
      tombstoneReplay: false,
    },
  ]);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "replay.real_side_effect_blocked");
  assert.deepEqual(result.blockedOperationIds, ["tool-1"]);
});

test("2180: intake router includes skill taxonomy and load-balancing paths", () => {
  const text = source("src/platform/five-plane-orchestration/routing/intake-router.ts");
  assert.match(text, /SkillTaxonomy/);
  assert.match(text, /LoadBalancingStrategy/);
  assert.match(text, /applyLoadBalancing/);
  assert.match(text, /matchCapabilities/);
  assert.match(text, /capacityAwareSelect/);
});

test("2201: startup consistency checker fail-closes by blocking traffic", () => {
  const text = source("src/platform/five-plane-execution/startup/startup-consistency-checker.ts");
  assert.match(text, /private _trafficBlocked = false/);
  assert.match(text, /this\._trafficBlocked = true/);
  assert.match(text, /this\.options\.onTrafficBlocked\?\.\(\)/);
  assert.match(text, /return !this\._trafficBlocked/);
});

test("2303: runtime state machine refuses transitions when event persistence is absent", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 1,
    status: "open",
  });
  const machine = new RuntimeStateMachine({ persistEvent: null });
  assert.throws(
    () =>
      machine.transition({
        commandId: "cmd-1",
        entityType: "BudgetLedger",
        entityId: ledger.budgetLedgerId,
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "hard_cap_reached",
        principal: "operator-1",
        expectedVersion: 1,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "budget.cap",
        emittedBy: "test",
      }),
    /event persistence callback/,
  );
});

test("2450: budget allocator can route settle/release through atomic SQL CAS repository", async () => {
  const persistedEvents: string[] = [];
  const allocator = new BudgetAllocator({
    stateMachine: new RuntimeStateMachine({
      persistEvent: (event) => {
        persistedEvents.push(event.eventType);
      },
    }),
    deps: {
      atomicRepository: {
        async settleAtomically(ledger, reservation, actualAmount, expectedVersion, settlement) {
          assert.equal(expectedVersion, ledger.version);
          assert.equal(settlement.budgetReservationId, reservation.budgetReservationId);
          return {
            success: true,
            rowsAffected: 1,
            ledger: {
              ...ledger,
              reservedAmount: 0,
              settledAmount: ledger.settledAmount + actualAmount,
              releasedAmount: ledger.releasedAmount + Math.max(0, reservation.amount - actualAmount),
              version: ledger.version + 1,
            },
          };
        },
        async releaseAtomically(ledger, reservation, expectedVersion) {
          assert.equal(expectedVersion, ledger.version);
          return {
            success: true,
            rowsAffected: 1,
            ledger: {
              ...ledger,
              reservedAmount: Math.max(0, ledger.reservedAmount - reservation.amount),
              releasedAmount: ledger.releasedAmount + reservation.amount,
              version: ledger.version + 1,
            },
          };
        },
      },
    },
  });
  const reserved = allocator.reserve({
    ledger: createBudgetLedger({
      tenantId: "tenant-1",
      harnessRunId: "run-1",
      currency: "USD",
      hardCap: 100,
      version: 0,
    }),
    amount: 25,
    resourceKind: "tool",
    expiresAt: "2026-05-12T01:00:00.000Z",
    expectedVersion: 0,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
      principal: "operator-1",
    },
  });

  const settled = await allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 20,
    expectedVersion: reserved.ledger.version,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
      principal: "operator-1",
    },
  });

  assert.equal(settled.ledger.settledAmount, 20);
  assert.ok(persistedEvents.some((eventType) => eventType.includes("budget_reservation.status_changed")));
});

test("2517: durable event bus publishes truth reference and event atomically", () => {
  const workspace = createTempWorkspace("aa-reaudit-bus-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    const taskId = "reaudit-task-2517";

    assert.equal(store.task.getTask(taskId), undefined);
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId,
      executionId: "reaudit-execution-2517",
      traceId: "trace-2517",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    assert.equal(store.task.getTask(taskId)?.id, taskId);
    assert.equal(store.event.listEventsForTask(taskId)[0]?.id, event.id);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
