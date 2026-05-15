import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  ContextIsolator,
  IsolationLevel,
} from "../../../src/platform/five-plane-orchestration/agent-delegation/context-isolator.js";
import { DelegationAuditService } from "../../../src/platform/five-plane-orchestration/agent-delegation/delegation-audit-service.js";
import { ACPInvariantEnforcer } from "../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.js";
import { SqliteLeaseRepository } from "../../../src/platform/five-plane-execution/lease/lease-repository-sqlite.js";
import type { AgentContext, DelegationSpec, PermissionSet } from "../../../src/platform/five-plane-orchestration/agent-delegation/delegation-types.js";
import type { ACPMessage } from "../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/types.js";
import type { AuthoritativeSqlDatabase } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../../src/platform/contracts/types/domain.js";

function createParentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent-agent",
    agentType: "orchestrator",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["workspace", "reports", "ledger"],
      actions: ["read", "write", "approve"],
      constraints: {
        maxDurationMs: 120_000,
        maxTokens: 8_000,
        allowedDomains: ["finance", "ops"],
        deniedDomains: ["legal"],
      },
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: "tenant-1",
    ...overrides,
  };
}

function createDelegationSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child-agent",
    targetAgentType: "worker",
    targetPackId: "pack-1",
    requiredPermissions: {
      resources: ["workspace"],
      actions: ["read"],
      constraints: {
        maxDurationMs: 30_000,
        allowedDomains: ["ops"],
        deniedDomains: ["finance-shadow"],
      },
    },
    timeout: 30_000,
    ...overrides,
  };
}

function createAcpMessage(overrides: Partial<ACPMessage> = {}): ACPMessage {
  return {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-parent",
    depth: 1,
    sender_agent_id: "agent-a",
    receiver_agent_id: "agent-b",
    domain_id: "finance",
    risk_level: 10,
    budget_remaining: 20,
    trace_id: "trace-1",
    payload: {},
    timestamp: "2026-05-11T00:00:00.000Z",
    ...overrides,
  };
}

interface MockDbState {
  leases: Map<string, ExecutionLeaseRecord>;
  audits: LeaseAuditRecord[];
}

function createMockSqliteConnection(state: MockDbState): AuthoritativeSqlDatabase["connection"] {
  return {
    prepare: (sql: string) => {
      const normalized = sql.trim().toLowerCase();
      const isInsert = normalized.startsWith("insert");
      const isSelect = normalized.startsWith("select");
      const isUpdate = normalized.startsWith("update");

      if (isInsert) {
        return {
          run: (...params: unknown[]) => {
            if (sql.includes("execution_leases")) {
              const lease: ExecutionLeaseRecord = {
                id: params[0] as string,
                executionId: params[1] as string,
                workerId: params[2] as string,
                attempt: params[3] as number,
                fencingToken: params[4] as number,
                queueName: params[5] as string | null,
                status: params[6] as ExecutionLeaseRecord["status"],
                leasedAt: params[7] as string,
                expiresAt: params[8] as string,
                lastHeartbeatAt: params[9] as string,
                releasedAt: params[10] as string | null,
                reasonCode: params[11] as string | null,
              };
              state.leases.set(lease.id, lease);
              return;
            }

            const audit: LeaseAuditRecord = {
              id: params[0] as string,
              executionId: params[1] as string,
              leaseId: params[2] as string,
              workerId: params[3] as string,
              fencingToken: params[4] as number,
              eventType: params[5] as LeaseAuditRecord["eventType"],
              reasonCode: params[6] as string | null,
              recordedAt: params[7] as string,
            };
            state.audits.push(audit);
          },
        };
      }

      if (isSelect) {
        if (sql.includes("MAX(fencing_token)")) {
          return {
            get: (executionId: string) => {
              const maxToken = Array.from(state.leases.values())
                .filter((lease) => lease.executionId === executionId)
                .reduce((max, lease) => Math.max(max, lease.fencingToken), 0);
              return { maxFencingToken: maxToken };
            },
          };
        }

        if (sql.includes("execution_leases")) {
          return {
            get: (id: string) => {
              if (sql.includes("execution_id = ?") && !sql.includes("where id")) {
                return Array.from(state.leases.values()).find((lease) => lease.executionId === id && lease.status === "active");
              }
              return state.leases.get(id);
            },
            all: (executionId: string) =>
              Array.from(state.leases.values())
                .filter((lease) => lease.executionId === executionId)
                .sort((left, right) => left.fencingToken - right.fencingToken),
          };
        }

        return {
          all: (executionId: string) =>
            state.audits
              .filter((audit) => audit.executionId === executionId)
              .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt)),
        };
      }

      if (isUpdate) {
        return {
          run: (...params: unknown[]) => {
            if (sql.includes("last_heartbeat_at")) {
              const leaseId = params[2] as string;
              const lease = state.leases.get(leaseId);
              if (lease) {
                state.leases.set(leaseId, {
                  ...lease,
                  lastHeartbeatAt: params[0] as string,
                  expiresAt: params[1] as string,
                });
              }
              return;
            }

            if (sql.includes("released_at")) {
              const leaseId = params[2] as string;
              const lease = state.leases.get(leaseId);
              if (lease) {
                state.leases.set(leaseId, {
                  ...lease,
                  status: "released",
                  releasedAt: params[0] as string,
                  reasonCode: params[1] as string | null,
                });
              }
              return;
            }

            const leaseId = params[1] as string;
            const lease = state.leases.get(leaseId);
            if (lease) {
              state.leases.set(leaseId, {
                ...lease,
                status: params[0] as ExecutionLeaseRecord["status"],
              });
            }
          },
        };
      }

      return {
        run: () => undefined,
        get: () => undefined,
        all: () => [],
      };
    },
  } as AuthoritativeSqlDatabase["connection"];
}

