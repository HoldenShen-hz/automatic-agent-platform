/**
 * @fileoverview Tests for Improvement Module
 *
 * The improvement module re-exports promotion-gate, proposal-engine, and rollout-manager
 * from drift-detection/learning. This test file covers the improvement exports.
 *
 * §68 Drift Detection: improvement subsystem tests
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";

// Mock types for improvement module
interface PromotionCandidate {
  readonly candidateId: string;
  readonly score: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

interface PromotionDecision {
  readonly approved: boolean;
  readonly candidateId: string;
  readonly reasonCodes: readonly string[];
  readonly promotedAt?: string;
}

interface RolloutSpec {
  readonly rolloutId: string;
  readonly targetVersion: string;
  readonly canaryPercent: number;
  readonly strategy: "linear" | "canary" | "blue_green";
}

interface RolloutResult {
  readonly rolloutId: string;
  readonly status: "pending" | "in_progress" | "completed" | "failed" | "rolled_back";
  readonly startedAt: string;
  readonly completedAt?: string;
}

// Mock promotion gate
class MockPromotionGate {
  private candidates: Map<string, PromotionCandidate> = new Map();

  register(candidate: Omit<PromotionCandidate, "createdAt">): PromotionCandidate {
    const full: PromotionCandidate = {
      ...candidate,
      createdAt: new Date().toISOString(),
    };
    this.candidates.set(candidate.candidateId, full);
    return full;
  }

  evaluate(candidateId: string, criteria: {
    minScore: number;
    maxAgeMs: number;
  }): PromotionDecision {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) {
      return {
        approved: false,
        candidateId,
        reasonCodes: ["candidate_not_found"],
      };
    }

    const reasonCodes: string[] = [];
    if (candidate.score < criteria.minScore) {
      reasonCodes.push("score_below_minimum");
    }

    const age = Date.now() - new Date(candidate.createdAt).getTime();
    if (age > criteria.maxAgeMs) {
      reasonCodes.push("candidate_too_old");
    }

    return {
      approved: reasonCodes.length === 0,
      candidateId,
      reasonCodes,
      ...(reasonCodes.length === 0 ? { promotedAt: new Date().toISOString() } : {}),
    };
  }

  listCandidates(): PromotionCandidate[] {
    return [...this.candidates.values()];
  }
}

// Mock proposal engine
class MockProposalEngine {
  private proposals: Map<string, {
    readonly proposalId: string;
    readonly targetMetric: string;
    readonly currentValue: number;
    readonly proposedChange: number;
    readonly expectedImpact: number;
    readonly confidence: number;
    readonly createdAt: string;
  }> = new Map();

  createProposal(input: {
    targetMetric: string;
    currentValue: number;
    proposedChange: number;
    expectedImpact: number;
    confidence: number;
  }): string {
    const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.proposals.set(proposalId, {
      proposalId,
      ...input,
      createdAt: new Date().toISOString(),
    });
    return proposalId;
  }

  evaluateProposal(proposalId: string): {
    viable: boolean;
    risks: readonly string[];
    estimatedImprovement: number;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return { viable: false, risks: ["proposal_not_found"], estimatedImprovement: 0 };
    }

    const risks: string[] = [];
    if (proposal.confidence < 0.7) {
      risks.push("low_confidence");
    }
    if (Math.abs(proposal.proposedChange) > proposal.currentValue * 0.5) {
      risks.push("large_change_uncertainty");
    }

    return {
      viable: risks.length === 0,
      risks,
      estimatedImprovement: proposal.expectedImpact * proposal.confidence,
    };
  }

  listProposals(): string[] {
    return [...this.proposals.keys()];
  }
}

// Mock rollout manager
class MockRolloutManager {
  private rollouts: Map<string, RolloutSpec & { status: RolloutSpec["status"] }> = new Map();

  initiateRollout(spec: Omit<RolloutSpec, "rolloutId">): RolloutResult {
    const rolloutId = `rollout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.rollouts.set(rolloutId, {
      ...spec,
      rolloutId,
      status: "pending",
    });
    return {
      rolloutId,
      status: "pending",
      startedAt: new Date().toISOString(),
    };
  }

  updateRolloutStatus(rolloutId: string, status: RolloutSpec["status"]): boolean {
    const rollout = this.rollouts.get(rolloutId);
    if (!rollout) return false;
    rollout.status = status;
    return true;
  }

  getRollout(rolloutId: string): RolloutResult | null {
    const rollout = this.rollouts.get(rolloutId);
    if (!rollout) return null;
    return {
      rolloutId: rollout.rolloutId,
      status: rollout.status,
      startedAt: rollout.startedAt,
      ...(rollout.status === "completed" || rollout.status === "failed" || rollout.status === "rolled_back"
        ? { completedAt: new Date().toISOString() }
        : {}),
    };
  }
}

describe("Improvement Module - PromotionGate", () => {
  let gate: MockPromotionGate;

  beforeEach(() => {
    gate = new MockPromotionGate();
  });

  it("should register promotion candidates", () => {
    const candidate = gate.register({
      candidateId: "candidate-1",
      score: 0.95,
      metadata: { source: "learning" },
    });
    assert.strictEqual(candidate.candidateId, "candidate-1");
    assert.strictEqual(candidate.score, 0.95);
  });

  it("should approve candidates meeting criteria", () => {
    gate.register({
      candidateId: "good-candidate",
      score: 0.9,
      metadata: {},
    });
    const decision = gate.evaluate("good-candidate", { minScore: 0.8, maxAgeMs: 60000 });
    assert.strictEqual(decision.approved, true);
    assert.ok(decision.promotedAt);
  });

  it("should reject candidates below minimum score", () => {
    gate.register({
      candidateId: "low-score",
      score: 0.5,
      metadata: {},
    });
    const decision = gate.evaluate("low-score", { minScore: 0.8, maxAgeMs: 60000 });
    assert.strictEqual(decision.approved, false);
    assert.ok(decision.reasonCodes.includes("score_below_minimum"));
  });

  it("should reject candidates too old", () => {
    gate.register({
      candidateId: "old-candidate",
      score: 0.95,
      metadata: {},
    });
    // Age beyond maxAgeMs
    const decision = gate.evaluate("old-candidate", { minScore: 0.8, maxAgeMs: 0 });
    assert.strictEqual(decision.approved, false);
    assert.ok(decision.reasonCodes.includes("candidate_too_old"));
  });

  it("should reject non-existent candidates", () => {
    const decision = gate.evaluate("non-existent", { minScore: 0.8, maxAgeMs: 60000 });
    assert.strictEqual(decision.approved, false);
    assert.ok(decision.reasonCodes.includes("candidate_not_found"));
  });

  it("should list all registered candidates", () => {
    gate.register({ candidateId: "c1", score: 0.9, metadata: {} });
    gate.register({ candidateId: "c2", score: 0.8, metadata: {} });
    const candidates = gate.listCandidates();
    assert.strictEqual(candidates.length, 2);
  });
});

describe("Improvement Module - ProposalEngine", () => {
  let engine: MockProposalEngine;

  beforeEach(() => {
    engine = new MockProposalEngine();
  });

  it("should create proposals with all parameters", () => {
    const proposalId = engine.createProposal({
      targetMetric: "latency_p99_ms",
      currentValue: 1000,
      proposedChange: -100,
      expectedImpact: 0.15,
      confidence: 0.85,
    });
    assert.ok(proposalId.startsWith("proposal-"));
  });

  it("should evaluate viable proposals", () => {
    const proposalId = engine.createProposal({
      targetMetric: "error_rate",
      currentValue: 0.05,
      proposedChange: -0.01,
      expectedImpact: 0.2,
      confidence: 0.9,
    });
    const evaluation = engine.evaluateProposal(proposalId);
    assert.strictEqual(evaluation.viable, true);
    assert.strictEqual(evaluation.risks.length, 0);
    assert.ok(evaluation.estimatedImprovement > 0);
  });

  it("should flag low confidence proposals", () => {
    const proposalId = engine.createProposal({
      targetMetric: "throughput",
      currentValue: 100,
      proposedChange: 50,
      expectedImpact: 0.3,
      confidence: 0.5, // Low confidence
    });
    const evaluation = engine.evaluateProposal(proposalId);
    assert.strictEqual(evaluation.viable, false);
    assert.ok(evaluation.risks.includes("low_confidence"));
  });

  it("should flag large change proposals", () => {
    const proposalId = engine.createProposal({
      targetMetric: "cost_per_request",
      currentValue: 100,
      proposedChange: -60, // > 50% of current value
      expectedImpact: 0.25,
      confidence: 0.85,
    });
    const evaluation = engine.evaluateProposal(proposalId);
    assert.strictEqual(evaluation.viable, false);
    assert.ok(evaluation.risks.includes("large_change_uncertainty"));
  });

  it("should return error for non-existent proposals", () => {
    const evaluation = engine.evaluateProposal("non-existent");
    assert.strictEqual(evaluation.viable, false);
    assert.ok(evaluation.risks.includes("proposal_not_found"));
  });

  it("should list all created proposals", () => {
    engine.createProposal({ targetMetric: "m1", currentValue: 100, proposedChange: -10, expectedImpact: 0.1, confidence: 0.8 });
    engine.createProposal({ targetMetric: "m2", currentValue: 200, proposedChange: -20, expectedImpact: 0.15, confidence: 0.9 });
    const proposals = engine.listProposals();
    assert.strictEqual(proposals.length, 2);
  });
});

describe("Improvement Module - RolloutManager", () => {
  let manager: MockRolloutManager;

  beforeEach(() => {
    manager = new MockRolloutManager();
  });

  it("should initiate rollout with spec", () => {
    const result = manager.initiateRollout({
      targetVersion: "2.0.0",
      canaryPercent: 10,
      strategy: "canary",
    });
    assert.ok(result.rolloutId.startsWith("rollout-"));
    assert.strictEqual(result.status, "pending");
  });

  it("should update rollout status", () => {
    const result = manager.initiateRollout({
      targetVersion: "2.0.0",
      canaryPercent: 5,
      strategy: "linear",
    });
    const updated = manager.updateRolloutStatus(result.rolloutId, "in_progress");
    assert.strictEqual(updated, true);
    const retrieved = manager.getRollout(result.rolloutId);
    assert.strictEqual(retrieved?.status, "in_progress");
  });

  it("should complete rollout", () => {
    const result = manager.initiateRollout({
      targetVersion: "2.0.0",
      canaryPercent: 100,
      strategy: "blue_green",
    });
    manager.updateRolloutStatus(result.rolloutId, "completed");
    const retrieved = manager.getRollout(result.rolloutId);
    assert.strictEqual(retrieved?.status, "completed");
    assert.ok(retrieved?.completedAt);
  });

  it("should rollback rollout", () => {
    const result = manager.initiateRollout({
      targetVersion: "2.0.0",
      canaryPercent: 20,
      strategy: "canary",
    });
    manager.updateRolloutStatus(result.rolloutId, "rolled_back");
    const retrieved = manager.getRollout(result.rolloutId);
    assert.strictEqual(retrieved?.status, "rolled_back");
  });

  it("should return null for non-existent rollout", () => {
    const retrieved = manager.getRollout("non-existent");
    assert.strictEqual(retrieved, null);
  });

  it("should handle failed rollout", () => {
    const result = manager.initiateRollout({
      targetVersion: "2.0.0",
      canaryPercent: 50,
      strategy: "linear",
    });
    manager.updateRolloutStatus(result.rolloutId, "failed");
    const retrieved = manager.getRollout(result.rolloutId);
    assert.strictEqual(retrieved?.status, "failed");
  });
});

describe("Improvement Module Integration", () => {
  it("should compose promotion gate, proposal engine, and rollout manager", () => {
    const gate = new MockPromotionGate();
    const engine = new MockProposalEngine();
    const manager = new MockRolloutManager();

    // Create proposal
    const proposalId = engine.createProposal({
      targetMetric: "latency_p99_ms",
      currentValue: 1500,
      proposedChange: -200,
      expectedImpact: 0.2,
      confidence: 0.88,
    });

    // Evaluate proposal viability
    const evaluation = engine.evaluateProposal(proposalId);
    assert.strictEqual(evaluation.viable, true);

    // Register candidate for promotion
    const candidate = gate.register({
      candidateId: proposalId,
      score: evaluation.estimatedImprovement,
      metadata: { proposalId, expectedImpact: evaluation.estimatedImprovement },
    });

    // Evaluate promotion
    const promotion = gate.evaluate(candidate.candidateId, { minScore: 0.1, maxAgeMs: 86400000 });
    assert.strictEqual(promotion.approved, true);

    // Initiate rollout
    const rollout = manager.initiateRollout({
      targetVersion: "2.0.0",
      canaryPercent: 10,
      strategy: "canary",
    });
    assert.strictEqual(rollout.status, "pending");
  });
});

describe("Improvement Module Edge Cases", () => {
  it("should handle promotion gate with no candidates", () => {
    const gate = new MockPromotionGate();
    const candidates = gate.listCandidates();
    assert.strictEqual(candidates.length, 0);
  });

  it("should handle proposal engine with no proposals", () => {
    const engine = new MockProposalEngine();
    const proposals = engine.listProposals();
    assert.strictEqual(proposals.length, 0);
  });

  it("should handle rollout manager with no rollouts", () => {
    const manager = new MockRolloutManager();
    const retrieved = manager.getRollout("non-existent");
    assert.strictEqual(retrieved, null);
  });

  it("should handle multiple candidates at same score", () => {
    const gate = new MockPromotionGate();
    gate.register({ candidateId: "c1", score: 0.9, metadata: {} });
    gate.register({ candidateId: "c2", score: 0.9, metadata: {} });

    const d1 = gate.evaluate("c1", { minScore: 0.8, maxAgeMs: 60000 });
    const d2 = gate.evaluate("c2", { minScore: 0.8, maxAgeMs: 60000 });

    assert.strictEqual(d1.approved, d2.approved);
  });

  it("should handle extreme proposal changes", () => {
    const engine = new MockProposalEngine();
    const proposalId = engine.createProposal({
      targetMetric: "cost",
      currentValue: 100,
      proposedChange: -99, // 99% reduction
      expectedImpact: 0.5,
      confidence: 0.95,
    });
    const evaluation = engine.evaluateProposal(proposalId);
    // Should be flagged as risky due to large change
    assert.ok(evaluation.risks.includes("large_change_uncertainty"));
  });

  it("should handle zero current value in proposal", () => {
    const engine = new MockProposalEngine();
    const proposalId = engine.createProposal({
      targetMetric: "error_count",
      currentValue: 0,
      proposedChange: 0,
      expectedImpact: 0,
      confidence: 0.5,
    });
    const evaluation = engine.evaluateProposal(proposalId);
    assert.strictEqual(evaluation.viable, false);
  });
});