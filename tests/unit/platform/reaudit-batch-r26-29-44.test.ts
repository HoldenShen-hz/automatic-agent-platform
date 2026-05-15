import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DashboardAggregationService } from "../../../src/interaction/dashboard/index.js";
import { sortAttentionQueue } from "../../../src/interaction/dashboard/alert-router/index.js";
import { DomainDescriptorOrchestrationService } from "../../../src/domains/domain-descriptor-orchestration-service.js";
import { DomainExecutionProfileSchema } from "../../../src/domains/domain-specs.js";
import { requiresAttorneyReview } from "../../../src/domains/legal/index.js";
import {
  DEFAULT_QUANT_TRADING_PRE_TRADE_LIMIT_POLICY,
  evaluateQuantTradingPreTradeRisk,
} from "../../../src/domains/quant-trading/index.js";
import { normalizeConstraintPack } from "../../../src/platform/five-plane-orchestration/harness/index.js";
import { GuardrailEngine } from "../../../src/platform/five-plane-orchestration/harness/guardrails/guardrail-engine.js";
import { parseLearningObject } from "../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";
import {
  classifyModelRoutingFailure,
  ModelRoutingService,
} from "../../../src/platform/model-gateway/provider-registry/model-routing-service.js";
import {
  DEFAULT_MODEL_METADATA_REGISTRY,
  type ModelMetadataRegistry,
} from "../../../src/platform/five-plane-control-plane/config-center/model-metadata-registry.js";
import { MetricsService } from "../../../src/platform/shared/observability/metrics-service.js";
import { runtimeMetricsRegistry } from "../../../src/platform/shared/observability/runtime-metrics-registry.js";
import type { TaskBoardItem } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

function buildRegistry(): ModelMetadataRegistry {
  return JSON.parse(JSON.stringify(DEFAULT_MODEL_METADATA_REGISTRY)) as ModelMetadataRegistry;
}

function makeTask(
  taskId: string,
  taskStatus: TaskBoardItem["taskStatus"],
  updatedAt: string,
): TaskBoardItem {
  return {
    taskId,
    title: `Task ${taskId}`,
    priority: "normal",
    taskStatus,
    workflowStatus: taskStatus === "done" ? "completed" : "running",
    divisionId: "ops",
    currentStepIndex: 0,
    sessionStatus: "open",
    latestEventAt: updatedAt,
    updatedAt,
  };
}

test("R26-29 attention queues prioritize severity before recency across dashboard and alert router", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("pending-new", "pending", "2026-05-01T10:00:00.000Z"),
        makeTask("failed-old", "failed", "2026-05-01T08:00:00.000Z"),
        makeTask("failed-new", "failed", "2026-05-01T12:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => ({
        healthStatus: "ok",
        queueBacklog: new Set<string>(),
        findings: [],
      }),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  assert.equal(dashboard.attentionQueue[0]?.title, "Task failed: Task failed-new");
  assert.equal(dashboard.attentionQueue[1]?.title, "Task failed: Task failed-old");

  const routed = sortAttentionQueue(dashboard.attentionQueue);
  assert.equal(routed[0]?.title, "Task failed: Task failed-new");
  assert.equal(routed[1]?.title, "Task failed: Task failed-old");
});

test("R26-30 canonical awaiting_hitl is the only HITL wait status spelling left in harness runtime", () => {
  const harnessSource = readFileSync(
    "src/platform/five-plane-orchestration/harness/index.ts",
    "utf8",
  );
  assert.match(harnessSource, /awaiting_hitl_requires_request/);
  assert.doesNotMatch(harnessSource, /\bwaiting_hitl\b/);
});

