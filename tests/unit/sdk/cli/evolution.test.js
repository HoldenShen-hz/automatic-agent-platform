import test from "node:test";
import assert from "node:assert/strict";
import { loadEvolutionCliEnv } from "../../../../src/platform/control-plane/config-center/product-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("loadEvolutionCliEnv parses current scope types and budget fields", () => {
    const budget = loadEvolutionCliEnv({
        AA_EVOLUTION_ACTION: "propose_budget",
        AA_DB_PATH: "/tmp/test.db",
        AA_TASK_ID: "task-123",
        AA_SOURCE_AGENT_ID: "agent-456",
        AA_SCOPE_TYPE: "workspace",
        AA_SCOPE_REF: "workspace-789",
        AA_PROPOSAL_REASON: "budget_increase_needed",
        AA_OBSERVED_AVERAGE_COST_USD: "10.5",
        AA_SAMPLE_SIZE: "100",
        AA_SUCCESS_RATE: "0.95",
        AA_CURRENT_POLICY_MAX_TASK_COST_USD: "8",
        AA_BASE_POLICY_MAX_TASK_COST_USD: "5",
    });
    const experience = loadEvolutionCliEnv({
        AA_EVOLUTION_ACTION: "propose_experience",
        AA_DB_PATH: "/tmp/test.db",
        AA_SCOPE_TYPE: "tenant",
        AA_SCOPE_REF: "tenant-123",
        AA_TARGET_SCOPE: "tenant",
        AA_TASK_CONTEXT: "context summary",
        AA_TASK_INTENT: "intent summary",
        AA_QUERY_TOOLS: "search,judge",
    });
    const evaluation = loadEvolutionCliEnv({
        AA_EVOLUTION_ACTION: "evaluate_budget",
        AA_DB_PATH: "/tmp/test.db",
        AA_SCOPE_TYPE: "organization",
        AA_SCOPE_REF: "org-123",
        AA_CURRENT_TASK_COST_USD: "5.00",
        AA_NEXT_ESTIMATED_COST_USD: "8.00",
    });
    assert.equal(budget.scopeType, "workspace");
    assert.equal(budget.currentPolicy.maxTaskCostUsd, 8);
    assert.equal(budget.basePolicy.maxTaskCostUsd, 5);
    assert.deepEqual(experience.queryTools, ["search", "judge"]);
    assert.equal(evaluation.currentTaskCostUsd, 5);
});
test("loadEvolutionCliEnv rejects invalid actions and scope types", () => {
    assert.throws(() => loadEvolutionCliEnv({
        AA_EVOLUTION_ACTION: "unknown_action",
        AA_DB_PATH: "/tmp/test.db",
    }), (error) => error instanceof ValidationError && error.code === "invalid_env:AA_EVOLUTION_ACTION");
    assert.throws(() => loadEvolutionCliEnv({
        AA_EVOLUTION_ACTION: "list",
        AA_DB_PATH: "/tmp/test.db",
        AA_SCOPE_TYPE: "task",
    }), (error) => error instanceof ValidationError && error.code === "invalid_env:AA_SCOPE_TYPE");
});
//# sourceMappingURL=evolution.test.js.map