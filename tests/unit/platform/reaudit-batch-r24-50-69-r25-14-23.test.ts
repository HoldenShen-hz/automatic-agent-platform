import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { createDelegationRequest } from "../../../src/platform/contracts/delegation-request/index.js";
import { createExecutionPlan } from "../../../src/platform/contracts/execution-plan/index.js";
import { createModelRequest } from "../../../src/platform/contracts/model-request/index.js";
import { createRequestEnvelope } from "../../../src/platform/contracts/request-envelope/index.js";
import { RiskEvaluationEngine } from "../../../src/platform/five-plane-control-plane/risk-control/risk-evaluation-engine.js";
import { RiskFactorsSchema } from "../../../src/platform/five-plane-control-plane/risk-control/types.js";

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function createRiskEngine(): RiskEvaluationEngine {
  return new RiskEvaluationEngine({
    config: {
      factorWeights: {
        impact: 4,
        irreversibility: 4,
        dataSensitivity: 3,
        autonomyModeRisk: 2,
        tenantImpact: 2,
        blastRadius: 2,
        historicalFailureRate: 2,
        evidenceConfidence: 1,
      },
      impactValues: {},
      irreversibilityValues: {},
      dataSensitivityValues: {},
      autonomyModeRiskValues: {},
      tenantImpactValues: {},
      blastRadiusValues: {},
      historicalFailureRateThresholds: {
        low: { maxPercent: 10, value: 1 },
        medium: { maxPercent: 30, value: 2 },
        high: { maxPercent: 60, value: 3 },
        critical: { maxPercent: 100, value: 5 },
      },
      evidenceConfidenceValues: { high: 1, medium: 3, low: 5 },
      riskLevelThresholds: {
        low: 0,
        medium: 0.25,
        high: 0.5,
        critical: 0.75,
      },
      riskLevelActions: {
        low: {
          autoExecute: true,
          logLevel: "info",
          requiresApproval: false,
          sideEffect: "normal",
          evidenceLevel: "basic",
        },
        medium: {
          autoExecute: true,
          logLevel: "warn",
          requiresApproval: false,
          sideEffect: "normal_with_validation",
          evidenceLevel: "enhanced",
        },
        high: {
          autoExecute: false,
          logLevel: "error",
          requiresApproval: true,
          approvalType: "standard",
          sideEffect: "restricted",
          evidenceLevel: "full",
        },
        critical: {
          autoExecute: false,
          logLevel: "critical",
          requiresApproval: true,
          approvalType: "break_glass",
          sideEffect: "prohibited",
          evidenceLevel: "legal",
        },
      },
    },
  });
}

test("reaudit batch: UI visual regression baseline is wired into the UI quality workflow", () => {
  const uiPackage = readRepoFile("ui/package.json");
  const workflow = readRepoFile(".github/workflows/ui-quality.yml");
  const visualSpec = readRepoFile("ui/tests/playwright/visual-regression.spec.ts");

  assert.match(uiPackage, /"test:visual"\s*:\s*"playwright test tests\/playwright\/visual-regression\.spec\.ts"/);
  assert.match(workflow, /npm run test:visual/);
  assert.match(visualSpec, /toHaveScreenshot\("dashboard-shell\.png"/);
  assert.match(visualSpec, /toHaveScreenshot\("approval-center\.png"/);
});

test("reaudit batch: risk control uses the canonical 8-factor model and 0-1 normalization", () => {
  const parsed = RiskFactorsSchema.safeParse({
    impact: 5,
    irreversibility: 5,
    dataSensitivity: 5,
    autonomyModeRisk: 5,
    tenantImpact: 5,
    blastRadius: 5,
    historicalFailureRate: 100,
    evidenceConfidence: "low",
  });
  assert.equal(parsed.success, true);

  const legacyParsed = RiskFactorsSchema.safeParse({
    impact: 5,
    irreversibility: 5,
    dataSensitivity: 5,
    blastRadius: 5,
    historicalFailureRate: 100,
    operatorExperience: 1,
    externalExposure: 1,
    recoveryComplexity: 1,
  });
  assert.equal(legacyParsed.success, false);

  const result = createRiskEngine().evaluate({
    taskId: "task-risk-max",
    factors: parsed.data,
  });

  assert.equal(result.riskScore, 1);
  assert.equal(result.riskLevel, "critical");
  assert.equal(result.factorBreakdown.length, 8);
  assert.deepEqual(
    result.factorBreakdown.map((item) => item.factor),
    [
      "impact",
      "irreversibility",
      "dataSensitivity",
      "autonomyModeRisk",
      "tenantImpact",
      "blastRadius",
      "historicalFailureRate",
      "evidenceConfidence",
    ],
  );
});

test("reaudit batch: legacy request envelope carries cross-plane routing metadata", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_legacy_cross_plane",
    confirmedTaskSpecId: "cts_legacy_cross_plane",
    tenantId: "tenant_alpha",
    principal: { principalId: "principal_alpha", tenantId: "tenant_alpha", roles: ["operator"] },
    traceId: "trace_alpha",
    idempotencyKey: "idem_alpha",
    priority: 2,
    taskId: "task_alpha",
    sessionId: "sess_alpha",
    mode: "async",
    body: { operation: "dispatch" },
    sourcePlane: "interaction",
    targetPlane: "orchestration",
    directives: [{ directiveType: "operator_review_required", reason: "risk.high" } as never],
  });

  assert.equal(envelope.sourcePlane, "interaction");
  assert.equal(envelope.targetPlane, "orchestration");
  assert.equal(envelope.directives.length, 1);
});

