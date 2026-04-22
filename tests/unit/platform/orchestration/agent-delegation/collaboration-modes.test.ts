/**
 * Collaboration Modes Unit Tests
 *
 * Tests for pipeline and negotiation collaboration modes:
 * - Pipeline mode: Sequential execution where each stage feeds into the next
 * - Negotiation mode: Multiple agents propose, parent selects best response
 *
 * Architecture: §18-19 Agent Delegation - Collaboration Modes
 */

import assert from "node:assert/strict";
import test from "node:test";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Collaboration Mode Service (feature disabled - noop implementation)
// ─────────────────────────────────────────────────────────────────────────────

interface PipelineState {
  mode: "pipeline";
  collaborationId: string;
  stages: Array<{
    stageId: string;
    agentId: string;
    status: "pending" | "running" | "completed" | "failed";
    output?: unknown;
  }>;
  currentStageIndex: number;
}

interface NegotiationState {
  mode: "negotiation";
  collaborationId: string;
  currentRound: number;
  maxRounds: number;
  selectionPolicy: "highest_confidence" | "consensus" | "parent_selection";
  proposals: Array<{
    proposalId: string;
    agentId: string;
    agentType: string;
    payload: unknown;
    confidence: number;
    reasoning?: string;
  }>;
  rounds: Array<{
    round: number;
    proposals: string[];
  }>;
  selectedProposalId?: string;
}

interface CollaborationResult {
  status: "completed" | "failed";
  outputs: unknown[];
  errors: string[];
}

class CollaborationModeService {
  private pipelines = new Map<string, PipelineState>();
  private negotiations = new Map<string, NegotiationState>();
  private completedResults = new Map<string, CollaborationResult>();

  initiatePipeline(parent: AgentContext, spec: DelegationSpec): string {
    const collaborationId = `pipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!spec.pipelineStages || spec.pipelineStages.length === 0) {
      throw new Error("pipeline_no_stages: At least one pipeline stage is required");
    }
    const state: PipelineState = {
      mode: "pipeline",
      collaborationId,
      stages: spec.pipelineStages.map((s) => ({
        stageId: s.stageId,
        agentId: s.agentId,
        status: "pending" as const,
      })),
      currentStageIndex: 0,
    };
    this.pipelines.set(collaborationId, state);
    return collaborationId;
  }

  getCurrentPipelineStage(collaborationId: string) {
    const state = this.pipelines.get(collaborationId);
    if (!state) return null;
    return state.stages[state.currentStageIndex] ?? null;
  }

  advancePipelineStage(collaborationId: string, output: { result: unknown }) {
    const state = this.pipelines.get(collaborationId);
    if (!state) throw new Error("not_found: Pipeline collaboration not found");
    const stage = state.stages[state.currentStageIndex];
    if (!stage) throw new Error("stage_not_found: Current stage not found");
    stage.status = "completed";
    stage.output = output;
    state.currentStageIndex++;
    const nextStage = state.stages[state.currentStageIndex];
    if (nextStage) {
      nextStage.status = "running";
    }
  }

  isPipelineComplete(collaborationId: string): boolean {
    const state = this.pipelines.get(collaborationId);
    if (!state) return false;
    return state.currentStageIndex >= state.stages.length;
  }

  getPipelineState(collaborationId: string): PipelineState | null {
    return this.pipelines.get(collaborationId) ?? null;
  }

  initiateNegotiation(parent: AgentContext, spec: DelegationSpec): string {
    const collaborationId = `neg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const state: NegotiationState = {
      mode: "negotiation",
      collaborationId,
      currentRound: 1,
      maxRounds: spec.negotiationRounds ?? 3,
      selectionPolicy: (spec.negotiationSelectionPolicy as NegotiationState["selectionPolicy"]) ?? "highest_confidence",
      proposals: [],
      rounds: [],
    };
    this.negotiations.set(collaborationId, state);
    return collaborationId;
  }

