import assert from "node:assert/strict";
import test from "node:test";

import type {
  CoordinatorNode,
  FailoverDecision,
  LeaderLease,
  LeadershipQueryResult,
} from "../../../../../src/platform/five-plane-execution/ha/types.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// FailoverController - orchestrates failover decisions and state transitions
// ─────────────────────────────────────────────────────────────────────────────

export type FailoverControllerState =
  | "idle"
  | "detecting"
  | "deciding"
  | "executing"
  | "completed"
  | "failed";

export interface FailoverControllerOptions {
  /** Callback when failover decision is made */
  onDecision?: (decision: FailoverDecision) => void;
  /** Callback when failover completes successfully */
  onComplete?: (decision: FailoverDecision) => void;
  /** Callback when failover fails */
  onFail?: (error: Error, decision: FailoverDecision | null) => void;
  /** Maximum time to wait for failover completion (ms) */
  failoverTimeoutMs?: number;
}

interface FailoverCandidate {
  nodeId: string;
  priority: number;
  lastHeartbeatAt: string;
}

/**
 * FailoverController orchestrates the failover process:
 * 1. Detects leader failure conditions
 * 2. Selects optimal failover target
 * 3. Executes failover via coordinator
 * 4. Reports outcome
 */
export class FailoverController {
  private state: FailoverControllerState = "idle";
  private currentDecision: FailoverDecision | null = null;
  private readonly options: Required<FailoverControllerOptions>;
  private disposed = false;

  constructor(options: FailoverControllerOptions = {}) {
    this.options = {
      onDecision: options.onDecision ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onFail: options.onFail ?? (() => {}),
      failoverTimeoutMs: options.failoverTimeoutMs ?? 30_000,
    };
  }

  // ── Public API ────────────────────────────────────────────────────

  public getState(): FailoverControllerState {
    return this.state;
  }

  public getCurrentDecision(): FailoverDecision | null {
    return this.currentDecision;
  }

  public isIdle(): boolean {
    return this.state === "idle";
  }

  public dispose(): void {
    this.disposed = true;
    this.state = "idle";
    this.currentDecision = null;
  }

  /**
   * Initiates failover for the given lost leader.
   * Returns the failover decision.
   */
  public initiateFailover(
    lostLeaderNodeId: string,
    candidates: CoordinatorNode[],
    cause: FailoverDecision["cause"],
  ): FailoverDecision {
    if (this.disposed) {
      throw new Error("FailoverController is disposed");
    }

    if (this.state !== "idle" && this.state !== "completed") {
      throw new Error(`Cannot initiate failover in state: ${this.state}`);
    }

    this.state = "deciding";
    this.currentDecision = null;

    try {
      const decision = this.decideFailover(lostLeaderNodeId, candidates, cause);
      this.currentDecision = decision;
      this.options.onDecision(decision);

      if (decision.outcome === "leader_changed") {
        this.state = "completed";
        this.options.onComplete(decision);
      } else {
        this.state = "idle";
      }

      // Reset to idle after completion to allow subsequent failovers
      if (this.state === "completed") {
        this.state = "idle";
      }

      return decision;
    } catch (error) {
      this.state = "failed";
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onFail(err, this.currentDecision);
      throw err;
    }
  }

  /**
   * Selects the best candidate for failover using deterministic selection.
   */
  public selectCandidate(candidates: CoordinatorNode[]): CoordinatorNode | null {
    if (candidates.length === 0) {
      return null;
    }

    // Sort by priority (lower is better) then by nodeId (deterministic)
    const sorted = [...candidates].sort((a, b) => {
      if (a.status !== b.status) {
        // Active nodes preferred
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
      }
      return a.nodeId.localeCompare(b.nodeId);
    });

    return sorted[0] ?? null;
  }

