/**
 * Evolution CLI Tests
 *
 * Tests for evolution CLI module which handles agent evolution operations
 * including budget proposals, experience promotion, and proposal lifecycle management.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadEvolutionCliEnv } from "../../../../src/platform/control-plane/config-center/product-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

describe("loadEvolutionCliEnv", () => {
  it("parses propose_budget action", () => {
    const config = loadEvolutionCliEnv({
      AA_EVOLUTION_ACTION: "propose_budget",
      AA_DB_PATH: "/tmp/test.db",
      AA_TASK_ID: "task-123",
      AA_SOURCE_AGENT_ID: "agent-456",
      AA_SCOPE_TYPE: "task",
      AA_SCOPE_REF: "scope-ref-789",
      AA_PROPOSAL_REASON: "budget_increase_needed",
      AA_OBSERVED_AVERAGE_COST_USD: "10.50",
      AA_SAMPLE_SIZE: "100",
      AA_SUCCESS_RATE: "0.95",
    });

    assert.equal(config.action, "propose_budget");
    assert.equal(config.taskId, "task-123");
    assert.equal(config.sourceAgentId, "agent-456");
    assert.equal(config.scopeType, "task");
    assert.equal(config.scopeRef, "scope-ref-789");
    assert.equal(config.proposalReason, "budget_increase_needed");
    assert.equal(config.observedAverageCostUsd, 10.50);
    assert.equal(config.sampleSize, 100);
    assert.equal(config.successRate, 0.95);
  });

  it("parses propose_experience action", () => {
    const config = loadEvolutionCliEnv({
      AA_EVOLUTION_ACTION: "propose_experience",
      AA_DB_PATH: "/tmp/test.db",
      AA_TASK_ID: "task-abc",
      AA_SOURCE_AGENT_ID: "agent-def",
      AA_SCOPE_TYPE: "agent",
      AA_SCOPE_REF: "agent-123",
      AA_TARGET_SCOPE: "agent",
      AA_TASK_CONTEXT: "context summary",
      AA_TASK_INTENT: "intent summary",
    });

    assert.equal(config.action, "propose_experience");
    assert.equal(config.targetScope, "agent");
    assert.equal(config.taskContext, "context summary");
    assert.equal(config.taskIntent, "intent summary");
  });

  it("parses sync action", () => {
    const config = loadEvolutionCliEnv({
      AA_EVOLUTION_ACTION: "sync",
      AA_DB_PATH: "/tmp/test.db",
      AA_PROPOSAL_ID: "proposal-123",
    });

    assert.equal(config.action, "sync");
    assert.equal(config.proposalId, "proposal-123");
  });

  it("parses apply action", () => {
    const config = loadEvolutionCliEnv({
      AA_EVOLUTION_ACTION: "apply",
      AA_DB_PATH: "/tmp/test.db",
      AA_PROPOSAL_ID: "proposal-456",
      AA_APPLIED_BY: "admin-user",
    });

    assert.equal(config.action, "apply");
    assert.equal(config.proposalId, "proposal-456");
    assert.equal(config.appliedBy, "admin-user");
  });

  it("parses rollback action", () => {
    const config = loadEvolutionCliEnv({
      AA_EVOLUTION_ACTION: "rollback",
      AA_DB_PATH: "/tmp/test.db",
      AA_PROPOSAL_ID: "proposal-789",
      AA_ROLLED_BACK_BY: "admin-user",
      AA_REASON_CODE: "policy_violation",
    });

    assert.equal(config.action, "rollback");
    assert.equal(config.proposalId, "proposal-789");
    assert.equal(config.rolledBackBy, "admin-user");
    assert.equal(config.reasonCode, "policy_violation");
  });

  it("parses list action", () => {
    const config = loadEvolutionCliEnv({
      AA_EVOLUTION_ACTION: "list",
      AA_DB_PATH: "/tmp/test.db",
      AA_STATUS: "approved",
    });

    assert.equal(config.action, "list");
    assert.equal(config.status, "approved");
  });

  it("parses resolve_budget action", () => {
    const config = loadEvolutionCliEnv({
      AA_EVOLUTION_ACTION: "resolve_budget",
      AA_DB_PATH: "/tmp/test.db",
      AA_SCOPE_TYPE: "task",
      AA_SCOPE_REF: "task-123",
      AA_BASE_POLICY: '{"maxBudgetUsd": 100}',
    });

    assert.equal(config.action, "resolve_budget");
    assert.equal(config.scopeType, "task");
    assert.equal(config.scopeRef, "task-123");
  });

  it("parses evaluate_budget action", () => {
    const config = loadEvolutionCliEnv({
      AA_EVOLUTION_ACTION: "evaluate_budget",
      AA_DB_PATH: "/tmp/test.db",
      AA_SCOPE_TYPE: "task",
      AA_SCOPE_REF: "task-123",
      AA_CURRENT_TASK_COST_USD: "5.00",
      AA_NEXT_ESTIMATED_COST_USD: "8.00",
    });

    assert.equal(config.action, "evaluate_budget");
    assert.equal(config.currentTaskCostUsd, 5.00);
    assert.equal(config.nextEstimatedCostUsd, 8.00);
  });

  it("throws ValidationError for unknown action", () => {
    assert.throws(
      () =>
        loadEvolutionCliEnv({
          AA_EVOLUTION_ACTION: "unknown_action",
          AA_DB_PATH: "/tmp/test.db",
        }),
      (e) => e instanceof ValidationError && (e as ValidationError).code.includes("unknown_evolution_action"),
    );
  });
});
