import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { simplifyExplanation } from "../../../src/ops-maturity/explainability/simplified-explainer/index.js";
import { compareWorkflowRuns } from "../../../src/ops-maturity/workflow-debugger/run-comparator/index.js";
import { ExecutionTracer } from "../../../src/ops-maturity/workflow-debugger/execution-tracer.js";
import { WorkflowDebuggerHealthMonitor } from "../../../src/ops-maturity/workflow-debugger/health-monitor.js";
import { TimeTravelDebugService } from "../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";
import {
  evaluateAuthorizationContext,
  resolvePrincipalAccessProfile,
} from "../../../src/platform/five-plane-control-plane/iam/access-model.js";
import { encryptField } from "../../../src/platform/five-plane-control-plane/iam/field-encryption.js";
import { PolicyEngine } from "../../../src/platform/five-plane-control-plane/iam/policy-engine.js";
import { loadQualityConfig } from "../../../src/platform/prompt-engine/eval/quality-config-loader.js";
import { normalizePromptRolloutMode } from "../../../src/platform/prompt-engine/rollout/index.js";
import { nextPromptRolloutStage } from "../../../src/platform/prompt-engine/rollout/prompt-rollout-stage.js";
import { MultiRegionDataPlaneFlowServiceAsync } from "../../../src/scale-ecosystem/multi-region/data-plane-flow.js";

test("1919..1927: ops-maturity and scale-ecosystem regressions stay closed", async () => {
  const timeTravel = new TimeTravelDebugService({ maxSessions: 1 });
  timeTravel.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-05-12T00:00:00.000Z", variables: { shared: 1, unique: "a" } },
    { stepId: "step-2", timestamp: "2026-05-12T00:00:01.000Z", variables: { shared: 2 } },
  ]);
  const firstSession = timeTravel.createSession("task-1", "exec-1");

  const dedupedVariables = timeTravel.getVariableState(firstSession.sessionId, 10);
  assert.equal(dedupedVariables.filter((entry) => entry.name === "shared").length, 1);
  assert.equal(dedupedVariables.find((entry) => entry.name === "shared")?.value, 2);

  const secondSession = timeTravel.createSession("task-2", "exec-1");
  timeTravel.replayStep(secondSession.sessionId);
  assert.deepEqual(timeTravel.getVariableState(firstSession.sessionId, 1), []);

  const diffs = compareWorkflowRuns(
    [{ nodeRunId: "node-left", status: "completed" }],
    [
      { nodeRunId: "node-left", status: "completed" },
      { nodeRunId: "node-right", status: "failed" },
    ],
  );
  assert.ok(diffs.includes("step:node-right:missing_in_left"));

  const tracer = new ExecutionTracer();
  const trace = tracer.startTrace("wf-1", "exec-1");
  tracer.recordEvent(trace.traceId, "step-1", "enter");
  assert.equal(tracer.getTrace(trace.traceId)?.totalDurationMs, null);

  const asyncFlow = new MultiRegionDataPlaneFlowServiceAsync();
  const synced = await asyncFlow.syncStateAsync({
    partitionKey: "orders",
    sourceRegionId: "cn-sha",
    checkpointSequence: 12,
    epoch: 4,
  });
  assert.equal(synced.partitionKey, "orders");
  assert.ok(typeof (await asyncFlow.getReplicationLagAsync("cn-sha", "cn-sha")) === "number");

  const simplified = simplifyExplanation(
    "execution",
    "workflow timeout latency incident",
    ["timeout risk", "cost increase"],
    [],
    "high",
  );
  assert.match(simplified.whatHappened, /process/);

  const monitor = new WorkflowDebuggerHealthMonitor({ checkIntervalMs: 12_345 });
  assert.equal(monitor.getCheckIntervalMs(), 12_345);

  const connectorFrameworkSource = readFileSync("src/scale-ecosystem/integration/connector-framework-service.ts", "utf8");
  const tenantPlatformSource = readFileSync("src/scale-ecosystem/tenant-platform/tenant-platform-service.ts", "utf8");
  const multiRegionSource = readFileSync("src/scale-ecosystem/multi-region/data-plane-flow.ts", "utf8");
  const simplifiedExplainerSource = readFileSync("src/ops-maturity/explainability/simplified-explainer/index.ts", "utf8");

  assert.match(connectorFrameworkSource, /private readonly maxBindings: number;/);
  assert.match(connectorFrameworkSource, /private evictLRUBindings/);
  assert.match(connectorFrameworkSource, /private evictLRUHealth/);
  assert.match(tenantPlatformSource, /tenant\.organizationId !== organization\.organizationId/);
  assert.match(multiRegionSource, /public async syncStateAsync/);
  assert.match(multiRegionSource, /public async resolveConflictAsync/);
  assert.match(multiRegionSource, /public async getReplicationLagAsync/);
  assert.match(simplifiedExplainerSource, /const JARGON_PATTERNS: Map<string, RegExp> = new Map/);
});

