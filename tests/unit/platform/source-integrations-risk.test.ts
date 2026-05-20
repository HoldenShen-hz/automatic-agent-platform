import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ValidationError } from "../../../src/platform/contracts/errors.js";
import { loadRiskConfig } from "../../../src/platform/five-plane-control-plane/risk-control/risk-config-loader.js";
import { createUnhandledRejectionHandler } from "../../../src/platform/five-plane-execution/startup/process-error-handlers.js";
import { StartupConsistencyChecker } from "../../../src/platform/five-plane-execution/startup/startup-consistency-checker.js";
import { executeToolsInParallel } from "../../../src/platform/five-plane-execution/tool-executor/tool-parallel-executor.js";
import { EvaluatorService } from "../../../src/platform/five-plane-orchestration/evaluator/evaluator-service.js";
import { DelegationGovernanceService } from "../../../src/platform/five-plane-orchestration/agent-delegation/delegation-governance-service.js";
import { createDelegationTracker } from "../../../src/platform/five-plane-orchestration/agent-delegation/delegation-tracker.js";
import type { DelegationEvent, DelegationResult } from "../../../src/platform/five-plane-orchestration/agent-delegation/delegation-types.js";
import { ExecutionOutcomeEvaluator } from "../../../src/platform/prompt-engine/eval/execution-outcome-evaluator.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

function createDelegationResult(overrides: Partial<DelegationResult> = {}): DelegationResult {
  return {
    delegationId: `dlg-${Math.random().toString(36).slice(2)}`,
    parentAgentId: "parent-agent",
    childAgentId: "child-agent",
    depth: 1,
    permissions: {
      resources: ["resource-a"],
      actions: ["read"],
      constraints: {},
    },
    grantedPermissions: {
      resources: ["resource-a"],
      actions: ["read"],
      constraints: {},
    },
    createdAt: "2026-05-11T00:00:00.000Z",
    expiresAt: "2026-05-11T00:10:00.000Z",
    correlationId: "corr-1",
    status: "pending",
    ...overrides,
  };
}

function createMockGracefulShutdown() {
  const calls: string[] = [];
  return {
    calls,
    shutdown: {
      async initiateShutdown(reason?: string) {
        calls.push(reason ?? "unknown");
        return { success: true, handlersRun: 0, handlersFailed: 0, durationMs: 0, errors: [] };
      },
    },
  };
}

test("R31-54/R31-55/R31-57/R31-60/R31-62/R32-01/R32-02/R32-03/R32-04/R32-05/R32-06/R32-07/R32-08/R32-09/R32-13: source integrations and hardening stay wired", () => {
  const evaluatorSource = readFileSync("src/platform/five-plane-orchestration/evaluator/evaluator-service.ts", "utf8");
  const outcomeEvaluatorSource = readFileSync("src/platform/prompt-engine/eval/execution-outcome-evaluator.ts", "utf8");
  const managerSource = readFileSync("src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts", "utf8");
  const responseHardeningSource = readFileSync("src/platform/five-plane-interface/api/http-server/response-hardening.ts", "utf8");
  const transitionSource = readFileSync("src/platform/five-plane-execution/state-transition/transition-service.ts", "utf8");
  const toolPathScopeSource = readFileSync("src/platform/five-plane-execution/tool-executor/tool-path-scope.ts", "utf8");
  const toolExecutionAccessSource = readFileSync("src/platform/five-plane-execution/tool-executor/tool-execution-access.ts", "utf8");
  const mcpToolGuardSource = readFileSync("src/platform/five-plane-execution/tool-executor/mcp-tool-guard.ts", "utf8");
  const harnessLoopSource = readFileSync("src/platform/five-plane-orchestration/harness/loop/index.ts", "utf8");
  const guardrailSource = readFileSync("src/platform/five-plane-orchestration/harness/guardrails/guardrail-vibration-breaker.ts", "utf8");
  const webSearchSource = readFileSync("src/platform/five-plane-execution/tool-executor/web-search.ts", "utf8");
  const toolContractValidatorSource = readFileSync("src/platform/five-plane-execution/tool-executor/tool-contract-validator.ts", "utf8");

  assert.match(evaluatorSource, /new RiskEvaluationEngine/);
  assert.match(evaluatorSource, /this\.riskEvaluationEngine\.evaluate/);
  assert.match(outcomeEvaluatorSource, /new RiskEvaluationEngine/);
  assert.match(outcomeEvaluatorSource, /this\.riskEvaluationEngine\.evaluate/);
  assert.match(managerSource, /delegation\.error = error/);
  assert.match(managerSource, /resolveParentBudgetRemaining/);
  assert.match(managerSource, /this\.delegationTracker\.recordDelegation/);
  assert.match(managerSource, /this\.delegationTracker\.updateStatus/);
  assert.match(responseHardeningSource, /allowedOrigins\.includes\("\*"\)/);
  assert.match(transitionSource, /updateTaskStatusCas/);
  assert.match(transitionSource, /paused: \["streaming", "completed", "failed", "cancelled", "open"\]/);
  assert.match(toolPathScopeSource, /realpathSync\.native/);
  assert.match(toolPathScopeSource, /denying path/);
  assert.match(toolExecutionAccessSource, /allowedTools: \[\]/);
  assert.match(mcpToolGuardSource, /BUILTIN_TOOL_NAMES\.has\(toolName\)/);
  assert.match(harnessLoopSource, /const rawIterations = Math\.max\(1, Math\.floor\(budget\.maxSteps \/ 3\)\);/);
  assert.match(guardrailSource, /const cooldown = nextCount > this\.maxRepeatedActions/);
  assert.match(webSearchSource, /hostname = new URL\(url\)\.hostname/);
  assert.match(webSearchSource, /catch \{\s+continue;\s+\}/);
  assert.match(toolContractValidatorSource, /\(metadata\.toolName \?\? ""\)\.trim\(\)/);
});