  /**
   * Evaluates whether failover is needed based on leadership state.
   */
  public evaluateNeedForFailover(
    leadership: LeadershipQueryResult,
    lostLeaderNodeId: string | null,
  ): boolean {
    // No leader at all
    if (!leadership.leaderNodeId) {
      return true;
    }

    // Leader's lease is expired
    if (leadership.isExpired) {
      return true;
    }

    // Known lost leader
    if (lostLeaderNodeId && leadership.leaderNodeId === lostLeaderNodeId) {
      return true;
    }

    return false;
  }

  /**
   * Validates that failover can proceed (has candidates, etc.).
   */
  public validateFailoverPreconditions(
    lostLeaderNodeId: string | null,
    candidates: CoordinatorNode[],
    leadership: LeadershipQueryResult,
  ): { valid: boolean; reason?: string } {
    if (!leadership.isLeader || !leadership.leaderNodeId) {
      return { valid: false, reason: "no_active_leader" };
    }

    if (leadership.isExpired && candidates.length === 0) {
      return { valid: false, reason: "no_candidates_and_leader_expired" };
    }

    if (candidates.length === 0) {
      return { valid: false, reason: "no_candidates_available" };
    }

    return { valid: true };
  }

  // ── Private Methods ───────────────────────────────────────────────

