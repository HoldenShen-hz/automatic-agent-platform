import assert from "node:assert/strict";
import test from "node:test";

import {
  listActiveAgents,
  resolveLatestAgentVersion,
  shouldPromoteCanary,
  canRetireAgent,
  buildOfflineExecutionRecord,
  forecastCapacityUsage,
  analyzeCapacityTrend,
  aggregateCostAttribution,
  buildCostOptimizationRecommendation,
  buildCausalChainSummary,
  collectExplanationEvidenceIds,
  renderStageExplanation,
  shouldEnterPanicMode,
  canResumeFromPanic,
  isBreakpointHit,
  compareWorkflowRuns,
  renderWorkflowTimeline,
  summarizeOpsHealth,
  classifyOpsIncident,
} from "../../../src/ops-maturity/index.js";

test("ops-maturity support modules coordinate lifecycle, explainability, panic, debugger, and optimization flows", () => {
  const activeAgents = listActiveAgents([
    {
      agentId: "agent_platform_ops",
      domainId: "platform_ops",
      lifecycleState: "canary",
      currentVersionId: "v2",
    },
    {
      agentId: "agent_legacy",
      domainId: "platform_ops",
      lifecycleState: "retired",
      currentVersionId: "v1",
    },
  ]);
  assert.equal(activeAgents.length, 1);

  assert.equal(
    resolveLatestAgentVersion([
      { versionId: "v1", agentId: "agent_platform_ops", createdAt: "2026-04-19T00:00:00.000Z", stable: false },
      { versionId: "v2", agentId: "agent_platform_ops", createdAt: "2026-04-20T00:00:00.000Z", stable: true },
    ])?.versionId,
    "v2",
  );
  assert.equal(shouldPromoteCanary({ rolloutPercent: 30, successRate: 0.995 }), true);
  assert.equal(
    canRetireAgent({
      agentId: "agent_legacy",
      successorAgentId: "agent_platform_ops",
      revokeAt: "2026-04-20T00:00:00.000Z",
    }, "2026-04-20T01:00:00.000Z"),
    true,
  );

  const offlineRecord = buildOfflineExecutionRecord("edge_factory_1", "task_sync_1", "2026-04-20T00:00:00.000Z");
  assert.equal(offlineRecord.syncRequired, true);

  assert.deepEqual(forecastCapacityUsage(100, 10, 2), [110, 121]);
  assert.deepEqual(analyzeCapacityTrend([100, 110, 130]), { average: 113.33, direction: "up" });

  assert.deepEqual(
    aggregateCostAttribution([
      { subjectId: "workflow_1", amountUsd: 10.25 },
      { subjectId: "workflow_1", amountUsd: 2.75 },
    ]),
    { workflow_1: 13 },
  );
  assert.equal(buildCostOptimizationRecommendation("workflow_1", 20)?.estimatedSavingsUsd, 3);

  const evidenceIds = collectExplanationEvidenceIds([
    { evidenceId: "evt_1", category: "trace" },
    { evidenceId: "artifact_2", category: "artifact" },
  ]);
  assert.deepEqual(evidenceIds, ["evt_1", "artifact_2"]);
  assert.deepEqual(
    buildCausalChainSummary([
      { source: "observe", target: "assess", rationale: "backlog exceeded threshold" },
      { source: "assess", target: "panic", rationale: "security policy triggered" },
    ]),
    [
      "observe -> assess: backlog exceeded threshold",
      "assess -> panic: security policy triggered",
    ],
  );
  assert.match(
    renderStageExplanation("assess", "backlog exceeded threshold", evidenceIds),
    /assess: backlog exceeded threshold/,
  );

  assert.equal(
    shouldEnterPanicMode({
      scope: "platform",
      reasonCode: "security.compromise",
      activeIncidents: 1,
    }),
    true,
  );
  assert.equal(
    canResumeFromPanic({
      scope: "platform",
      approvedBy: "sre_lead",
      checkpointsVerified: true,
    }),
    true,
  );

  assert.equal(
    isBreakpointHit([
      { breakpointId: "bp_exec", stepId: "execute_step" },
    ], "execute_step"),
    true,
  );
  assert.deepEqual(
    compareWorkflowRuns(
      [{ stepId: "execute_step", status: "done" }],
      [{ stepId: "execute_step", status: "failed" }],
    ),
    ["step:execute_step:done->failed"],
  );
  assert.deepEqual(
    renderWorkflowTimeline([
      { timestamp: "2026-04-20T00:00:00.000Z", label: "started" },
      { timestamp: "2026-04-20T00:01:00.000Z", label: "paused" },
    ]),
    [
      "2026-04-20T00:00:00.000Z started",
      "2026-04-20T00:01:00.000Z paused",
    ],
  );

  assert.equal(
    summarizeOpsHealth([
      { component: "dispatcher", status: "healthy" },
      { component: "queue", status: "degraded" },
    ]),
    "degraded",
  );
  assert.equal(classifyOpsIncident(0.1, 250), "incident");
});