test("reaudit batch: e2e coverage no longer bypasses RSM for multi-step workflow and budget guard", () => {
  const multiStepWorkflow = readRepoFile("tests/e2e/multi-step-workflow.test.ts");
  const harnessLoop = readRepoFile("tests/e2e/harness-loop-e2e.test.ts");

  assert.doesNotMatch(multiStepWorkflow, /updateWorkflowState\s*\(/);
  assert.match(harnessLoop, /loop aborts when max cost exceeded and cost guard triggers/);
  assert.match(harnessLoop, /cost_exceeds_budget/);
});

test("reaudit batch: OAPEFLIR full-loop e2e routes execute through RuntimeExecuteBridge", () => {
  const oapeflirFullLoop = readRepoFile("tests/e2e/oapeflir-full-loop.test.ts");

  assert.match(oapeflirFullLoop, /RuntimeExecuteBridge/);
  assert.doesNotMatch(oapeflirFullLoop, /new DeterministicE2EBridge\s*\(/);
});

test("reaudit batch: legacy state and transition contracts expose canonical control fields", () => {
  const stateCommand = readRepoFile("src/platform/contracts/state-command/index.ts");
  const transitionTypes = readRepoFile("src/platform/contracts/types/domain/core-types.ts");

  for (const field of ["traceId", "principal", "leaseId", "fencingToken", "event", "expectedStatus"]) {
    assert.match(stateCommand, new RegExp(`readonly\\s+${field}\\??:`));
  }

  for (const field of ["principal", "leaseId", "fencingToken", "event", "payload", "expectedVersion"]) {
    assert.match(transitionTypes, new RegExp(`${field}\\??:`));
  }
});

test("reaudit batch: canonical runtime objects are exported and legacy execution-plan path is guarded", () => {
  const executableContracts = readRepoFile("src/platform/contracts/executable-contracts/index.ts");
  const contractModels = readRepoFile("src/platform/contracts/executable-contracts/contract-models.ts");
  const executionPlan = readRepoFile("src/platform/contracts/execution-plan/index.ts");

  assert.match(executableContracts, /export \* from "\.\/contract-models\.js";/);
  for (const iface of ["HarnessRun", "NodeRun", "NodeAttempt", "BudgetReservation", "SideEffectRecord"]) {
    assert.match(contractModels, new RegExp(`export interface ${iface}`));
  }

  assert.match(executionPlan, /type PlanGraphBundle/);
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_plan_legacy",
        tenantId: "tenant_plan_legacy",
        version: 1,
        steps: [],
      }),
    /PlanGraphBundle/,
  );
});

test("reaudit batch: legacy receipt and request-side contracts retain canonical runtime identifiers", () => {
  const executionReceipt = readRepoFile("src/platform/contracts/execution-receipt/index.ts");
  const executionTypes = readRepoFile("src/platform/contracts/types/domain/execution-types.ts");
  const workspaceTypes = readRepoFile("src/platform/contracts/types/domain/workspace-types.ts");
  const primitives = readRepoFile("src/platform/contracts/types/domain/primitives.ts");

  for (const field of ["harnessRunId", "planGraphId", "nodeRunId", "attemptId"]) {
    assert.match(executionReceipt, new RegExp(`${field}`));
  }
  assert.match(executionTypes, /nodeRunId\?: string \| null/);
  assert.match(executionTypes, /planGraphId\?: string \| null/);
  assert.match(primitives, /"node_run"/);
  assert.match(workspaceTypes, /quotas: TenantQuotas;/);
});

test("reaudit batch: model and delegation requests retain budget linkage", () => {
  const modelRequest = createModelRequest({
    model: "gpt-test",
    messages: [{ role: "user", content: "hello" }],
    temperature: null,
    maxTokens: 256,
    tenantId: "tenant_budget",
    taskId: "task_budget",
    budgetReservationId: "bresv_model_001",
  });
  assert.equal(modelRequest.budgetReservationId, "bresv_model_001");

  const delegationRequest = createDelegationRequest({
    taskId: "task_delegate",
    fromAgentId: "agent_a",
    toAgentId: "agent_b",
    capabilityRef: null,
    priority: "high",
    reason: "delegate heavy step",
    contextRef: null,
    tenantId: "tenant_budget",
    budgetReservationId: "bresv_delegate_001",
    budgetEnvelope: { amount: 1.5, currency: "USD", resourceKinds: ["token", "compute"] },
  });
  assert.equal(delegationRequest.budgetReservationId, "bresv_delegate_001");
  assert.deepEqual(delegationRequest.budgetEnvelope, {
    amount: 1.5,
    currency: "USD",
    resourceKinds: ["token", "compute"],
  });
});
