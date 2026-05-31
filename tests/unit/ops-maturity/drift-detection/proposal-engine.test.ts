import assert from "node:assert/strict";
import test from "node:test";

import { SimpleProposalEngine } from "../../../../src/ops-maturity/drift-detection/proposal-engine.js";
import type { ReflectionRecord } from "../../../../src/ops-maturity/drift-detection/reflection-engine.js";

test("SimpleProposalEngine.create creates a proposal", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Test Proposal",
    description: "A test proposal",
    kind: "tool_routing_rule",
    target: "test_target",
    risk: "low",
    agentId: "agent_123",
    evidenceIds: ["ev_1"],
  });

  assert.equal(proposal.title, "Test Proposal");
  assert.equal(proposal.description, "A test proposal");
  assert.equal(proposal.kind, "tool_routing_rule");
  assert.equal(proposal.target, "test_target");
  assert.equal(proposal.risk, "low");
  assert.equal(proposal.status, "draft");
  assert.equal(proposal.reviewRequirement, "auto");
  assert.ok(proposal.id.startsWith("prop_"));
});

test("SimpleProposalEngine.create increments ID counter", async () => {
  const engine = new SimpleProposalEngine();
  const p1 = await engine.create({
    title: "Proposal 1",
    description: "First",
    kind: "tool_routing_rule",
    target: "t",
    risk: "low",
    agentId: "a",
    evidenceIds: [],
  });
  const p2 = await engine.create({
    title: "Proposal 2",
    description: "Second",
    kind: "skill_doc",
    target: "t",
    risk: "low",
    agentId: "a",
    evidenceIds: [],
  });

  // Parse IDs to compare
  const id1 = parseInt(p1.id.replace("prop_", ""));
  const id2 = parseInt(p2.id.replace("prop_", ""));
  assert.ok(id2 > id1);
});

test("SimpleProposalEngine.submitForApproval changes status to reviewed", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "t",
    risk: "low",
    agentId: "a",
    evidenceIds: [],
  });

  await engine.submitForApproval(proposal.id);

  const pending = await engine.listPending();
  assert.equal(pending.length, 0); // No longer pending

  const active = await engine.listActive();
  assert.equal(active.length, 1);
  assert.equal(active[0]!.status, "reviewed");
});

test("SimpleProposalEngine.listPending returns only draft proposals", async () => {
  const engine = new SimpleProposalEngine();
  await engine.create({
    title: "Pending",
    description: "desc",
    kind: "tool_routing_rule",
    target: "t",
    risk: "low",
    agentId: "a",
    evidenceIds: [],
  });
  await engine.create({
    title: "Also Pending",
    description: "desc",
    kind: "skill_doc",
    target: "t",
    risk: "low",
    agentId: "a",
    evidenceIds: [],
  });

  const pending = await engine.listPending();
  assert.equal(pending.length, 2);
});

test("SimpleProposalEngine.listActive returns only active proposals", async () => {
  const engine = new SimpleProposalEngine();
  const p1 = await engine.create({
    title: "Pending",
    description: "desc",
    kind: "tool_routing_rule",
    target: "t",
    risk: "low",
    agentId: "a",
    evidenceIds: [],
  });
  await engine.submitForApproval(p1.id);

  const active = await engine.listActive();
  assert.equal(active.length, 1);
  assert.equal(active[0]!.id, p1.id);
});

test("SimpleProposalEngine.canAutoPromote returns true for auto-promote kinds", () => {
  const engine = new SimpleProposalEngine();
  assert.equal(engine.canAutoPromote("tool_routing_rule"), true);
  assert.equal(engine.canAutoPromote("skill_doc"), true);
});

test("SimpleProposalEngine.canAutoPromote returns false for manual-only kinds", () => {
  const engine = new SimpleProposalEngine();
  assert.equal(engine.canAutoPromote("prompt_patch"), false);
  assert.equal(engine.canAutoPromote("workflow_template"), false);
  assert.equal(engine.canAutoPromote("threshold_tuning"), false);
});

test("SimpleProposalEngine.requiresManualApproval returns true for manual-only kinds", () => {
  const engine = new SimpleProposalEngine();
  assert.equal(engine.requiresManualApproval("prompt_patch"), true);
  assert.equal(engine.requiresManualApproval("workflow_template"), true);
  assert.equal(engine.requiresManualApproval("threshold_tuning"), true);
});

test("SimpleProposalEngine.requiresManualApproval returns false for auto-promote kinds", () => {
  const engine = new SimpleProposalEngine();
  assert.equal(engine.requiresManualApproval("tool_routing_rule"), false);
  assert.equal(engine.requiresManualApproval("skill_doc"), false);
});