test("1941..1953: IAM, secret, plugin, and stability security guards remain enforced", () => {
  const denied = evaluateAuthorizationContext({
    principalType: "user",
    roles: ["viewer"],
    action: "exec_command",
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reasonCode, "policy.capability_not_granted");

  const adminProfile = resolvePrincipalAccessProfile({
    principalType: "user",
    roles: ["platform_admin"],
  });
  assert.ok(adminProfile.capabilities.includes("exec:command"));

  assert.throws(() => encryptField("secret", "short-key"), /security\.encryption_key_too_weak/);

  const invalidRequestEngine = new PolicyEngine({
    budgetPolicy: {
      maxTaskCostUsd: 100,
      maxDailyCostUsd: 100,
      maxMonthlyCostUsd: 1000,
      warnAtRatio: 0.8,
      mode: "deny",
    },
  });
  assert.throws(
    () => invalidRequestEngine.evaluate({
      decisionId: "dec-1",
      taskId: "task-1",
      subjectType: "user",
      subjectId: "viewer-1",
      subjectRoles: ["viewer"],
      subjectCapabilities: [],
      action: "exec_command",
      riskCategory: "cost_sensitive",
      mode: "manual_only",
    }),
    /Subject lacks required roles|Subject lacks required capabilities/,
  );

  const accessModelSource = readFileSync("src/platform/five-plane-control-plane/iam/access-model.ts", "utf8");
  const policyEngineSource = readFileSync("src/platform/five-plane-control-plane/iam/policy-engine.ts", "utf8");
  const secretManagementSource = readFileSync("src/platform/five-plane-control-plane/iam/secret-management-service.ts", "utf8");
  const externalSecretProviderSource = readFileSync("src/platform/five-plane-control-plane/iam/external-secret-provider.ts", "utf8");
  const redisLockSource = readFileSync("src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts", "utf8");
  const stableEvidenceSource = readFileSync("src/platform/stability/stable-evidence-bundle.ts", "utf8");
  const pluginRuntimeSource = readFileSync("src/domains/registry/plugin-runtime-host.ts", "utf8");
  const secretCommandsSource = readFileSync("src/sdk/cli/secret-commands.ts", "utf8");

  assert.match(accessModelSource, /const requiredCapabilities = inferCapabilitiesForAction\(input\.action\);/);
  assert.match(accessModelSource, /if \(!roleGrantsCapabilities\(input\.roles, requiredCapabilities\)\)/);
  assert.match(policyEngineSource, /validateSubjectPermissions\(input\);/);
  assert.match(policyEngineSource, /public invalidate\(reason: string\): void/);
  assert.match(policyEngineSource, /this\.decisionCache\.clear\(\);/);
  assert.match(secretManagementSource, /if \(authContext == null\)/);
  assert.match(secretManagementSource, /getSecretVersionRecord/);
  assert.match(secretManagementSource, /upsertSecretVersionRecord/);
  assert.match(secretCommandsSource, /requireAuthToken\(authConfig, action\);/);
  assert.match(externalSecretProviderSource, /function verifySecurePath/);
  assert.match(externalSecretProviderSource, /validateFilePath\(filePath, code\);/);
  assert.match(redisLockSource, /LockDataSchema\.safeParse/);
  assert.match(stableEvidenceSource, /createStableEvidenceSigner/);
  assert.match(stableEvidenceSource, /writeSignedJson/);
  assert.match(pluginRuntimeSource, /validatePluginId\(options\.pluginId\);/);
  assert.match(pluginRuntimeSource, /function sanitizePluginIdForPath/);
});

test("1954..1958: prompt config, registry immutability, rollout modes, and auto-rollback remain fixed", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "quality-config-"));
  const brokenConfigPath = join(tempDir, "broken.json");
  writeFileSync(brokenConfigPath, "{not-json");

  assert.throws(() => loadQualityConfig(brokenConfigPath));
  const defaultConfig = loadQualityConfig(join(tempDir, "missing.json"));
  assert.equal(defaultConfig.qualityGate.defaultPassThreshold, 0.8);

  assert.equal(normalizePromptRolloutMode("canary"), "canary");
  assert.equal(normalizePromptRolloutMode("staged"), "staged");
  assert.equal(normalizePromptRolloutMode("full"), "full");
  assert.equal(nextPromptRolloutStage("stable"), null);

  const qualityLoaderSource = readFileSync("src/platform/prompt-engine/eval/quality-config-loader.ts", "utf8");
  const hierarchicalRegistrySource = readFileSync("src/platform/prompt-engine/registry/hierarchical-registry-service.ts", "utf8");
  const rolloutIndexSource = readFileSync("src/platform/prompt-engine/rollout/index.ts", "utf8");
  const rolloutStageSource = readFileSync("src/platform/prompt-engine/rollout/prompt-rollout-stage.ts", "utf8");

  assert.match(qualityLoaderSource, /if \(isMissingConfigError\(err\)\)/);
  assert.ok(!qualityLoaderSource.includes("catch {}"));
  assert.match(hierarchicalRegistrySource, /const newMetadata: PromptBundleMetadata = \{/);
  assert.match(hierarchicalRegistrySource, /const newBundle: PromptBundle = \{/);
  assert.match(rolloutStageSource, /"canary_5",\s*"canary_20",\s*"stable"/);
  assert.match(rolloutIndexSource, /"canary"/);
  assert.match(rolloutIndexSource, /"staged"/);
  assert.match(rolloutIndexSource, /"full"/);
  assert.match(rolloutIndexSource, /autoRollbackConfig/);
});