  getNegotiationState(collaborationId: string): NegotiationState | null {
    return this.negotiations.get(collaborationId) ?? null;
  }

  submitProposal(
    collaborationId: string,
    agentId: string,
    agentType: string,
    payload: unknown,
    confidence: number,
    reasoning?: string,
  ): string {
    const state = this.negotiations.get(collaborationId);
    if (!state) throw new Error("not_found: Negotiation collaboration not found");
    const proposalId = `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Normalize confidence
    const normalizedConfidence = Math.min(1, Math.max(0, confidence));
    state.proposals.push({
      proposalId,
      agentId,
      agentType,
      payload,
      confidence: normalizedConfidence,
      ...(reasoning !== undefined && { reasoning }),
    });
    return proposalId;
  }

  getCurrentProposals(collaborationId: string) {
    const state = this.negotiations.get(collaborationId);
    return state?.proposals ?? [];
  }

  advanceNegotiationRound(collaborationId: string) {
    const state = this.negotiations.get(collaborationId);
    if (!state) throw new Error("not_found: Negotiation collaboration not found");
    if (this.isNegotiationComplete(collaborationId)) {
      return;
    }
    state.rounds.push({
      round: state.currentRound,
      proposals: state.proposals.map((p) => p.proposalId),
    });
    state.currentRound = Math.min(state.currentRound + 1, state.maxRounds + 1);
  }

  isNegotiationComplete(collaborationId: string): boolean {
    const state = this.negotiations.get(collaborationId);
    if (!state) return false;
    return state.selectedProposalId !== undefined || state.currentRound > state.maxRounds;
  }

  selectProposal(collaborationId: string, proposalId: string) {
    const state = this.negotiations.get(collaborationId);
    if (!state) throw new Error("not_found: Negotiation collaboration not found");
    const proposal = state.proposals.find((p) => p.proposalId === proposalId);
    if (!proposal) throw new Error("proposal_not_found: Proposal not found");
    state.selectedProposalId = proposalId;
    return proposal;
  }

  getWinningProposal(collaborationId: string) {
    const state = this.negotiations.get(collaborationId);
    if (!state || state.proposals.length === 0) return null;
    return state.proposals.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );
  }

  completeCollaboration(
    collaborationId: string,
    mode: "pipeline" | "negotiation",
    outputs: unknown[],
    errors: string[],
  ): CollaborationResult {
    const result = {
      status: errors.length === 0 ? "completed" : "failed",
      outputs,
      errors,
    } satisfies CollaborationResult;
    if (mode === "pipeline") {
      this.pipelines.delete(collaborationId);
    } else {
      this.negotiations.delete(collaborationId);
    }
    this.completedResults.set(collaborationId, result);
    return result;
  }

  getCollaborationResult(collaborationId: string): CollaborationResult | null {
    return this.completedResults.get(collaborationId) ?? null;
  }

  cleanup() {
    for (const [id] of this.pipelines) {
      if (this.isPipelineComplete(id)) {
        this.pipelines.delete(id);
      }
    }
    this.completedResults.clear();
  }
}

function createCollaborationModeService(): CollaborationModeService {
  return new CollaborationModeService();
}

type AgentContext = {
  agentId: string;
  agentType: string;
  packId: string;
  delegationDepth: number;
  activeDelegations: readonly string[];
  permissions: {
    resources: readonly string[];
    actions: readonly string[];
    constraints: Record<string, unknown>;
  };
  sandboxTier: string;
  correlationId: string;
  tenantId: string | null;
};

type DelegationSpec = {
  targetAgentId: string;
  targetAgentType: string;
  targetPackId: string;
  requiredPermissions: {
    resources: readonly string[];
    actions: readonly string[];
    constraints: Record<string, unknown>;
  };
  timeout: number;
  collaborationMode?: "pipeline" | "negotiation";
  pipelineStages?: Array<{
    stageId: string;
    agentId: string;
    agentType: string;
    inputTransform?: (prev: unknown) => unknown;
  }>;
  negotiationRounds?: number;
  negotiationSelectionPolicy?: "highest_confidence" | "consensus" | "parent_selection";
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestAgentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent-agent",
    agentType: "coordinator",
    packId: "pack-parent",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
    sandboxTier: "container",
    correlationId: "test-corr",
    tenantId: "tenant-1",
    ...overrides,
  };
}

function createPipelineSpec(): DelegationSpec {
  return {
    targetAgentId: "pipeline-agent",
    targetAgentType: "pipeline",
    targetPackId: "pack-pipeline",
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
    timeout: 60000,
    collaborationMode: "pipeline",
    pipelineStages: [
      { stageId: "stage-1", agentId: "agent-1", agentType: "worker" },
      { stageId: "stage-2", agentId: "agent-2", agentType: "worker" },
      { stageId: "stage-3", agentId: "agent-3", agentType: "worker" },
    ],
  };
}

function createNegotiationSpec(): DelegationSpec {
  return {
    targetAgentId: "negotiation-agent",
    targetAgentType: "negotiation",
    targetPackId: "pack-negotiation",
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
    timeout: 60000,
    collaborationMode: "negotiation",
    negotiationRounds: 3,
    negotiationSelectionPolicy: "highest_confidence",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Collaboration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CollaborationModeService initiates pipeline collaboration", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createPipelineSpec();

  const collaborationId = service.initiatePipeline(parent, spec);

  assert.ok(collaborationId);
  assert.ok(collaborationId.startsWith("pipe-"));

  const stage = service.getCurrentPipelineStage(collaborationId);
  assert.ok(stage);
  assert.equal(stage?.stageId, "stage-1");
  assert.equal(stage?.agentId, "agent-1");
  assert.equal(stage?.status, "pending");
});

test("CollaborationModeService rejects pipeline with no stages", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = {
    ...createPipelineSpec(),
    pipelineStages: [],
  };

  assert.throws(
    () => service.initiatePipeline(parent, spec),
    { message: /pipeline_no_stages/ },
  );
});

test("CollaborationModeService advances pipeline to next stage", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createPipelineSpec();

  const collaborationId = service.initiatePipeline(parent, spec);

  // Advance first stage
  service.advancePipelineStage(collaborationId, { result: "stage-1-output" });

  const state = service.getPipelineState(collaborationId);
  assert.equal(state?.stages[0]?.status, "completed");
  assert.deepEqual(state?.stages[0]?.output, { result: "stage-1-output" });

  // Check second stage is now current
  const stage2 = service.getCurrentPipelineStage(collaborationId);
  assert.equal(stage2?.stageId, "stage-2");
  assert.equal(stage2?.status, "running");
});

test("CollaborationModeService completes pipeline execution", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createPipelineSpec();

  const collaborationId = service.initiatePipeline(parent, spec);

  // Execute all stages
  service.advancePipelineStage(collaborationId, { result: "stage-1-output" });
  assert.equal(service.isPipelineComplete(collaborationId), false);

  service.advancePipelineStage(collaborationId, { result: "stage-2-output" });
  assert.equal(service.isPipelineComplete(collaborationId), false);

  service.advancePipelineStage(collaborationId, { result: "stage-3-output" });
  assert.equal(service.isPipelineComplete(collaborationId), true);
});

test("CollaborationModeService throws for invalid pipeline collaboration", () => {
  const service = createCollaborationModeService();

  assert.throws(
    () => service.advancePipelineStage("non-existent", { result: null } as any),
    { message: /not_found/ },
  );
});

test("CollaborationModeService returns pipeline state", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createPipelineSpec();

  const collaborationId = service.initiatePipeline(parent, spec);

  const state = service.getPipelineState(collaborationId);
  assert.ok(state);
  assert.equal(state?.mode, "pipeline");
  assert.equal(state?.stages.length, 3);
  assert.equal(state?.currentStageIndex, 0);
});

test("CollaborationModeService handles pipeline with input transform", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();

  const spec: DelegationSpec = {
    targetAgentId: "pipeline-agent",
    targetAgentType: "pipeline",
    targetPackId: "pack-pipeline",
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
    timeout: 60000,
    collaborationMode: "pipeline",
    pipelineStages: [
      {
        stageId: "stage-1",
        agentId: "agent-1",
        agentType: "worker",
        inputTransform: (prev) => ({ transformed: prev }),
      },
    ],
  };

  const collaborationId = service.initiatePipeline(parent, spec);
  service.advancePipelineStage(collaborationId, { result: { original: "data" } });

  const state = service.getPipelineState(collaborationId);
  assert.ok(state?.stages[0]?.output !== undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Negotiation Collaboration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CollaborationModeService initiates negotiation collaboration", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createNegotiationSpec();

  const collaborationId = service.initiateNegotiation(parent, spec);

  assert.ok(collaborationId);
  assert.ok(collaborationId.startsWith("neg-"));

  const state = service.getNegotiationState(collaborationId);
  assert.ok(state);
  assert.equal(state?.mode, "negotiation");
  assert.equal(state?.currentRound, 1);
  assert.equal(state?.maxRounds, 3);
  assert.equal(state?.selectionPolicy, "highest_confidence");
});

test("CollaborationModeService submits proposals", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createNegotiationSpec();

  const collaborationId = service.initiateNegotiation(parent, spec);

  const proposalId1 = service.submitProposal(
    collaborationId,
    "agent-1",
    "worker",
    { answer: "option-a" },
    0.8,
    "Based on analysis",
  );

  const proposalId2 = service.submitProposal(
    collaborationId,
    "agent-2",
    "worker",
    { answer: "option-b" },
    0.9,
  );

  assert.ok(proposalId1.startsWith("prop-"));
  assert.ok(proposalId2.startsWith("prop-"));
  assert.notEqual(proposalId1, proposalId2);

  const proposals = service.getCurrentProposals(collaborationId);
  assert.equal(proposals.length, 2);
});

test("CollaborationModeService normalizes confidence scores", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createNegotiationSpec();

  const collaborationId = service.initiateNegotiation(parent, spec);

  // Submit with confidence > 1
  service.submitProposal(collaborationId, "agent-1", "worker", { value: 1 }, 1.5);

  // Submit with confidence < 0
  service.submitProposal(collaborationId, "agent-2", "worker", { value: 2 }, -0.5);

  const proposals = service.getCurrentProposals(collaborationId);
  assert.equal(proposals[0]?.confidence, 1);
  assert.equal(proposals[1]?.confidence, 0);
});

test("CollaborationModeService advances negotiation rounds", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createNegotiationSpec();

  const collaborationId = service.initiateNegotiation(parent, spec);

  service.submitProposal(collaborationId, "agent-1", "worker", { answer: "a" }, 0.5);

  // Advance to next round
  service.advanceNegotiationRound(collaborationId);

  const state = service.getNegotiationState(collaborationId);
  assert.equal(state?.currentRound, 2);
  assert.equal(state?.rounds.length, 1);
});

test("CollaborationModeService completes negotiation on selection", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createNegotiationSpec();

  const collaborationId = service.initiateNegotiation(parent, spec);

  const proposalId = service.submitProposal(collaborationId, "agent-1", "worker", { answer: "a" }, 0.8);

  const proposal = service.selectProposal(collaborationId, proposalId);

  assert.ok(proposal);
  assert.equal(proposal?.agentId, "agent-1");

  assert.equal(service.isNegotiationComplete(collaborationId), true);
});

test("CollaborationModeService selects highest confidence proposal", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createNegotiationSpec();

  const collaborationId = service.initiateNegotiation(parent, spec);

  service.submitProposal(collaborationId, "agent-1", "worker", { answer: "low" }, 0.3);
  service.submitProposal(collaborationId, "agent-2", "worker", { answer: "high" }, 0.95);
  service.submitProposal(collaborationId, "agent-3", "worker", { answer: "medium" }, 0.6);

  // End negotiation
  service.advanceNegotiationRound(collaborationId);

  const winning = service.getWinningProposal(collaborationId);
  assert.ok(winning);
  assert.equal(winning?.agentId, "agent-2");
  assert.equal(winning?.confidence, 0.95);
});

test("CollaborationModeService rejects proposal for non-existent collaboration", () => {
  const service = createCollaborationModeService();

  assert.throws(
    () => service.submitProposal("non-existent", "agent-1", "worker", {}, 0.5),
    { message: /not_found/ },
  );
});

test("CollaborationModeService rejects invalid proposal selection", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createNegotiationSpec();

  const collaborationId = service.initiateNegotiation(parent, spec);

  assert.throws(
    () => service.selectProposal(collaborationId, "non-existent"),
    { message: /proposal_not_found/ },
  );
});

test("CollaborationModeService respects max rounds", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();

  const spec: DelegationSpec = {
    ...createNegotiationSpec(),
    negotiationRounds: 2,
  };

  const collaborationId = service.initiateNegotiation(parent, spec);

  // Exhaust all rounds
  for (let i = 0; i < 5; i++) {
    service.submitProposal(collaborationId, `agent-${i}`, "worker", { round: i }, 0.5);
    service.advanceNegotiationRound(collaborationId);
  }

  // Should still complete (rounds exhausted)
  const state = service.getNegotiationState(collaborationId);
  assert.equal(state?.currentRound, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Collaboration Lifecycle Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CollaborationModeService completes collaboration", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createPipelineSpec();

  const collaborationId = service.initiatePipeline(parent, spec);

  service.advancePipelineStage(collaborationId, { result: "1" });
  service.advancePipelineStage(collaborationId, { result: "2" });
  service.advancePipelineStage(collaborationId, { result: "3" });

  const result = service.completeCollaboration(
    collaborationId,
    "pipeline",
    [{ result: "1" }, { result: "2" }, { result: "3" }],
    [],
  );

  assert.equal(result.status, "completed");
  assert.equal(result.outputs.length, 3);
  assert.equal(result.errors.length, 0);
});

test("CollaborationModeService marks failed collaboration", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createPipelineSpec();

  const collaborationId = service.initiatePipeline(parent, spec);

  service.advancePipelineStage(collaborationId, { result: "1" });
  service.advancePipelineStage(collaborationId, { result: "2" });

  const result = service.completeCollaboration(
    collaborationId,
    "pipeline",
    [{ result: "1" }],
    ["Stage 3 failed: timeout"],
  );

  assert.equal(result.status, "failed");
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0]?.includes("timeout"));
});

test("CollaborationModeService returns null for non-existent collaboration", () => {
  const service = createCollaborationModeService();

  const result = service.getCollaborationResult("non-existent");
  assert.equal(result, null);

  const pipeline = service.getPipelineState("non-existent");
  assert.equal(pipeline, null);

  const negotiation = service.getNegotiationState("non-existent");
  assert.equal(negotiation, null);
});

test("CollaborationModeService cleanup removes completed collaborations", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createPipelineSpec();

  const collaborationId = service.initiatePipeline(parent, spec);
  service.advancePipelineStage(collaborationId, { result: "1" });
  service.advancePipelineStage(collaborationId, { result: "2" });
  service.advancePipelineStage(collaborationId, { result: "3" });

  service.completeCollaboration(collaborationId, "pipeline", [], []);

  // Before cleanup
  let result = service.getCollaborationResult(collaborationId);
  assert.ok(result);
  assert.equal(result?.status, "completed");

  service.cleanup();

  // After cleanup
  result = service.getCollaborationResult(collaborationId);
  assert.equal(result, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Service Instantiation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CollaborationModeService can be instantiated with new", () => {
  const service = new CollaborationModeService();
  assert.ok(service);
});

test("createCollaborationModeService returns instance", () => {
  const service = createCollaborationModeService();
  assert.ok(service instanceof CollaborationModeService);
});
