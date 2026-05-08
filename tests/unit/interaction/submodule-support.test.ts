import assert from "node:assert/strict";
import test from "node:test";

import { compareAutonomyLevels } from "../../../src/interaction/autonomy/level-manager/index.js";
import { assessPromotion } from "../../../src/interaction/autonomy/promotion-engine/index.js";
import { calculateTrustScore, mapTrustLevel } from "../../../src/interaction/autonomy/trust-scorer/index.js";
import { sortAttentionQueue } from "../../../src/interaction/dashboard/alert-router/index.js";
import { scoreSystemHealth } from "../../../src/interaction/dashboard/health-scorer/index.js";
import { summarizeTaskMetrics } from "../../../src/interaction/dashboard/metric-aggregator/index.js";
import { topologicallySortTaskIds } from "../../../src/interaction/goal-decomposer/dependency-graph/index.js";
import { buildExecutionBatches } from "../../../src/interaction/goal-decomposer/planner/index.js";
import { validateGoalDecomposition } from "../../../src/interaction/goal-decomposer/validator/index.js";
import { detectAmbiguity } from "../../../src/interaction/nl-gateway/ambiguity-handler/index.js";
import { parseIntentTokens } from "../../../src/interaction/nl-gateway/intent-parser/index.js";
import { resolveRequiredSlots } from "../../../src/interaction/nl-gateway/slot-resolver/index.js";
import { shouldConsumeProactiveEvent } from "../../../src/interaction/proactive-agent/event-watcher/index.js";
import { shouldRunScheduleTrigger } from "../../../src/interaction/proactive-agent/schedule-manager/index.js";
import { resolveTriggerActionMode } from "../../../src/interaction/proactive-agent/trigger-engine/index.js";
import { applyInteractionTemplate } from "../../../src/interaction/ux/template-engine/index.js";
import { canAdvanceWizard } from "../../../src/interaction/ux/wizard/index.js";

test("interaction support modules provide deterministic helper behavior", () => {
  assert.ok(compareAutonomyLevels("suggestion", "semi_auto") < 0);
  assert.equal(
    assessPromotion({
      capabilityId: "deploy",
      currentAutonomy: "supervised",
      trustScore: 90,
      totalExecutions: 240,
      successfulExecutions: 238,
      failedExecutions: 1,
      humanOverrides: 1,
      incidents: 0,
      lastIncidentAgeDays: 50,
    }).targetLevel,
    "semi_auto",
  );
  assert.equal(mapTrustLevel(calculateTrustScore({
    capabilityId: "deploy",
    currentAutonomy: "semi_auto",
    trustScore: 0,
    totalExecutions: 100,
    successfulExecutions: 99,
    failedExecutions: 1,
    humanOverrides: 1,
    incidents: 0,
    lastIncidentAgeDays: 30,
  })), "fully_trusted");

  const sorted = sortAttentionQueue([
    { itemType: "incident", priority: "normal", title: "n", description: "", actionOptions: [], createdAt: "2026-04-20T00:00:01.000Z", domainId: "d1" },
    { itemType: "incident", priority: "critical", title: "c", description: "", actionOptions: [], createdAt: "2026-04-20T00:00:02.000Z", domainId: "d1" },
  ]);
  assert.equal(sorted[0]?.title, "c");

  assert.equal(scoreSystemHealth({
    healthStatus: "degraded",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 1 },
    resourceUtilization: { memoryRssMb: 100, activeProcesses: 2 },
    queueBacklog: { size: 3, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: ["warn"],
    observedAt: 1,
  }), 72);

  assert.deepEqual(summarizeTaskMetrics(["done", "failed", "in_progress"]), {
    total: 3,
    queued: 0,
    pending: 0,
    inProgress: 1,
    awaitingDecision: 0,
    done: 1,
    failed: 1,
    cancelled: 0,
  });

  assert.deepEqual(
    topologicallySortTaskIds(["a", "b", "c"], [{ fromTask: "a", toTask: "b" }, { fromTask: "b", toTask: "c" }]),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    buildExecutionBatches(["a", "b", "c"], [{ fromTask: "a", toTask: "c" }]),
    [["a", "b"], ["c"]],
  );

  assert.deepEqual(validateGoalDecomposition({
    goalId: "goal_1",
    tasks: [
      { taskId: "a", domainId: "coding", description: "", inputs: {}, expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCost: { estimatedCostUsd: 0.1, confidence: "default", sampleCount: 0, divisionId: null, basedOn: "default" } },
    ],
    dependencyGraph: [],
    estimatedDuration: "1h",
    estimatedCost: { estimatedCostUsd: 0.1, confidence: "default", sampleCount: 0, divisionId: null, basedOn: "default" },
    riskSummary: { overallRisk: "low", riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
    decompositionConfidence: 0.9,
    requiresHumanReview: false,
  } as any), []);

  assert.equal(detectAmbiguity("处理一下", 0.9, 1, 0), true);
  assert.equal(parseIntentTokens("请审批这个变更")[0]?.intentType, "approval_action");
  assert.deepEqual(
    resolveRequiredSlots([{ entityType: "date", value: "2026-04-20", normalized: "2026-04-20", sourceSpan: [0, 10] }], ["date", "money"]).missing,
    ["money"],
  );

  assert.equal(shouldConsumeProactiveEvent({ source: "ops", name: "incident.opened" }, "ops", "incident"), true);
  assert.equal(shouldRunScheduleTrigger("2026-04-20T00:00:00.000Z", "2026-04-20T00:06:00.000Z", "5m"), true);
  assert.equal(resolveTriggerActionMode(true, "low"), "suggest");

  assert.equal(applyInteractionTemplate({ templateId: "tmpl", title: "Template", steps: ["a"] }).title, "Template");
  assert.equal(
    canAdvanceWizard({ sessionId: "wiz_1", currentStepId: "step_1", steps: [{ stepId: "step_1", title: "Step 1", completed: true }] }),
    true,
  );
});