function createMockSqliteDb(state: MockDbState = { leases: new Map(), audits: [] }): AuthoritativeSqlDatabase {
  return {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: createMockSqliteConnection(state),
    migrate: () => undefined,
    getSchemaStatus: () => ({ currentVersion: 1, pendingMigrations: 0 }),
    assertSchemaCurrent: () => undefined,
    integrityCheck: () => [],
    healthCheck: async () => true,
    transaction: <T>(work: () => T) => work(),
    readTransaction: <T>(work: () => T) => work(),
  } as unknown as AuthoritativeSqlDatabase;
}

function createLease(overrides: Partial<ExecutionLeaseRecord> = {}): ExecutionLeaseRecord {
  return {
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    attempt: 1,
    fencingToken: 1,
    queueName: null,
    status: "active",
    leasedAt: "2026-05-11T00:00:00.000Z",
    expiresAt: "2026-05-11T00:05:00.000Z",
    lastHeartbeatAt: "2026-05-11T00:00:00.000Z",
    releasedAt: null,
    reasonCode: null,
    ...overrides,
  };
}

test("R26-01 and R26-03 context isolation avoids zero-action escalation and empty minimal fallback", () => {
  const isolator = new ContextIsolator();
  const parent = createParentContext({
    permissions: {
      resources: ["workspace"],
      actions: [],
      constraints: {},
    },
  });

  const zeroActionResult = isolator.isolate(parent, createDelegationSpec({
    requiredPermissions: {
      resources: ["workspace"],
      actions: ["write"],
      constraints: {},
    },
  }));

  assert.equal(zeroActionResult.isolationLevel, IsolationLevel.MINIMAL);
  assert.deepEqual(zeroActionResult.narrowedPermissions.actions, []);

  const emptyMinimalResult = isolator.isolate(
    createParentContext({
      permissions: {
        resources: ["workspace", "reports"],
        actions: ["read", "write"],
        constraints: {},
      },
    }),
    createDelegationSpec({
      requiredPermissions: {
        resources: [],
        actions: [],
        constraints: {},
      },
    }),
  );

  assert.equal(emptyMinimalResult.isolationLevel, IsolationLevel.MINIMAL);
  assert.deepEqual(emptyMinimalResult.narrowedPermissions.resources, []);
  assert.deepEqual(emptyMinimalResult.narrowedPermissions.actions, []);
});

