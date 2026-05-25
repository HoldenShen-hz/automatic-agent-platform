/**
 * Unit tests for buildRiskPreview functions in nl-gateway-support.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRiskPreview,
  buildRiskPreviewWithDryRun,
  CRITICAL_RISK_KEYWORDS,
  HIGH_RISK_KEYWORDS,
  IRREVERSIBLE_KEYWORDS,
  buildDryRunPreview,
} from "../../../../src/interaction/nl-gateway/nl-gateway-support.js";
import type { DryRunExecutorPort, ContextEnrichment, NlEntryRequest } from "../../../../src/interaction/nl-gateway/index.js";

test("buildRiskPreview returns low risk for benign messages", () => {
  const result = buildRiskPreview("帮我创建一个任务", "task_create");

  assert.equal(result.overallRisk, "low");
  assert.equal(result.reversible, true);
  assert.equal(result.approvalNeeded, false);
});

test("buildRiskPreview returns critical risk for CRITICAL_RISK_KEYWORDS", () => {
  const result = buildRiskPreview("delete production database", "task_modify");

  assert.equal(result.overallRisk, "critical");
  assert.equal(result.reversible, false);
  assert.equal(result.approvalNeeded, true);
});

test("buildRiskPreview returns high risk for HIGH_RISK_KEYWORDS", () => {
  const result = buildRiskPreview("deploy to production", "task_create");

  assert.equal(result.overallRisk, "high");
  assert.equal(result.approvalNeeded, true);
});

test("buildRiskPreview returns medium risk for task_modify intent", () => {
  const result = buildRiskPreview("modify the configuration", "task_modify");

  assert.equal(result.overallRisk, "medium");
  assert.equal(result.reversible, true);
});

test("buildRiskPreview includes riskFactors for destructive operations", () => {
  const result = buildRiskPreview("delete production database", "task_modify");

  assert.ok(result.riskFactors.length > 0);
  assert.ok(result.riskFactors.some(f => f.includes("破坏性")));
});

test("buildRiskPreview includes sideEffects for cost/budget keywords", () => {
  const result = buildRiskPreview("change the budget allocation", "task_modify");

  assert.ok(result.sideEffects.some(s => s.includes("成本") || s.includes("预算")));
});

test("buildRiskPreview includes sideEffects for deploy/release keywords", () => {
  const result = buildRiskPreview("release version 2.0", "task_create");

  assert.ok(result.sideEffects.some(s => s.includes("运行中") || s.includes("用户体验")));
});

test("buildRiskPreview includes sideEffects for delete keywords", () => {
  const result = buildRiskPreview("remove the old files", "task_modify");

  assert.ok(result.sideEffects.some(s => s.includes("数据") || s.includes("配置")));
});

test("buildRiskPreview adds approval requirement for approval_action intent", () => {
  const result = buildRiskPreview("approve this invoice", "approval_action");

  assert.equal(result.approvalNeeded, true);
  assert.ok(result.riskFactors.some(f => f.includes("审批")));
});

test("buildRiskPreview sets reversible false for IRREVERSIBLE_KEYWORDS", () => {
  const result = buildRiskPreview("清空所有记录", "task_modify");

  assert.equal(result.reversible, false);
});

test("buildRiskPreview returns canonical camelCase fields only", () => {
  const result = buildRiskPreview("deploy to staging", "task_create");

  assert.equal(result.overallRisk, "high");
  assert.ok(!("overall_risk" in result));
  assert.ok(!("risk_factors" in result));
  assert.ok(!("side_effects" in result));
  assert.ok(!("approval_needed" in result));
});

test("buildRiskPreview handles Chinese critical keywords", () => {
  const result = buildRiskPreview("删除生产环境数据", "task_modify");

  assert.equal(result.overallRisk, "critical");
});

test("buildRiskPreviewWithDryRun executes dry run for high risk", async () => {
  let executed = false;
  const mockExecutor: DryRunExecutorPort = {
    executeDryRun: async (input) => {
      executed = true;
      return {
        blocked: false,
        actualRiskLevel: "high",
        detectedSideEffects: ["additional side effect from dry run"],
        policyCheckResults: ["policy_check_passed"],
      };
    },
  };

  const result = await buildRiskPreviewWithDryRun(
    "delete from production",
    "task_modify",
    mockExecutor,
    { message: "delete from production", divisionId: "eng", workflowId: "wf1", userId: "u1", locale: "en-US" },
  );

  assert.equal(executed, true);
  assert.equal(result.overallRisk, "high");
  assert.ok(result.sideEffects.some(s => s.includes("additional side effect")));
});

test("buildRiskPreviewWithDryRun uses dry run result when available", async () => {
  const mockExecutor: DryRunExecutorPort = {
    executeDryRun: async () => ({
      blocked: false,
      actualRiskLevel: "medium",
      detectedSideEffects: [],
      policyCheckResults: [],
    }),
  };

  // Message contains "delete" which would normally be high risk
  const result = await buildRiskPreviewWithDryRun(
    "delete some records",
    "task_modify",
    mockExecutor,
    { message: "delete some records", divisionId: "eng", workflowId: "wf1", userId: "u1", locale: "en-US" },
  );

  // Dry run adjusted the risk from high to medium
  assert.equal(result.overallRisk, "medium");
});

test("buildRiskPreviewWithDryRun falls back when dry run fails", async () => {
  const mockExecutor: DryRunExecutorPort = {
    executeDryRun: async () => {
      throw new Error("Dry run failed");
    },
  };

  const result = await buildRiskPreviewWithDryRun(
    "deploy to production",
    "task_create",
    mockExecutor,
    { message: "deploy to production", divisionId: "eng", workflowId: "wf1", userId: "u1", locale: "en-US" },
  );

  // Falls back to keyword-based assessment
  assert.equal(result.overallRisk, "high");
});

test("buildRiskPreviewWithDryRun skips dry run for low/critical risk", async () => {
  let executed = false;
  const mockExecutor: DryRunExecutorPort = {
    executeDryRun: async () => {
      executed = true;
      return {
        blocked: false,
        actualRiskLevel: "low",
        detectedSideEffects: [],
        policyCheckResults: [],
      };
    },
  };

  // Low risk message - dry run should not be called
  await buildRiskPreviewWithDryRun(
    "create a simple task",
    "task_create",
    mockExecutor,
    { message: "create a simple task", divisionId: "eng", workflowId: "wf1", userId: "u1", locale: "en-US" },
  );

  assert.equal(executed, false);
});

test("buildDryRunPreview returns undefined for low risk without approval needed", () => {
  const result = buildDryRunPreview({
    request: { tenantId: "t1", userId: "u1", message: "hello", locale: "en-US" } as NlEntryRequest,
    divisionId: "eng",
    workflowId: "wf1",
    riskPreview: {
      overallRisk: "low",
      riskFactors: [],
      reversible: true,
      sideEffects: [],
      approvalNeeded: false,
    },
    context: {
      domainHint: "eng",
      extractedConstraints: [],
      targetEnvironments: [],
      requestedChannels: [],
      timelineRefs: [],
    } as ContextEnrichment,
  });

  assert.equal(result, undefined);
});

test("buildDryRunPreview returns preview for critical risk", () => {
  const result = buildDryRunPreview({
    request: { tenantId: "t1", userId: "u1", message: "delete prod", locale: "en-US" } as NlEntryRequest,
    divisionId: "eng",
    workflowId: "wf1",
    riskPreview: {
      overallRisk: "critical",
      riskFactors: ["destructive operation"],
      reversible: false,
      sideEffects: ["data loss"],
      approvalNeeded: true,
    },
    context: {
      domainHint: "eng",
      extractedConstraints: [],
      targetEnvironments: ["production"],
      requestedChannels: ["slack"],
      timelineRefs: [],
    } as ContextEnrichment,
  });

  assert.ok(result !== undefined);
  assert.equal(result.mode, "dry_run");
  assert.equal(result.approvalRequired, true);
  assert.ok(result.proposedOperations.some(op => op.includes("production")));
});

test("buildDryRunPreview returns preview when approval is needed", () => {
  const result = buildDryRunPreview({
    request: { tenantId: "t1", userId: "u1", message: "deploy", locale: "en-US" } as NlEntryRequest,
    divisionId: "eng",
    workflowId: "wf1",
    riskPreview: {
      overallRisk: "high",
      riskFactors: [],
      reversible: true,
      sideEffects: [],
      approvalNeeded: true,
    },
    context: {
      domainHint: "eng",
      extractedConstraints: [],
      targetEnvironments: ["staging"],
      requestedChannels: [],
      timelineRefs: [],
    } as ContextEnrichment,
  });

  assert.ok(result !== undefined);
  assert.equal(result.approvalRequired, true);
});

test("buildDryRunPreview includes policy checks", () => {
  const result = buildDryRunPreview({
    request: { tenantId: "t1", userId: "u1", message: "delete", locale: "en-US" } as NlEntryRequest,
    divisionId: "eng",
    workflowId: "wf1",
    riskPreview: {
      overallRisk: "high",
      riskFactors: [],
      reversible: false,
      sideEffects: ["data loss"],
      approvalNeeded: true,
    },
    context: {
      domainHint: "eng",
      extractedConstraints: [],
      targetEnvironments: [],
      requestedChannels: [],
      timelineRefs: [],
    } as ContextEnrichment,
  });

  assert.ok(result !== undefined);
  assert.ok(result.policyChecks.includes("approval_required"));
  assert.ok(result.policyChecks.includes("irreversible_operation"));
});

test("buildDryRunPreview includes proposed payload", () => {
  const result = buildDryRunPreview({
    request: { tenantId: "t1", userId: "u1", message: "deploy", locale: "en-US" } as NlEntryRequest,
    divisionId: "engineering",
    workflowId: "deploy-wf",
    riskPreview: {
      overallRisk: "high",
      riskFactors: [],
      reversible: true,
      sideEffects: [],
      approvalNeeded: true,
    },
    context: {
      domainHint: "engineering",
      extractedConstraints: [],
      targetEnvironments: [],
      requestedChannels: [],
      timelineRefs: [],
    } as ContextEnrichment,
  });

  assert.ok(result !== undefined);
  assert.equal(result.proposedPayload.userId, "u1");
  assert.equal(result.proposedPayload.divisionId, "engineering");
  assert.equal(result.proposedPayload.workflowId, "deploy-wf");
});

test("buildDryRunPreview uses fallback environment when not specified", () => {
  const result = buildDryRunPreview({
    request: { tenantId: "t1", userId: "u1", message: "deploy", locale: "en-US" } as NlEntryRequest,
    divisionId: "eng",
    workflowId: "wf1",
    riskPreview: {
      overallRisk: "critical",
      riskFactors: [],
      reversible: false,
      sideEffects: [],
      approvalNeeded: true,
    },
    context: {
      domainHint: "eng",
      extractedConstraints: [],
      targetEnvironments: [],
      requestedChannels: [],
      timelineRefs: [],
    } as ContextEnrichment,
  });

  assert.ok(result !== undefined);
  assert.ok(result.scope.includes("unknown"));
});

test("buildRiskPreviewWithDryRun adds policy check results to risk factors", async () => {
  const mockExecutor: DryRunExecutorPort = {
    executeDryRun: async () => ({
      blocked: false,
      actualRiskLevel: "high",
      detectedSideEffects: [],
      policyCheckResults: ["security_policy_violated"],
    }),
  };

  const result = await buildRiskPreviewWithDryRun(
    "deploy to production",
    "task_create",
    mockExecutor,
    { message: "deploy to production", divisionId: "eng", workflowId: "wf1", userId: "u1", locale: "en-US" },
  );

  assert.ok(result.riskFactors.some(f => f.includes("security_policy_violated")));
});