test("R31-54: EvaluatorService and ExecutionOutcomeEvaluator can execute through RiskEvaluationEngine", () => {
  const bundle = {
    harnessRunId: "hrun-1",
    planGraphBundleId: "bundle-1",
    graphVersion: 1,
    riskProfile: {
      riskClass: "medium",
      reasons: ["baseline"],
    },
    budgetPlanRef: "budget-1",
    createdAt: Date.now(),
  };
  const feedback = {
    harnessRunId: "hrun-1",
    outcome: "failed",
    timestamp: Date.now(),
    signals: [
      {
        category: "failure",
        message: "step failed",
        severity: "error",
        timestamp: Date.now(),
        payload: {
          reasonCode: "step.failure",
        },
      },
    ],
  };

  const evaluatorService = new EvaluatorService();
  const evaluatorReport = evaluatorService.evaluate({
    planGraphBundle: bundle as never,
    feedback: feedback as never,
  });
  const outcomeEvaluator = new ExecutionOutcomeEvaluator();
  const outcomeReport = outcomeEvaluator.evaluate(bundle as never, feedback as never);

  assert.equal(evaluatorReport.findings.some((finding) => finding.category === "risk"), true);
  assert.ok(outcomeReport.dimensions.riskEvaluation.currentRiskScore >= 0);
});