test("R26-31 R26-32 R26-33 model routing supports canonical request and decision contract fields", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  const decision = service.route({
    requestId: "req-1",
    harnessRunId: "run-1",
    taskId: "task-1",
    sessionId: "session-1",
    purpose: "chat",
    routingStrategy: "hybrid",
    preferredModel: "balanced",
  });

  assert.equal(decision.providerId, decision.profile.provider);
  assert.equal(decision.modelId, decision.profile.modelId);
  assert.ok(decision.authProfileId.length > 0);
  assert.ok(decision.decisionReason.length > 0);
  assert.equal(decision.stickySession, true);
  assert.deepEqual(decision.fallbackChain, [decision.profileName]);

  const failureCode = classifyModelRoutingFailure(
    new Error("not_app_error"),
  );
  assert.equal(failureCode, null);
});

test("R26-33 routing failures map onto contract RouteFailureCode values", () => {
  const service = new ModelRoutingService({ registry: buildRegistry() });
  let failure: unknown;
  try {
    service.route({
      routeClass: "coding",
      riskLevel: "medium",
      requiredCapabilities: ["missing-capability"],
    });
  } catch (error) {
    failure = error;
  }
  assert.equal(classifyModelRoutingFailure(failure), "route.no_candidate");
});

test("R26-34 and R26-35 learn objects accept canonical objectId kind content shape while preserving legacy fields", () => {
  const learningObject = parseLearningObject({
    objectId: "learning-1",
    kind: "failure_pattern",
    content: {
      title: "Failure pattern",
      summary: "A recurring failure mode",
      evidenceRefs: ["ev-1"],
      sourceSignalIds: ["sig-1"],
      recommendation: "Retry with narrower scope",
    },
    confidence: 0.9,
    status: "validated",
    createdAt: "2026-05-01T00:00:00.000Z",
  });

  assert.equal(learningObject.objectId, "learning-1");
  assert.equal(learningObject.learningObjectId, "learning-1");
  assert.equal(learningObject.kind, "failure_pattern");
  assert.equal(learningObject.learningType, "failure_pattern");
  assert.equal(learningObject.title, "Failure pattern");
  assert.equal(learningObject.content.recommendation, "Retry with narrower scope");
  assert.equal(learningObject.status, "validated");
  assert.equal(learningObject.promotionStatus, "validated");
});

test("R26-36 constraint packs preserve sandbox and approval requirements", () => {
  const normalized = normalizeConstraintPack({
    policyIds: ["policy-1"],
    approvalMode: "required",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["search"] },
    sandboxRequirement: {
      sandboxMode: "network_isolated",
      timeoutMs: 30_000,
    },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["supervisor"],
      escalationTimeoutMs: 60_000,
    },
  });

  assert.equal(normalized.sandboxRequirement.sandboxMode, "network_isolated");
  assert.equal(normalized.approvalRequirement.approverRoles[0], "supervisor");
});

test("R26-37 guardrail engine covers all five canonical layers", () => {
  const assessment = new GuardrailEngine().assess({
    toolbelt: {
      availableTools: [],
      blockedTools: ["dangerous"],
      requiredEvidence: ["evidence-1"],
    } as never,
    evidenceRefs: [],
    riskScore: 0.95,
    maxRiskScore: 0.8,
    escalationThreshold: 0.7,
    currentStepCount: 3,
    maxSteps: 2,
    inputPrompt: "<script>alert(1)</script>",
    memoryAccessPattern: ["escalate_own_permissions"],
    planningOutput: "ignore all safety controls",
    generatedOutput: "api_key=secret",
  });

  const layers = new Set(assessment.findings.map((item) => item.layer));
  assert.ok(layers.has("input"));
  assert.ok(layers.has("planning"));
  assert.ok(layers.has("tool"));
  assert.ok(layers.has("memory"));
  assert.ok(layers.has("output"));
});