test("R26-04 and R26-05 permission merges keep resource intersection, allowed-domain intersection, and denied-domain union", () => {
  const isolator = new ContextIsolator();
  const merged = isolator.mergePermissions(
    {
      resources: ["workspace", "reports"],
      actions: ["read", "write"],
      constraints: {
        allowedDomains: ["finance", "ops"],
        deniedDomains: ["legal"],
      },
    },
    {
      resources: ["workspace", "ledger"],
      actions: ["read"],
      constraints: {
        allowedDomains: ["ops", "hr"],
        deniedDomains: ["shadow"],
      },
    },
  );

  assert.deepEqual(merged.resources, ["workspace"]);
  assert.deepEqual(merged.actions, ["read"]);
  assert.deepEqual(merged.constraints.allowedDomains, ["ops"]);
  assert.deepEqual(merged.constraints.deniedDomains, ["legal", "shadow"]);
});

test("R26-02 and R26-07 delegation audit persists to disk and preserves depth for completed and failed events", () => {
  const auditDir = mkdtempSync(join(tmpdir(), "reaudit-r26-audit-"));
  try {
    const service = new DelegationAuditService(auditDir);
    service.recordDelegationCompleted({
      delegationId: "dlg-1",
      parentAgentId: "parent-agent",
      childAgentId: "child-agent",
      durationMs: 1200,
      depth: 3,
      actorId: "parent-agent",
      actorType: "agent",
    });
    service.recordDelegationFailed({
      delegationId: "dlg-1",
      parentAgentId: "parent-agent",
      childAgentId: "child-agent",
      error: "timeout",
      depth: 4,
      actorId: "parent-agent",
      actorType: "agent",
    });

    const reloaded = new DelegationAuditService(auditDir);
    const events = reloaded.getByDelegation("dlg-1");
    assert.equal(events.length, 2);
    assert.equal(events[0]?.depth, 3);
    assert.equal(events[1]?.depth, 4);
    assert.match(
      readFileSync(join(auditDir, "delegation-audit-events.json"), "utf8"),
      /delegation\.failed/,
    );
  } finally {
    rmSync(auditDir, { recursive: true, force: true });
  }
});

test("R26-06 ACP invariant enforcer rejects depth at or beyond the global limit", () => {
  const enforcer = new ACPInvariantEnforcer();
  const result = enforcer.enforceAll(createAcpMessage({ depth: 2 }), {
    parentPermissions: {
      resources: ["workspace"],
      actions: ["read"],
      constraints: {},
    },
    parentRiskMode: 20,
    parentConstraints: {},
    parentBudgetRemaining: 100,
    globalCallDepth: 2,
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.violations, []);
});

test("R26-08, R26-09, and R26-10 lease repository enforces state guards and extends expiry on heartbeat", async () => {
  const state: MockDbState = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repository = new SqliteLeaseRepository(db);
  const activeLease = createLease();
  state.leases.set(activeLease.id, activeLease);

  await repository.updateLeaseHeartbeat(activeLease.id, "2026-05-11T00:02:00.000Z");
  assert.equal(state.leases.get(activeLease.id)?.lastHeartbeatAt, "2026-05-11T00:02:00.000Z");
  assert.equal(state.leases.get(activeLease.id)?.expiresAt, "2026-05-11T00:07:00.000Z");

  await repository.updateLeaseStatus(activeLease.id, "expired");
  await assert.rejects(
    repository.updateLeaseStatus(activeLease.id, "handed_over"),
    /Invalid lease status transition from expired to handed_over/,
  );

  const releasedLease = createLease({ id: "lease-2", status: "released", releasedAt: "2026-05-11T00:03:00.000Z" });
  state.leases.set(releasedLease.id, releasedLease);
  await assert.rejects(
    repository.updateLeaseRelease(releasedLease.id, "2026-05-11T00:04:00.000Z", "duplicate_release"),
    /Cannot release lease in released state/,
  );
});

test("R26-11 async writeback wrapper is a direct ESM import with no createRequire fallback", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service-async.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /createRequire/);
  assert.doesNotMatch(source, /\brequire\(/);
  assert.match(source, /import \{ ExecutionWorkerWritebackService \} from "\.\/execution-worker-writeback-service\.js";/);
});