test("1959..1968: prompt eval, versioning, traffic split, and tamper-evident profile guards remain fixed", () => {
  const llmEvalSource = readFileSync("src/platform/prompt-engine/eval/llm-eval-service.ts", "utf8");
  const outcomeEvaluatorSource = readFileSync("src/platform/prompt-engine/eval/execution-outcome-evaluator.ts", "utf8");
  const registrySource = readFileSync("src/platform/prompt-engine/registry/hierarchical-registry-service.ts", "utf8");
  const versionManagerSource = readFileSync("src/platform/prompt-engine/registry/prompt-version-manager.ts", "utf8");
  const judgeSource = readFileSync("src/platform/prompt-engine/eval/cross-provider-judge-service.ts", "utf8");
  const stableEvidenceSupportSource = readFileSync("src/platform/stability/stable-evidence-bundle-support.ts", "utf8");

  assert.match(llmEvalSource, /calculateWelchTTtest/);
  assert.match(llmEvalSource, /bootstrapConfidenceInterval/);
  assert.match(llmEvalSource, /try \{\s*return JSON\.parse\(suite\.cases\) as EvalCaseDefinition\[\];\s*\} catch \{/s);
  assert.match(outcomeEvaluatorSource, /successSignal: 0\.3/);
  assert.match(outcomeEvaluatorSource, /completionOutcome: 0\.4/);
  assert.match(outcomeEvaluatorSource, /failureSignal: 0\.2/);
  assert.match(outcomeEvaluatorSource, /partialSignal: 0\.1/);
  assert.match(registrySource, /if \(version !== undefined && version !== ""\)/);
  assert.match(registrySource, /const slot = totalWeight > 0 \? Math\.floor\(\(rawSlot \* totalWeight\) \/ 100\) : 0;/);
  assert.equal((versionManagerSource.match(/export interface VersionLineage/g) ?? []).length, 1);
  assert.match(judgeSource, /consensusDecision === "rollback"\s*\?\s*rollbackCount/);
  assert.match(stableEvidenceSupportSource, /"name" in overrides/);
  assert.match(stableEvidenceSupportSource, /delete \(safeOverrides as Record<string, unknown>\)\.name/);
});
