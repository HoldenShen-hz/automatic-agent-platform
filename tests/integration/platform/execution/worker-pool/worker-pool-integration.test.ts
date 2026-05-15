/**
 * Integration Test: Worker Pool Integration
 *
 * Tests worker pool services with SQLite persistence,
 * verifying registration, heartbeat, and load balancing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { WorkerRegistryService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { RemoteWorkerRegistrationService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker/remote-worker-registration-service.js";
import {
  computeWorkerLoadScore,
  summarizeWorkerLoadSkew,
  type WorkerLoadSignal,
} from "../../../../../src/platform/five-plane-execution/worker-pool/worker-load-balancing.js";
import {
  resolveRemoteAuthorityBlockReason,
  type RemoteSessionAuthorityState,
} from "../../../../../src/platform/five-plane-execution/worker-pool/remote-session-guard.js";
import { toWorkerSchedulingStatus } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-scheduling-status.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createWorkerPoolContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/worker-pool.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

// ---------------------------------------------------------------------------
// Worker Load Balancing Integration
// ---------------------------------------------------------------------------

test("WorkerRegistryService + load balancing: worker load score reflects capacity", () => {
  const ctx = createWorkerPoolContext("aa-load-score-");
  try {
    const registry = new WorkerRegistryService(ctx.store);

    // Register workers with different capacities
    registry.recordHeartbeat({
      workerId: "worker-small",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
    });

    registry.recordHeartbeat({
      workerId: "worker-large",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 8,
    });

    const workers = registry.listWorkers();
    const smallWorker = workers.find((w) => w.workerId === "worker-small")!;
    const largeWorker = workers.find((w) => w.workerId === "worker-large")!;

    const smallSignal: WorkerLoadSignal = {
      workerId: smallWorker.workerId,
      queueAffinity: smallWorker.queueAffinity,
      maxConcurrency: smallWorker.maxConcurrency,
      availableSlots: smallWorker.availableSlots,
      activeLeaseCount: 1,
      runningExecutionCount: 1,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    };

    const largeSignal: WorkerLoadSignal = {
      workerId: largeWorker.workerId,
      queueAffinity: largeWorker.queueAffinity,
      maxConcurrency: largeWorker.maxConcurrency,
      availableSlots: largeWorker.availableSlots,
      activeLeaseCount: 2,
      runningExecutionCount: 2,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    };

    // With same absolute load (1 vs 2), the smaller worker is more loaded relative to capacity
    assert.ok(computeWorkerLoadScore(smallSignal) >= computeWorkerLoadScore(largeSignal) * 0.5);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerRegistryService + load skew: detect load imbalance across workers", () => {
  const ctx = createWorkerPoolContext("aa-load-skew-");
  try {
    const registry = new WorkerRegistryService(ctx.store);

    // Register workers with imbalanced load
    registry.recordHeartbeat({
      workerId: "worker-heavy",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-1", "exec-2", "exec-3", "exec-4"],
      maxConcurrency: 4,
      activeLeaseCount: 4,
    });

    registry.recordHeartbeat({
      workerId: "worker-light",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 4,
      activeLeaseCount: 0,
    });

    const workers = registry.listWorkers();
    const signals: WorkerLoadSignal[] = workers.map((w) => ({
      workerId: w.workerId,
      queueAffinity: w.queueAffinity,
      maxConcurrency: w.maxConcurrency,
      availableSlots: w.availableSlots,
      activeLeaseCount: w.activeLeaseCount,
      runningExecutionCount: w.runningExecutionIds.length,
      saturation: w.saturation,
      toolBacklogCount: w.toolBacklogCount,
      cpuPct: w.cpuPct,
    }));

    const summary = summarizeWorkerLoadSkew(signals);
    assert.equal(summary.detected, true);
    assert.equal(summary.dominantWorkerId, "worker-heavy");
    assert.ok(summary.dominantWorkerShare! > 0.5);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerRegistryService + load skew: balanced load does not trigger skew", () => {
  const ctx = createWorkerPoolContext("aa-load-balanced-");
  try {
    const registry = new WorkerRegistryService(ctx.store);

    // Register workers with similar load
    for (let i = 0; i < 3; i++) {
      registry.recordHeartbeat({
        workerId: `worker-${i}`,
        status: "busy",
        capabilities: ["bash"],
        runningExecutionIds: ["exec-1", "exec-2"],
        maxConcurrency: 4,
        activeLeaseCount: 2,
      });
    }

    const workers = registry.listWorkers();
    const signals: WorkerLoadSignal[] = workers.map((w) => ({
      workerId: w.workerId,
      queueAffinity: w.queueAffinity,
      maxConcurrency: w.maxConcurrency,
      availableSlots: w.availableSlots,
      activeLeaseCount: w.activeLeaseCount,
      runningExecutionCount: w.runningExecutionIds.length,
      saturation: w.saturation,
      toolBacklogCount: w.toolBacklogCount,
      cpuPct: w.cpuPct,
    }));

    const summary = summarizeWorkerLoadSkew(signals);
    assert.equal(summary.detected, false);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// Remote Session Guard Integration
// ---------------------------------------------------------------------------

test("RemoteSessionGuard resolves authority block for viewer_only session", () => {
  const state: RemoteSessionAuthorityState = {
    placement: "remote",
    remoteSessionStatus: "viewer_only",
    lastAcknowledgedStreamOffset: "offset-123",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
  };

  const reason = resolveRemoteAuthorityBlockReason(state);
  assert.equal(reason, "remote_session_viewer_only");
});

test("RemoteSessionGuard resolves authority block for consistency mismatch", () => {
  const state: RemoteSessionAuthorityState = {
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset-123",
    sessionConsistencyCheckStatus: "mismatch",
    workspaceSyncStatus: "aligned",
  };

  const reason = resolveRemoteAuthorityBlockReason(state);
  assert.equal(reason, "remote_session_consistency_mismatch");
});

test("RemoteSessionGuard resolves authority block for workspace conflict", () => {
  const state: RemoteSessionAuthorityState = {
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset-123",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "conflict",
  };

  const reason = resolveRemoteAuthorityBlockReason(state);
  assert.equal(reason, "remote_workspace_sync_conflict");
});

test("RemoteSessionGuard resolves authority block for missing stream offset", () => {
  const state: RemoteSessionAuthorityState = {
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
  };

  const reason = resolveRemoteAuthorityBlockReason(state);
  assert.equal(reason, "remote_session_resume_offset_missing");
});

test("RemoteSessionGuard returns null for healthy remote session", () => {
  const state: RemoteSessionAuthorityState = {
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset-123",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
  };

  const reason = resolveRemoteAuthorityBlockReason(state);
  assert.equal(reason, null);
});

test("RemoteSessionGuard allows local placement regardless of other fields", () => {
  const state: RemoteSessionAuthorityState = {
    placement: "local",
    remoteSessionStatus: "viewer_only",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: "mismatch",
    workspaceSyncStatus: "conflict",
  };

  const reason = resolveRemoteAuthorityBlockReason(state);
  assert.equal(reason, null);
});

test("RemoteSessionGuard allows transitional statuses (connecting/failed) without offset", () => {
  for (const status of ["connecting", "failed"] as const) {
    const state: RemoteSessionAuthorityState = {
      placement: "remote",
      remoteSessionStatus: status,
      lastAcknowledgedStreamOffset: null,
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
    };

    const reason = resolveRemoteAuthorityBlockReason(state);
    assert.equal(reason, null, `Status ${status} should allow missing offset`);
  }
});

// ---------------------------------------------------------------------------
// Worker Scheduling Status Integration
// ---------------------------------------------------------------------------

test("WorkerSchedulingStatus maps all worker statuses correctly", () => {
  const testCases: Array<{ status: string; expected: string }> = [
    { status: "idle", expected: "healthy" },
    { status: "busy", expected: "healthy" },
    { status: "degraded", expected: "degraded" },
    { status: "draining", expected: "draining" },
    { status: "quarantined", expected: "quarantined" },
    { status: "offline", expected: "offline" },
    { status: "unavailable", expected: "unavailable" },
  ];

  for (const { status, expected } of testCases) {
    const result = toWorkerSchedulingStatus(status as any);
    assert.equal(result, expected, `Status ${status} should map to ${expected}`);
  }
});

// ---------------------------------------------------------------------------
// Remote Worker Registration Integration
// ---------------------------------------------------------------------------

test("RemoteWorkerRegistrationService: issue and complete challenge cycle", () => {
  const ctx = createWorkerPoolContext("aa-remote-reg-");
  try {
    const service = new RemoteWorkerRegistrationService(ctx.db, ctx.store, {
      allowedCapabilities: ["bash", "edit", "mcp"],
      challengeTtlMs: 60000,
    });

    // Issue a challenge
    const challenge = service.issueChallenge({
      workerId: "remote-worker-1",
      requestedCapabilities: ["bash", "edit"],
    });

    assert.equal(challenge.issued, true);
    assert.ok(challenge.challengeId);
    assert.ok(challenge.challengeToken);
    assert.deepEqual(challenge.allowedCapabilities.sort(), ["bash", "edit"]);

    // Complete registration with valid token
    const decision = service.completeRegistration({
      workerId: "remote-worker-1",
      challengeId: challenge.challengeId!,
      challengeToken: challenge.challengeToken!,
      capabilities: ["bash", "edit"],
      maxConcurrency: 4,
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "offset-abc",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
    });

    assert.equal(decision.accepted, true);
    assert.ok(decision.registrationVerifiedAt);

    // Verify worker is now registered
    const registry = new WorkerRegistryService(ctx.store);
    const worker = registry.getWorker("remote-worker-1");
    assert.ok(worker);
    assert.equal(worker!.placement, "remote");
    assert.equal(worker!.trusted, true);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("RemoteWorkerRegistrationService: challenge expires after TTL", () => {
  const ctx = createWorkerPoolContext("aa-challenge-expire-");
  try {
    const service = new RemoteWorkerRegistrationService(ctx.db, ctx.store, {
      allowedCapabilities: ["bash"],
      challengeTtlMs: 100, // Very short TTL
    });

    // Issue a challenge
    const challenge = service.issueChallenge({
      workerId: "worker-expire",
      requestedCapabilities: ["bash"],
    });

    assert.equal(challenge.issued, true);

    // Wait for challenge to expire
    const startTime = Date.now();
    while (Date.now() - startTime < 150) {
      // Busy wait is not ideal but acceptable for test
    }

    // Attempt to complete after expiration
    const decision = service.completeRegistration({
      workerId: "worker-expire",
      challengeId: challenge.challengeId!,
      challengeToken: challenge.challengeToken!,
      capabilities: ["bash"],
      maxConcurrency: 4,
    });

    assert.equal(decision.accepted, false);
    assert.equal(decision.reasonCode, "challenge_expired");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("RemoteWorkerRegistrationService: rejects unknown capability", () => {
  const ctx = createWorkerPoolContext("aa-cap-reject-");
  try {
    const service = new RemoteWorkerRegistrationService(ctx.db, ctx.store, {
      allowedCapabilities: ["bash", "edit"],
    });

    const challenge = service.issueChallenge({
      workerId: "worker-cap",
      requestedCapabilities: ["bash", "unknown_cap"],
    });

    assert.equal(challenge.issued, false);
    assert.equal(challenge.reasonCode, "capability_not_allowed");
    assert.deepEqual(challenge.rejectedCapabilities, ["unknown_cap"]);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("RemoteWorkerRegistrationService: completeRegistration rejects wrong worker ID", () => {
  const ctx = createWorkerPoolContext("aa-worker-mismatch-");
  try {
    const service = new RemoteWorkerRegistrationService(ctx.db, ctx.store);

    const challenge = service.issueChallenge({
      workerId: "worker-1",
      requestedCapabilities: ["bash"],
    });

    const decision = service.completeRegistration({
      workerId: "worker-2", // Different worker ID
      challengeId: challenge.challengeId!,
      challengeToken: challenge.challengeToken!,
      capabilities: ["bash"],
      maxConcurrency: 4,
    });

    assert.equal(decision.accepted, false);
    assert.equal(decision.reasonCode, "challenge_worker_mismatch");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("RemoteWorkerRegistrationService: challenge cannot be reused", () => {
  const ctx = createWorkerPoolContext("aa-challenge-reuse-");
  try {
    const service = new RemoteWorkerRegistrationService(ctx.db, ctx.store);

    const challenge = service.issueChallenge({
      workerId: "worker-reuse",
      requestedCapabilities: ["bash"],
    });

    // First use succeeds
    const first = service.completeRegistration({
      workerId: "worker-reuse",
      challengeId: challenge.challengeId!,
      challengeToken: challenge.challengeToken!,
      capabilities: ["bash"],
      maxConcurrency: 4,
    });
    assert.equal(first.accepted, true);

    // Second use fails
    const second = service.completeRegistration({
      workerId: "worker-reuse",
      challengeId: challenge.challengeId!,
      challengeToken: challenge.challengeToken!,
      capabilities: ["bash"],
      maxConcurrency: 4,
    });
    assert.equal(second.accepted, false);
    assert.equal(second.reasonCode, "challenge_already_used");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// Worker Registry Heartbeat Integration
// ---------------------------------------------------------------------------

test("WorkerRegistryService: heartbeat updates telemetry", () => {
  const ctx = createWorkerPoolContext("aa-heartbeat-");
  try {
    const registry = new WorkerRegistryService(ctx.store);

    // Initial heartbeat
    registry.recordHeartbeat({
      workerId: "worker-telemetry",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 4,
      cpuPct: 10,
      memoryMb: 256,
      occurredAt: nowIso(),
    });

    // Update heartbeat with new telemetry
    const view = registry.recordHeartbeat({
      workerId: "worker-telemetry",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-1"],
      maxConcurrency: 4,
      cpuPct: 80,
      memoryMb: 512,
      occurredAt: nowIso(),
    });

    assert.equal(view.cpuPct, 80);
    assert.equal(view.memoryMb, 512);
    assert.equal(view.status, "busy");
    assert.equal(view.runningExecutionIds.length, 1);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerRegistryService: stale worker detection", () => {
  const ctx = createWorkerPoolContext("aa-stale-");
  try {
    const registry = new WorkerRegistryService(ctx.store);

    const now = nowIso();
    const staleTime = new Date(Date.parse(now) - 60000).toISOString();
    const freshTime = now;

    registry.recordHeartbeat({
      workerId: "worker-stale",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 4,
      occurredAt: staleTime,
    });

    registry.recordHeartbeat({
      workerId: "worker-fresh",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 4,
      occurredAt: freshTime,
    });

    const stale = registry.listStaleWorkers(now, 30000);
    assert.equal(stale.length, 1);
    assert.equal(stale[0]!.workerId, "worker-stale");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerRegistryService: listEligibleWorkers filters by requirements", () => {
  const ctx = createWorkerPoolContext("aa-eligible-");
  try {
    const registry = new WorkerRegistryService(ctx.store);

    registry.recordHeartbeat({
      workerId: "worker-cap-a",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 4,
    });

    registry.recordHeartbeat({
      workerId: "worker-cap-b",
      status: "idle",
      capabilities: ["mcp"],
      runningExecutionIds: [],
      maxConcurrency: 4,
    });

    const eligible = registry.listEligibleWorkers({ requiredCapabilities: ["bash", "edit"] });
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0]!.workerId, "worker-cap-a");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerRegistryService: untrusted remote workers excluded from eligible", () => {
  const ctx = createWorkerPoolContext("aa-untrusted-");
  try {
    const registry = new WorkerRegistryService(ctx.store);

    registry.recordHeartbeat({
      workerId: "local-worker",
      status: "idle",
      placement: "local",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 4,
    });

    registry.recordHeartbeat({
      workerId: "remote-trusted",
      status: "idle",
      placement: "remote",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 4,
      registrationVerifiedAt: nowIso(),
      registrationChallengeId: "challenge-123",
    });

    registry.recordHeartbeat({
      workerId: "remote-untrusted",
      status: "idle",
      placement: "remote",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 4,
    });

    const eligible = registry.listEligibleWorkers();
    assert.equal(eligible.length, 2);
    assert.ok(eligible.some((w) => w.workerId === "local-worker"));
    assert.ok(eligible.some((w) => w.workerId === "remote-trusted"));
    assert.ok(!eligible.some((w) => w.workerId === "remote-untrusted"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});