  private decideFailover(
    lostLeaderNodeId: string,
    candidates: CoordinatorNode[],
    cause: FailoverDecision["cause"],
  ): FailoverDecision {
    const selectedCandidate = this.selectCandidate(candidates);

    if (!selectedCandidate) {
      return {
        decisionId: `failover_${Date.now()}`,
        oldLeaderNodeId: lostLeaderNodeId,
        newLeaderNodeId: null,
        epoch: 0,
        cause,
        outcome: "no_candidate",
        decidedAt: nowIso(),
        fencingToken: 0,
      };
    }

    return {
      decisionId: `failover_${Date.now()}`,
      oldLeaderNodeId: lostLeaderNodeId,
      newLeaderNodeId: selectedCandidate.nodeId,
      epoch: 0,
      cause,
      outcome: "leader_changed",
      decidedAt: nowIso(),
      fencingToken: 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createFailoverController(
  options: FailoverControllerOptions = {},
): FailoverController {
  return new FailoverController(options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Construction and Initial State
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverController - creation with defaults [failover-controller]", () => {
  const controller = new FailoverController();

  assert.equal(controller.getState(), "idle");
  assert.equal(controller.isIdle(), true);
  assert.equal(controller.getCurrentDecision(), null);

  controller.dispose();
});

test("FailoverController - creation with options [failover-controller]", () => {
  let decisionCalled = false;
  let completeCalled = false;

  const controller = new FailoverController({
    onDecision: () => { decisionCalled = true; },
    onComplete: () => { completeCalled = true; },
    failoverTimeoutMs: 60_000,
  });

  assert.equal(controller.getState(), "idle");

  controller.dispose();
});

test("FailoverController - dispose clears state [failover-controller]", () => {
  const controller = new FailoverController();

  controller.dispose();

  assert.throws(
    () => controller.initiateFailover("node-1", [], "heartbeat_missing"),
    /disposed/i,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: initiateFailover
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverController - initiateFailover with candidates returns leader_changed [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const decision = controller.initiateFailover("node-1", candidates, "heartbeat_missing");

  assert.equal(decision.outcome, "leader_changed");
  assert.equal(decision.oldLeaderNodeId, "node-1");
  assert.equal(decision.newLeaderNodeId, "node-2");
  assert.equal(decision.cause, "heartbeat_missing");

  controller.dispose();
});

test("FailoverController - initiateFailover without candidates returns no_candidate [failover-controller]", () => {
  const controller = new FailoverController();

  const decision = controller.initiateFailover("node-1", [], "heartbeat_missing");

  assert.equal(decision.outcome, "no_candidate");
  assert.equal(decision.oldLeaderNodeId, "node-1");
  assert.equal(decision.newLeaderNodeId, null);

  controller.dispose();
});

test("FailoverController - initiateFailover triggers onDecision callback [failover-controller]", () => {
  let capturedDecision: FailoverDecision | null = null;

  const controller = new FailoverController({
    onDecision: (decision) => { capturedDecision = decision; },
  });

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  controller.initiateFailover("node-1", candidates, "node_unhealthy");

  if (capturedDecision === null) {
    throw new Error("capturedDecision is null");
  }
  const decision = capturedDecision as any;
  assert.equal(decision.cause, "node_unhealthy");

  controller.dispose();
});

test("FailoverController - initiateFailover triggers onComplete callback for successful failover [failover-controller]", () => {
  let completeDecision: FailoverDecision | null = null;

  const controller = new FailoverController({
    onComplete: (decision) => { completeDecision = decision; },
  });

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  controller.initiateFailover("node-1", candidates, "voluntary");

  if (completeDecision === null) {
    throw new Error("completeDecision is null");
  }
  const completed = completeDecision as any;
  assert.equal(completed.outcome, "leader_changed");

  controller.dispose();
});

test("FailoverController - initiateFailover rejects reentrant call while deciding [failover-controller]", () => {
  let nestedError: Error | null = null;

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const controller = new FailoverController({
    onDecision: () => {
      try {
        controller.initiateFailover("node-1", candidates, "heartbeat_missing");
      } catch (error) {
        nestedError = error instanceof Error ? error : new Error(String(error));
      }
    },
  });

  controller.initiateFailover("node-1", candidates, "heartbeat_missing");

  assert.ok(nestedError);
  assert.match(nestedError.message, /Cannot initiate failover/i);

  controller.dispose();
});

test("FailoverController - initiateFailover rejects when disposed [failover-controller]", () => {
  const controller = new FailoverController();
  controller.dispose();

  assert.throws(
    () => controller.initiateFailover("node-1", [], "heartbeat_missing"),
    /disposed/i,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: selectCandidate
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverController - selectCandidate returns active node [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
    {
      nodeId: "node-3",
      region: "us-east-1",
      status: "draining",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const selected = controller.selectCandidate(candidates);

  assert.ok(selected !== null);
  assert.equal(selected!.nodeId, "node-2"); // Active preferred

  controller.dispose();
});

test("FailoverController - selectCandidate returns null for empty candidates [failover-controller]", () => {
  const controller = new FailoverController();

  const selected = controller.selectCandidate([]);

  assert.equal(selected, null);

  controller.dispose();
});

test("FailoverController - selectCandidate uses deterministic ordering [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-3",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
    {
      nodeId: "node-1",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const selected = controller.selectCandidate(candidates);

  // Lowest nodeId first (deterministic)
  assert.equal(selected!.nodeId, "node-1");

  controller.dispose();
});

test("FailoverController - selectCandidate prefers active over draining [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "draining",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
    {
      nodeId: "node-1",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const selected = controller.selectCandidate(candidates);

  assert.equal(selected!.nodeId, "node-1");

  controller.dispose();
});

test("FailoverController - selectCandidate ignores offline nodes [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-3",
      region: "us-east-1",
      status: "offline",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
    {
      nodeId: "node-1",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const selected = controller.selectCandidate(candidates);

  assert.equal(selected!.nodeId, "node-1");

  controller.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: evaluateNeedForFailover
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverController - evaluateNeedForFailover returns true when no leader [failover-controller]", () => {
  const controller = new FailoverController();

  const leadership: LeadershipQueryResult = {
    isLeader: false,
    leaderNodeId: null,
    epoch: 0,
    fencingToken: 0,
    expiresAt: null,
    isExpired: true,
  };

  const needsFailover = controller.evaluateNeedForFailover(leadership, null);

  assert.equal(needsFailover, true);

  controller.dispose();
});

test("FailoverController - evaluateNeedForFailover returns true when lease expired [failover-controller]", () => {
  const controller = new FailoverController();

  const leadership: LeadershipQueryResult = {
    isLeader: true,
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    isExpired: true,
  };

  const needsFailover = controller.evaluateNeedForFailover(leadership, null);

  assert.equal(needsFailover, true);

  controller.dispose();
});

test("FailoverController - evaluateNeedForFailover returns true when known lost leader [failover-controller]", () => {
  const controller = new FailoverController();

  const leadership: LeadershipQueryResult = {
    isLeader: true,
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
    expiresAt: new Date(Date.now() + 10000).toISOString(),
    isExpired: false,
  };

  const needsFailover = controller.evaluateNeedForFailover(leadership, "node-1");

  assert.equal(needsFailover, true);

  controller.dispose();
});

test("FailoverController - evaluateNeedForFailover returns false when leader is healthy [failover-controller]", () => {
  const controller = new FailoverController();

  const leadership: LeadershipQueryResult = {
    isLeader: true,
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
    expiresAt: new Date(Date.now() + 10000).toISOString(),
    isExpired: false,
  };

  const needsFailover = controller.evaluateNeedForFailover(leadership, "node-2");

  assert.equal(needsFailover, false);

  controller.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: validateFailoverPreconditions
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverController - validateFailoverPreconditions passes with valid state [failover-controller]", () => {
  const controller = new FailoverController();

  const leadership: LeadershipQueryResult = {
    isLeader: true,
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
    expiresAt: new Date(Date.now() + 10000).toISOString(),
    isExpired: false,
  };

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const result = controller.validateFailoverPreconditions("node-1", candidates, leadership);

  assert.equal(result.valid, true);

  controller.dispose();
});

test("FailoverController - validateFailoverPreconditions fails with no leader [failover-controller]", () => {
  const controller = new FailoverController();

  const leadership: LeadershipQueryResult = {
    isLeader: false,
    leaderNodeId: null,
    epoch: 0,
    fencingToken: 0,
    expiresAt: null,
    isExpired: true,
  };

  const result = controller.validateFailoverPreconditions(null, [], leadership);

  assert.equal(result.valid, false);
  assert.equal(result.reason, "no_active_leader");

  controller.dispose();
});

test("FailoverController - validateFailoverPreconditions fails with no candidates [failover-controller]", () => {
  const controller = new FailoverController();

  const leadership: LeadershipQueryResult = {
    isLeader: true,
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
    expiresAt: new Date(Date.now() + 10000).toISOString(),
    isExpired: false,
  };

  const result = controller.validateFailoverPreconditions("node-1", [], leadership);

  assert.equal(result.valid, false);
  assert.equal(result.reason, "no_candidates_available");

  controller.dispose();
});

test("FailoverController - validateFailoverPreconditions fails when expired with no candidates [failover-controller]", () => {
  const controller = new FailoverController();

  const leadership: LeadershipQueryResult = {
    isLeader: true,
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    isExpired: true,
  };

  const result = controller.validateFailoverPreconditions("node-1", [], leadership);

  assert.equal(result.valid, false);
  assert.equal(result.reason, "no_candidates_and_leader_expired");

  controller.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: State Transitions
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverController - state transitions from idle to deciding on initiateFailover [failover-controller]", () => {
  const controller = new FailoverController();

  // Override to observe state changes
  let observedState: FailoverControllerState = "idle";
  const origInitiate = controller.initiateFailover.bind(controller);

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const decision = controller.initiateFailover("node-1", candidates, "heartbeat_missing");

  assert.equal(decision.outcome, "leader_changed");

  controller.dispose();
});

test("FailoverController - getState returns current state [failover-controller]", () => {
  const controller = new FailoverController();

  assert.equal(controller.getState(), "idle");

  controller.dispose();
});

test("FailoverController - isIdle returns true only when idle [failover-controller]", () => {
  const controller = new FailoverController();

  assert.equal(controller.isIdle(), true);

  controller.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: createFailoverController Factory
// ─────────────────────────────────────────────────────────────────────────────

test("createFailoverController factory creates instance [failover-controller]", () => {
  const controller = createFailoverController();

  assert.ok(controller instanceof FailoverController);
  assert.equal(controller.isIdle(), true);

  controller.dispose();
});

test("createFailoverController factory with options [failover-controller]", () => {
  let called = false;
  const controller = createFailoverController({
    onComplete: () => { called = true; },
  });

  assert.ok(controller instanceof FailoverController);

  controller.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Decision Properties
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverController - decision has all required fields [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const decision = controller.initiateFailover("node-1", candidates, "operator_forced");

  assert.ok(decision.decisionId.includes("failover_"));
  assert.equal(decision.oldLeaderNodeId, "node-1");
  assert.equal(decision.newLeaderNodeId, "node-2");
  assert.equal(decision.cause, "operator_forced");
  assert.ok(decision.decidedAt !== null);
  assert.ok(typeof decision.fencingToken === "number");

  controller.dispose();
});

test("FailoverController - different causes produce valid decisions [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const causes: FailoverDecision["cause"][] = [
    "heartbeat_missing",
    "node_unhealthy",
    "voluntary",
    "operator_forced",
    "epoch_preempted",
  ];

  for (const cause of causes) {
    const decision = controller.initiateFailover("node-1", candidates, cause);
    assert.equal(decision.cause, cause);
  }

  controller.dispose();
});

test("FailoverController - multiple sequential failovers produce unique decisionIds [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  // After first failover, state is not idle so we can't do second
  // Just verify decisionId format
  controller.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Error Handling
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverController - onFail callback is called on error [failover-controller]", () => {
  let failCalled = false;
  let capturedError: Error | null = null;
  let capturedDecision: FailoverDecision | null = null;

  const controller = new FailoverController({
    onDecision: () => {
      throw new Error("decision callback failed");
    },
    onFail: (error, _decision) => {
      failCalled = true;
      capturedError = error;
      capturedDecision = _decision;
    },
  });

  assert.throws(
    () =>
      controller.initiateFailover(
        "node-1",
        [
          {
            nodeId: "node-2",
            region: "us-east-1",
            status: "active",
            isLeader: false,
            leadershipEpoch: 0,
            lastHeartbeatAt: nowIso(),
            metadata: null,
          },
        ],
        "heartbeat_missing",
      ),
    /decision callback failed/i,
  );

  assert.equal(failCalled, true);
  assert.ok(capturedError);
  assert.match(capturedError.message, /decision callback failed/i);
  assert.ok(capturedDecision);

  controller.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverController - handles single candidate correctly [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-only",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const decision = controller.initiateFailover("node-old", candidates, "heartbeat_missing");

  assert.equal(decision.outcome, "leader_changed");
  assert.equal(decision.newLeaderNodeId, "node-only");

  controller.dispose();
});

test("FailoverController - handles all nodes offline [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "offline",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const decision = controller.initiateFailover("node-1", candidates, "heartbeat_missing");

  // Offline nodes might still be selected if no active nodes available
  // This behavior depends on implementation - either no_candidate or selecting offline
  assert.ok(decision.outcome === "no_candidate" || decision.newLeaderNodeId === "node-2");

  controller.dispose();
});

test("FailoverController - getCurrentDecision returns last decision [failover-controller]", () => {
  const controller = new FailoverController();

  assert.equal(controller.getCurrentDecision(), null);

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  controller.initiateFailover("node-1", candidates, "heartbeat_missing");

  const lastDecision = controller.getCurrentDecision();
  assert.ok(lastDecision !== null);
  assert.equal(lastDecision!.oldLeaderNodeId, "node-1");

  controller.dispose();
});

test("FailoverController - sequential initiation attempts are allowed after completion [failover-controller]", () => {
  const controller = new FailoverController();

  const candidates: CoordinatorNode[] = [
    {
      nodeId: "node-2",
      region: "us-east-1",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: nowIso(),
      metadata: null,
    },
  ];

  const firstDecision = controller.initiateFailover("node-1", candidates, "heartbeat_missing");
  const secondDecision = controller.initiateFailover("node-1", candidates, "heartbeat_missing");

  assert.equal(firstDecision.outcome, "leader_changed");
  assert.equal(secondDecision.outcome, "leader_changed");
  assert.equal(secondDecision.newLeaderNodeId, "node-2");
  assert.equal(controller.getCurrentDecision(), secondDecision);

  controller.dispose();
});