test("SimpleProposalEngine.proposeFromReflection generates proposals based on root cause", async () => {
  const engine = new SimpleProposalEngine();
  const reflection: ReflectionRecord = {
    id: "ref_1",
    evidenceIds: ["ev_1", "ev_2"],
    taskType: "validation",
    rootCause: "type validation error in schema",
    recommendation: "fix the schema",
    confidence: 0.9,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const proposals = await engine.proposeFromReflection(reflection);
  assert.ok(proposals.length > 0);
  const routingProposal = proposals.find(p => p.kind === "tool_routing_rule");
  assert.ok(routingProposal !== undefined);
  assert.equal(routingProposal!.risk, "low");
  assert.equal(routingProposal!.status, "draft");
});

test("SimpleProposalEngine.proposeFromReflection handles test root cause", async () => {
  const engine = new SimpleProposalEngine();
  const reflection: ReflectionRecord = {
    id: "ref_1",
    evidenceIds: ["ev_1"],
    taskType: "testing",
    rootCause: "test failure in validation",
    recommendation: "fix tests",
    confidence: 0.8,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const proposals = await engine.proposeFromReflection(reflection);
  const skillDocProposal = proposals.find(p => p.kind === "skill_doc");
  assert.ok(skillDocProposal !== undefined);
  assert.equal(skillDocProposal!.risk, "low");
  assert.equal(skillDocProposal!.reviewRequirement, "auto");
});

test("SimpleProposalEngine.proposeFromReflection handles complex root cause", async () => {
  const engine = new SimpleProposalEngine();
  const reflection: ReflectionRecord = {
    id: "ref_1",
    evidenceIds: ["ev_1"],
    taskType: "planning",
    rootCause: "complex planning failure",
    recommendation: "improve planning",
    confidence: 0.7,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const proposals = await engine.proposeFromReflection(reflection);
  const workflowProposal = proposals.find(p => p.kind === "workflow_template");
  assert.ok(workflowProposal !== undefined);
  assert.equal(workflowProposal!.risk, "medium");
  assert.equal(workflowProposal!.reviewRequirement, "manual_review");
});

test("SimpleProposalEngine.proposeFromReflection handles security root cause", async () => {
  const engine = new SimpleProposalEngine();
  const reflection: ReflectionRecord = {
    id: "ref_1",
    evidenceIds: ["ev_1"],
    taskType: "security",
    rootCause: "security vulnerability detected",
    recommendation: "fix security",
    confidence: 0.95,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const proposals = await engine.proposeFromReflection(reflection);
  const securityProposal = proposals.find(p => p.kind === "prompt_patch");
  assert.ok(securityProposal !== undefined);
  assert.equal(securityProposal!.risk, "high");
  assert.equal(securityProposal!.reviewRequirement, "manual_review");
});

test("SimpleProposalEngine.proposeFromReflection handles multiple root causes", async () => {
  const engine = new SimpleProposalEngine();
  const reflection: ReflectionRecord = {
    id: "ref_1",
    evidenceIds: ["ev_1"],
    taskType: "mixed",
    rootCause: "type and test and complex issues",
    recommendation: "fix multiple things",
    confidence: 0.6,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const proposals = await engine.proposeFromReflection(reflection);
  // Should generate multiple proposals for different root causes
  assert.ok(proposals.length >= 2);
});

test("SimpleProposalEngine.propose processes multiple reflections", async () => {
  const engine = new SimpleProposalEngine();
  const reflections: ReflectionRecord[] = [
    {
      id: "ref_1",
      evidenceIds: ["ev_1"],
      taskType: "type",
      rootCause: "type error",
      recommendation: "fix type",
      confidence: 0.9,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "ref_2",
      evidenceIds: ["ev_2"],
      taskType: "security",
      rootCause: "security issue",
      recommendation: "fix security",
      confidence: 0.95,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  const proposals = await engine.propose(reflections);
  assert.ok(proposals.length >= 2);
});

test("SimpleProposalEngine.proposal has correct expectedBenefit structure", async () => {
  const engine = new SimpleProposalEngine();
  const reflection: ReflectionRecord = {
    id: "ref_1",
    evidenceIds: ["ev_1"],
    taskType: "type",
    rootCause: "type error",
    recommendation: "fix type",
    confidence: 0.9,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const proposals = await engine.proposeFromReflection(reflection);
  const proposal = proposals[0]!;
  assert.ok(proposal.expectedBenefit !== undefined);
  assert.ok(typeof proposal.expectedBenefit!.stability === "number" || typeof proposal.expectedBenefit!.quality === "number");
});

test("ImprovementProposal interface supports all status values", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "t",
    risk: "low",
    agentId: "a",
    evidenceIds: [],
  });

  // Verify all expected status values are possible
  const validStatuses = ["draft", "reviewed", "staged", "stable", "retired", "rejected"];
  assert.ok(validStatuses.includes(proposal.status));
});

test("SimpleProposalEngine.submitForApproval handles nonexistent proposal gracefully", async () => {
  await assert.doesNotReject(async () => {
    const engine = new SimpleProposalEngine();
    // submitForApproval does not throw for nonexistent proposal - it silently does nothing
    await engine.submitForApproval("nonexistent_proposal_id");
    // No error means it succeeded silently - which is fine for this test
  });
});

test("SimpleProposalEngine.listPending returns empty array when no proposals", async () => {
  const engine = new SimpleProposalEngine();
  const pending = await engine.listPending();
  assert.deepEqual(pending, []);
});

test("SimpleProposalEngine.listActive returns empty array when no active proposals", async () => {
  const engine = new SimpleProposalEngine();
  const active = await engine.listActive();
  assert.deepEqual(active, []);
});

test("SimpleProposalEngine.canAutoPromote handles unknown proposal kind", () => {
  const engine = new SimpleProposalEngine();
  // Unknown kinds default to not auto-promoting
  assert.equal(engine.canAutoPromote("unknown_kind" as any), false);
});

test("SimpleProposalEngine.requiresManualApproval handles unknown proposal kind", () => {
  const engine = new SimpleProposalEngine();
  // Unknown kinds don't require manual approval by default (returns false)
  assert.equal(engine.requiresManualApproval("unknown_kind" as any), false);
});
