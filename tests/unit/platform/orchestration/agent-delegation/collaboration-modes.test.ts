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

import {
  CollaborationModeService,
  createCollaborationModeService,
  type CollaborationResult,
} from "../../../../../src/platform/orchestration/agent-delegation/index.js";
import type {
  AgentContext,
  DelegationSpec,
  NegotiationProposal,
  PipelineStage,
} from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

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

  const stage1 = service.getCurrentPipelineStage(collaborationId);
  assert.equal(stage1?.status, "completed");
  assert.deepEqual(stage1?.output, { result: "stage-1-output" });

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
    () => service.advancePipelineStage("non-existent", {}),
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
  service.advancePipelineStage(collaborationId, { original: "data" });

  const state = service.getPipelineState(collaborationId);
  assert.ok(state?.stages[0].input === undefined); // Transform stored but not applied
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
  assert.equal(state?.rounds.length, 2);
});

test("CollaborationModeService completes negotiation on selection", () => {
  const service = createCollaborationModeService();
  const parent = createTestAgentContext();
  const spec = createNegotiationSpec();

  const collaborationId = service.initiateNegotiation(parent, spec);

  service.submitProposal(collaborationId, "agent-1", "worker", { answer: "a" }, 0.8);

  const proposal = service.selectProposal(collaborationId, "prop-1");

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
  assert.ok(result.errors[0].includes("timeout"));
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