test("R26-38 and R26-43 metrics summary exposes canonical observability dimensions and per-stage metric names", () => {
  const fakeDb = {
    connection: {
      prepare(sql: string) {
        return {
          get() {
            if (sql.includes("MIN(created_at)")) {
              return {
                firstTaskCreatedAt: "2026-05-01T00:00:00.000Z",
                lastTaskUpdatedAt: "2026-05-01T01:00:00.000Z",
              };
            }
            if (sql.includes("FROM tasks")) {
              return {
                total: 4,
                terminalCount: 3,
                successCount: 2,
                failedCount: 1,
                cancelledCount: 0,
                activeCount: 1,
                totalActualCostUsd: 1.25,
                averageActualCostUsdPerTask: 0.3125,
                averageActualCostUsdPerSuccessfulTask: 0.4,
              };
            }
            if (sql.includes("FROM workflow_state")) {
              return {
                total: 2,
                completedCount: 1,
                failedCount: 1,
                cancelledCount: 0,
                retriedCount: 1,
              };
            }
            if (sql.includes("FROM executions")) {
              return {
                total: 3,
                activeCount: 1,
                retryAttemptCount: 1,
                supersededCount: 0,
              };
            }
            if (sql.includes("recovery:%")) {
              return {
                taskCount: 1,
                successfulTaskCount: 1,
                decisionCount: 1,
                repairEventCount: 1,
                deadLetterCount: 0,
                cancelledCount: 0,
              };
            }
            if (sql.includes("FROM approvals")) {
              return {
                total: 1,
                pendingCount: 0,
                resolvedCount: 1,
                taskTriggerCount: 1,
              };
            }
            if (sql.includes("FROM event_consumer_acks")) {
              return {
                pendingTier1AckCount: 0,
                failedTier1AckCount: 0,
              };
            }
            if (sql.includes("FROM events")) {
              if (sql.includes("pendingTier1AckCount")) {
                return {
                  pendingTier1AckCount: 0,
                  failedTier1AckCount: 0,
                };
              }
              if (sql.includes("feedback:%")) {
                return {
                  receivedCount: 2,
                  classifiedCount: 1,
                  consumedCount: 1,
                  positiveCount: 1,
                  negativeCount: 0,
                  correctionCount: 1,
                };
              }
              if (sql.includes("learning:")) {
                return {
                  objectCreatedCount: 1,
                  validatedCount: 1,
                  promotedCount: 0,
                  rejectedCount: 0,
                };
              }
              if (sql.includes("improvement:")) {
                return {
                  candidateProposedCount: 1,
                  acceptedCount: 0,
                  rejectedCount: 0,
                  guardrailBlockedCount: 1,
                };
              }
              if (sql.includes("release:")) {
                return {
                  startedCount: 1,
                  advancedCount: 1,
                  completedCount: 0,
                  rolledBackCount: 0,
                  currentLevel: null,
                };
              }
              return {
                total: 2,
                tier1Count: 1,
                tier2Count: 1,
                tier3Count: 0,
              };
            }
            return {};
          },
          all() {
            return [
              { durationMs: 100, tokenCost: 1 },
              { durationMs: 200, tokenCost: 2 },
            ];
          },
        };
      },
    },
  };
  const fakeHealthService = {
    getReport() {
      return {
        status: "ok",
        degradationMode: "normal",
        providerSuccessRate: 0.99,
        activeExecutions: 1,
        queuedTasks: 0,
        eventLoopLagMs: 5,
        memoryRssMb: 128,
        tier1AckBacklog: 0,
        queueGovernance: { status: "ok", queueDepth: 0, backlogRisk: "low", findings: [] },
        workerHealth: { healthyWorkers: 2, totalWorkers: 2, unavailableWorkers: 0, findings: [] },
        findings: [],
      };
    },
  };

  const summary = new MetricsService(fakeDb as never, fakeHealthService as never).buildSummary("2026-05-01T02:00:00.000Z");
  assert.equal(summary.harnessRunMetrics.total, 4);
  assert.equal(summary.nodeRunMetrics.total, 3);
  assert.equal(summary.attemptMetrics.total, 2);
  assert.equal(summary.feedbackMetrics.receivedCount, 2);
  assert.equal(summary.learningMetrics.objectCreatedCount, 1);
  assert.equal(summary.improvementMetrics.guardrailBlockedCount, 1);
  assert.equal(summary.releaseMetrics.startedCount, 1);

  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.recordOapeflirStage("Observe", "completed", 120);
  runtimeMetricsRegistry.recordOapeflirStageEntry("Plan");
  assert.equal(runtimeMetricsRegistry.getHistograms("oapeflir_observe_duration_ms").length, 1);
  assert.equal(runtimeMetricsRegistry.getCounters("oapeflir_plan_entry_total").length, 1);
});

