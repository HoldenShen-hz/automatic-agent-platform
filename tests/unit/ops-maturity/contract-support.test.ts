import assert from "node:assert/strict";
import test from "node:test";

import { listActiveAgents } from "../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";
import { shouldPromoteCanary } from "../../../src/ops-maturity/agent-lifecycle/canary-controller/index.js";
import { canRetireAgent } from "../../../src/ops-maturity/agent-lifecycle/retirement/index.js";
import { resolveLatestAgentVersion } from "../../../src/ops-maturity/agent-lifecycle/version-manager/index.js";
import { forecastCapacityUsage } from "../../../src/ops-maturity/capacity-planner/forecaster/index.js";
import { simulateCapacityScenario } from "../../../src/ops-maturity/capacity-planner/simulator/index.js";
import { analyzeCapacityTrend } from "../../../src/ops-maturity/capacity-planner/trend-analyzer/index.js";
import { mapEvidenceByType } from "../../../src/ops-maturity/compliance-reporter/evidence-mapper/index.js";
import { renderComplianceReportMarkdown } from "../../../src/ops-maturity/compliance-reporter/report-renderer/index.js";
import { findComplianceTemplate } from "../../../src/ops-maturity/compliance-reporter/template-registry/index.js";
import { aggregateCostAttribution } from "../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";
import { buildCostOptimizationRecommendation } from "../../../src/ops-maturity/cost-optimizer/recommendation-engine/index.js";
import { simulateCostOptimization } from "../../../src/ops-maturity/cost-optimizer/simulator/index.js";
import { buildOfflineExecutionRecord } from "../../../src/ops-maturity/edge-runtime/edge-executor/index.js";
import { buildEdgeExecutionPlan } from "../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";
import { selectEdgeLocalModel } from "../../../src/ops-maturity/edge-runtime/local-model/index.js";
import { orderEdgeSyncQueue } from "../../../src/ops-maturity/edge-runtime/sync-queue/index.js";
import { buildForensicSnapshot } from "../../../src/ops-maturity/emergency/forensic-snapshot/index.js";
import { shouldEnterPanicMode } from "../../../src/ops-maturity/emergency/panic-controller/index.js";
import { canResumeFromPanic } from "../../../src/ops-maturity/emergency/resume-protocol/index.js";
import { buildCausalChainSummary } from "../../../src/ops-maturity/explainability/causal-chain-builder/index.js";
import { collectExplanationEvidenceIds } from "../../../src/ops-maturity/explainability/evidence-collector/index.js";
import { putExplanationCacheEntry } from "../../../src/ops-maturity/explainability/explanation-cache/index.js";
import { renderStageExplanation } from "../../../src/ops-maturity/explainability/explanation-renderer/index.js";
import { countDocumentPages } from "../../../src/ops-maturity/multimodal/document-parser/index.js";
import { normalizeImageAspectRatio } from "../../../src/ops-maturity/multimodal/image-processor/index.js";
import { resolveInputModality } from "../../../src/ops-maturity/multimodal/modality-router/index.js";
import { estimateSpeechDurationMs } from "../../../src/ops-maturity/multimodal/speech-processor/index.js";
import { predictOpsCapacityRisk } from "../../../src/ops-maturity/platform-ops-agent/capacity-predictor/index.js";
import { buildConfigOptimizationSuggestion } from "../../../src/ops-maturity/platform-ops-agent/config-optimizer/index.js";
import { summarizeDeveloperAssistSuggestion } from "../../../src/ops-maturity/platform-ops-agent/dev-assistant/index.js";
import { summarizeOpsHealth } from "../../../src/ops-maturity/platform-ops-agent/health-monitor/index.js";
import { classifyOpsIncident } from "../../../src/ops-maturity/platform-ops-agent/incident-diagnoser/index.js";
import { isBreakpointHit } from "../../../src/ops-maturity/workflow-debugger/breakpoint-manager/index.js";
import { compareWorkflowRuns } from "../../../src/ops-maturity/workflow-debugger/run-comparator/index.js";
import { renderWorkflowTimeline } from "../../../src/ops-maturity/workflow-debugger/timeline-renderer/index.js";