test("R31-56: loadRiskConfig rejects malformed schema with ValidationError", () => {
  const tempDir = mkdtempSync(join("/tmp", "risk-config-reaudit-"));
  const configPath = join(tempDir, "invalid-risk.json");

  try {
    writeFileSync(configPath, JSON.stringify({
      factorWeights: {
        impact: 4,
      },
    }));

    assert.throws(
      () => loadRiskConfig(configPath),
      (error: unknown) => error instanceof ValidationError && error.code === "risk_config.invalid_schema",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("R31-58/R31-61: DelegationTracker keeps agent types and derives completion metrics from events", () => {
  const tracker = createDelegationTracker();

  tracker.recordDelegation(
    createDelegationResult({
      delegationId: "dlg-completed",
      childAgentId: "review-agent",
      createdAt: "2026-05-11T00:00:00.000Z",
    }),
    "parent-agent",
    { agentType: "reviewer" },
  );
  tracker.recordDelegation(
    createDelegationResult({
      delegationId: "dlg-failed",
      childAgentId: "worker-agent",
      createdAt: "2026-05-11T00:01:00.000Z",
    }),
    "parent-agent",
    { agentType: "worker" },
  );

  const completedEvent: DelegationEvent = {
    eventType: "delegation.completed",
    delegationId: "dlg-completed",
    durationMs: 250,
    timestamp: "2026-05-11T00:00:00.250Z",
  };
  const failedEvent: DelegationEvent = {
    eventType: "delegation.failed",
    delegationId: "dlg-failed",
    error: "timeout",
    timestamp: "2026-05-11T00:01:01.000Z",
  };

  tracker.recordEvent("dlg-completed", completedEvent);
  tracker.recordEvent("dlg-failed", failedEvent);

  const metrics = tracker.getMetrics("parent-agent");
  const tree = tracker.getTree("parent-agent");

  assert.equal(metrics.totalDelegations, 2);
  assert.equal(metrics.activeCount, 0);
  assert.equal(metrics.completedCount, 1);
  assert.equal(metrics.failedCount, 1);
  assert.equal(metrics.averageDurationMs, 625);
  assert.ok(tree);
  assert.equal(tree.agentType, "reviewer");
});

test("R31-59: ServiceRegistry.teardownAll awaits reverse-topology teardowns sequentially", async () => {
  const registry = ServiceRegistry.createScoped();
  const calls: string[] = [];

  registry.register("db", {
    init: () => ({ name: "db" }),
    teardown: async () => {
      calls.push("db:start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      calls.push("db:end");
    },
  });
  registry.register("worker", {
    init: () => ({ name: "worker" }),
    dependsOn: ["db"],
    teardown: async () => {
      calls.push("worker:start");
      await new Promise((resolve) => setTimeout(resolve, 5));
      calls.push("worker:end");
    },
  });

  registry.get("worker");
  await registry.teardownAll();

  assert.deepEqual(calls, ["worker:start", "worker:end", "db:start", "db:end"]);
});

test("R31-63: DelegationGovernanceService normalizes real agent roles into governance subject and target classes", () => {
  const service = new DelegationGovernanceService([
    {
      ruleId: "block_agent_subject",
      name: "Block Agent Subject",
      description: "worker/reviewer/etc should normalize to agent",
      enabled: true,
      priority: 1,
      condition: { subjectType: "agent" },
      effect: { decision: "deny", reasonCode: "delegation.subject_agent_blocked" },
    },
  ]);

  const subjectDecision = service.evaluate({
    parentContext: {
      agentId: "parent-1",
      agentType: "reviewer",
      packId: "pack-1",
      delegationDepth: 0,
      activeDelegations: [],
      permissions: { resources: [], actions: [], constraints: {} },
      sandboxTier: "workspace_write",
      correlationId: "corr-1",
      tenantId: null,
    },
    delegationSpec: {
      targetAgentId: "child-1",
      targetAgentType: "worker",
      targetPackId: "pack-2",
      requiredPermissions: { resources: [], actions: [], constraints: {} },
      timeout: 1000,
    },
  });
  assert.equal(subjectDecision.decision, "deny");

  const targetService = new DelegationGovernanceService([
    {
      ruleId: "block_agent_target",
      name: "Block Agent Target",
      description: "concrete target roles should normalize to agent",
      enabled: true,
      priority: 1,
      condition: { targetAgentType: "agent" },
      effect: { decision: "deny", reasonCode: "delegation.target_agent_blocked" },
    },
  ]);
  const targetDecision = targetService.evaluate({
    parentContext: {
      agentId: "parent-1",
      agentType: "planner",
      packId: "pack-1",
      delegationDepth: 0,
      activeDelegations: [],
      permissions: { resources: [], actions: [], constraints: {} },
      sandboxTier: "workspace_write",
      correlationId: "corr-1",
      tenantId: null,
    },
    delegationSpec: {
      targetAgentId: "child-1",
      targetAgentType: "reviewer",
      targetPackId: "pack-2",
      requiredPermissions: { resources: [], actions: [], constraints: {} },
      timeout: 1000,
    },
  });
  assert.equal(targetDecision.decision, "allow");
});

test("R32-10: unhandled rejection recoverability uses structured error codes instead of name strings", () => {
  const { calls, shutdown } = createMockGracefulShutdown();
  const handler = createUnhandledRejectionHandler(shutdown as never);
  const error = Object.assign(new Error("socket connect failed"), {
    name: "t",
    code: "ECONNREFUSED",
  });

  handler(error, Promise.resolve());

  assert.deepEqual(calls, []);
});

test("R32-11: StartupConsistencyChecker short-circuits after preflight P0 findings", () => {
  const checker = new StartupConsistencyChecker(
    {
      integrityCheck: () => [],
      getSchemaStatus: () => ({ pendingVersions: [], checksumMismatches: [] }),
    } as never,
    {
      operations: {
        listActiveTasksWithoutWorkflow: () => {
          throw new Error("should not scan tasks after preflight P0");
        },
        listStaleExecutions: () => [],
        listWorkflowTerminalMismatches: () => [],
        listOrphanSessions: () => [],
        listActiveTasksWithTerminalSessions: () => [],
        listActiveExecutionConflicts: () => [],
      },
      workflow: { listWorkflowStates: () => [] },
      event: {
        listPendingTier1Acks: () => [],
        listTier1EventRegistryCoverage: () => [],
      },
      lock: { listExpiredFileLocks: () => [] },
    } as never,
    {
      configValidator: () => ({
        ok: false,
        environment: "test",
        configRoot: null,
        issues: ["missing api key"],
        bundle: null,
      }),
    },
  );

  const report = checker.run();

  assert.equal(report.status, "fail_closed");
  assert.equal(report.findings.some((finding) => finding.code === "config_load_failed"), true);
});

test("R32-12: executeToolsInParallel exposes explicit indexed results without undefined holes", async () => {
  const result = await executeToolsInParallel(
    [
      async () => "ok",
      async () => {
        throw new Error("boom");
      },
    ],
    [
      {
        toolName: "read_ok",
        readOnly: true,
        idempotent: true,
        sideEffectScope: "none",
        needsFileLock: "none",
      },
      {
        toolName: "read_fail",
        readOnly: true,
        idempotent: true,
        sideEffectScope: "none",
        needsFileLock: "none",
      },
    ] as never,
  );

  assert.deepEqual(result.results, ["ok"]);
  assert.deepEqual(result.resultsByIndex, ["ok", null]);
  assert.equal(result.errors.length, 1);
});