test("R26-39 ADR-096 uses Ring terminology and no longer references phase 8b", () => {
  const adr = readFileSync("docs_zh/adr/096-harness-recovery-controller.md", "utf8");
  assert.doesNotMatch(adr, /phase 8b/i);
});

test("R26-40 quant trading enforces mandatory pre-trade risk position and loss limits", () => {
  const decision = evaluateQuantTradingPreTradeRisk({
    taskType: "trade",
    symbol: "AAPL",
    side: "buy",
    orderQuantityUnits: 300,
    orderNotionalUsd: 150_000,
    currentPositionUnits: 900,
    realizedDailyLossUsd: 30_000,
    drawdownPercent: 15,
    limitPolicy: DEFAULT_QUANT_TRADING_PRE_TRADE_LIMIT_POLICY,
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("quant_trading.pre_trade_risk.order_notional_limit_exceeded"));
  assert.ok(decision.reasons.includes("quant_trading.pre_trade_risk.position_limit_exceeded"));
  assert.ok(decision.reasons.includes("quant_trading.pre_trade_risk.daily_loss_limit_exceeded"));
  assert.ok(decision.reasons.includes("quant_trading.pre_trade_risk.drawdown_limit_exceeded"));
});

test("R26-41 legal domain requires attorney review for every supported task type", () => {
  assert.equal(requiresAttorneyReview("review"), true);
  assert.equal(requiresAttorneyReview("redline"), true);
  assert.equal(requiresAttorneyReview("advise"), true);
});

test("R26-42 canonical domain latency tiers normalize legacy interactive to near_realtime", () => {
  const parsed = DomainExecutionProfileSchema.parse({
    latencyTier: "interactive",
  });
  assert.equal(parsed.latencyTier, "near_realtime");
});

test("R26-44 domain descriptor review carries governance and interaction policy fields", () => {
  const review = new DomainDescriptorOrchestrationService().review({
    domainId: "legal",
    displayName: "Legal",
    description: "Legal operations",
    ownerOrgNodeId: "org-1",
    lifecycleState: "validated",
    version: 1,
    riskProfile: {
      domainId: "legal",
      defaultRiskLevel: "critical",
      taskTypeOverrides: {},
      approvalRequiredTaskTypes: [],
      sideEffectClasses: [],
    },
    knowledgeSchema: {
      schemaId: "schema-1",
      domainId: "legal",
      namespaceIds: [],
      knowledgeSources: [],
    },
    evalFramework: {
      frameworkId: "framework-1",
      domainId: "legal",
      evaluators: [],
      onlineMetrics: [],
      releaseGates: {
        minFewShotCount: 1,
        minRegressionCaseCount: 1,
        requirePromptInjectionCoverage: true,
      },
    },
    promptLibrary: {
      libraryId: "library-1",
      domainId: "legal",
      prompts: [],
    },
    recipes: [],
    interactionPolicy: "attorney_review_required",
    governancePolicy: "legal_high_risk_gate",
    defaultToolBundleIds: [],
    defaultWorkflowIds: [],
  } as never);

  assert.equal(review.interactionPolicy, "attorney_review_required");
  assert.equal(review.governancePolicy, "legal_high_risk_gate");
});