test("ops-maturity support modules provide contract-aligned helpers", () => {
  assert.equal(
    listActiveAgents([
      {
        name: "Agent One",
        createdAt: "2026-04-19T00:00:00.000Z",
        agentId: "agent_1",
        updatedAt: "2026-04-19T00:00:00.000Z",
        owner: { path: "lead", orgNodeId: "ops" },
        domainId: "coding",
        lifecycleState: "active",
        components: {
          pack: { packId: "pack_1", version: "1.0.0" },
          promptBundle: { bundleId: "prompt_1", version: "1.0.0" },
          modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
          trustProfile: { initialLevel: "supervised", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
          triggerSet: [],
          autonomyConfig: { maxAutomationLevel: "supervised", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
        },
        currentVersionId: "v2",
      },
      {
        name: "Agent Two",
        createdAt: "2026-04-01T00:00:00.000Z",
        agentId: "agent_2",
        updatedAt: "2026-04-15T00:00:00.000Z",
        owner: { path: "lead", orgNodeId: "ops" },
        domainId: "ops",
        lifecycleState: "deprecated",
        components: {
          pack: { packId: "pack_1", version: "1.0.0" },
          promptBundle: { bundleId: "prompt_1", version: "1.0.0" },
          modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
          trustProfile: { initialLevel: "supervised", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
          triggerSet: [],
          autonomyConfig: { maxAutomationLevel: "supervised", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
        },
        currentVersionId: "v1",
      },
    ]).length,
    1,
  );
  assert.equal(shouldPromoteCanary({ rolloutPercent: 30, successRate: 0.995, latencyP50Ms: 100, errorRate: 0.005, currentStage: 20 }), true);
  assert.equal(canRetireAgent({ agentId: "agent_1", reason: "superseded", successorAgentId: "agent_2", transferItems: ["triggers"], gracePeriodDays: 30, notificationTargets: ["lead"], revokeAt: "2026-04-20T00:00:00.000Z" }, "2026-04-20T01:00:00.000Z"), true);
  assert.equal(
    resolveLatestAgentVersion([
      { versionId: "v1", agentId: "agent_1", createdAt: "2026-04-19T00:00:00.000Z", semver: "1.0.0", componentSnapshot: { packVersion: "1.0.0", promptBundleVersion: "1.0.0", modelBindingHash: "h1", trustProfileHash: "h1", triggerSetHash: "h1", autonomyConfigHash: "h1" }, createdBy: "lead", releaseNote: "" },
      { versionId: "v2", agentId: "agent_1", createdAt: "2026-04-20T00:00:00.000Z", semver: "2.0.0", componentSnapshot: { packVersion: "2.0.0", promptBundleVersion: "2.0.0", modelBindingHash: "h2", trustProfileHash: "h2", triggerSetHash: "h2", autonomyConfigHash: "h2" }, createdBy: "lead", releaseNote: "" },
    ])?.versionId,
    "v2",
  );

  assert.deepEqual(forecastCapacityUsage(100, 10, 3), [110, 121, 133.1]);
  assert.equal(simulateCapacityScenario({ baselineUnits: 100, growthPercent: 20, optimizationPercent: 10 }), 108);
  assert.deepEqual(analyzeCapacityTrend([100, 120, 140]), { average: 120, direction: "up" });

  assert.deepEqual(
    mapEvidenceByType([
      { evidenceId: "ev_1", evidenceType: "audit_log" },
      { evidenceId: "ev_2", evidenceType: "audit_log" },
    ]),
    { audit_log: ["ev_1", "ev_2"] },
  );
  assert.match(
    renderComplianceReportMarkdown("SOC2", [{ title: "Controls", lines: ["AC-1", "AC-2"] }]),
    /SOC2/,
  );
  assert.equal(
    findComplianceTemplate([{ templateId: "soc2", framework: "SOC2", reportType: "monthly" }], "soc2")?.framework,
    "SOC2",
  );

  assert.deepEqual(
    aggregateCostAttribution([
      { subjectId: "task_1", amountUsd: 1.2 },
      { subjectId: "task_1", amountUsd: 0.3 },
    ]),
    { task_1: 1.5 },
  );
  assert.equal(buildCostOptimizationRecommendation("task_1", 20)?.estimatedSavingsUsd, 3);
  assert.equal(simulateCostOptimization(100, 20), 80);

  assert.equal(buildOfflineExecutionRecord("edge_1", "task_1", "2026-04-20T00:00:00.000Z").syncRequired, true);
  const edgePlan = buildEdgeExecutionPlan(["a", "b"]);
  assert.deepEqual(edgePlan.orderedTaskIds, ["a", "b"]);
  assert.equal(edgePlan.syncRequired, true);
  assert.equal(edgePlan.priority, "normal");
  assert.deepEqual(edgePlan.planGraph.entryNodeIds, ["edge_node_a"]);
  assert.deepEqual(edgePlan.planGraph.nodes.map((node) => node.nodeId), ["edge_node_a", "edge_node_b"]);
  assert.equal(
    selectEdgeLocalModel([{ modelId: "local-vision", modalities: ["image", "text"] }], "image")?.modelId,
    "local-vision",
  );
  assert.equal(orderEdgeSyncQueue([{ envelopeId: "a", priority: 1 }, { envelopeId: "b", priority: 3 }])[0]?.envelopeId, "b");

  assert.equal(
    buildForensicSnapshot({
      snapshotId: "snap_1",
      scope: "platform",
      collectedAt: "2026-04-20T00:00:00.000Z",
      artifactIds: ["art_1"],
      configurationRefs: ["cfg_1"],
      logRefs: ["log_1"],
    }).artifactIds.length,
    1,
  );
  assert.equal(shouldEnterPanicMode({ scope: "platform", reasonCode: "security.compromise", activeIncidents: 0 }), true);
  assert.equal(
    canResumeFromPanic({
      scope: "platform",
      approvedBy: ["sre", "security"],
      approvedRoles: ["platform_admin", "security_team"],
      checkpointsVerified: true,
      forensicSnapshotReviewed: true,
      rollbackPlanReady: true,
      validationRunPassed: true,
    }),
    true,
  );

  assert.deepEqual(
    buildCausalChainSummary([{ source: "observe", target: "execute", rationale: "incident threshold exceeded" }]),
    ["observe -> execute: incident threshold exceeded"],
  );
  assert.deepEqual(collectExplanationEvidenceIds([{ evidenceId: "ev_1", category: "trace" }]), ["ev_1"]);
  assert.equal(putExplanationCacheEntry({}, { cacheKey: "task_1", summary: "ok" }).task_1?.summary, "ok");
  assert.match(renderStageExplanation("assess", "risk detected", ["ev_1"]), /assess/);

  assert.equal(countDocumentPages(["p1", "p2"]), 2);
  assert.equal(normalizeImageAspectRatio({ width: 1920, height: 1080 }), 1.7778);
  assert.equal(resolveInputModality("audio"), "audio");
  assert.equal(estimateSpeechDurationMs(48_000, 24_000), 2000);

  assert.equal(predictOpsCapacityRisk(100, 130), "medium");
  assert.equal(buildConfigOptimizationSuggestion("workers", 4, 6), "workers: 4 -> 6");
  assert.match(summarizeDeveloperAssistSuggestion("lint", ["fix import order"]), /lint/);
  assert.equal(summarizeOpsHealth([{ component: "queue", status: "degraded" }]), "degraded");
  assert.equal(classifyOpsIncident(0.1, 250), "incident");

  assert.equal(isBreakpointHit([{ breakpointId: "bp_1", stepId: "step_2" }], "step_2"), true);
  assert.deepEqual(
    compareWorkflowRuns([{ stepId: "step_1", status: "done" }], [{ stepId: "step_1", status: "failed" }]),
    ["step:step_1:done->failed"],
  );
  assert.deepEqual(
    renderWorkflowTimeline([{ timestamp: "2026-04-20T00:00:00.000Z", label: "started" }]),
    ["2026-04-20T00:00:00.000Z started"],
  );
});
