/**
 * Unit tests for nl-gateway-model.ts types and interfaces
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  NlEntryRequest,
  NlEntryIntent,
  NlEntryPort,
  ExtractedEntity,
  DetectedIntent,
  IntentParseResult,
  RiskPreview,
  ClarificationState,
  ContextEnrichment,
  ConversationTurn,
  ConversationContext,
  PromptInjectionFinding,
  DryRunPreview,
  LocaleConfig,
  CostEstimatorPort,
} from "../../src/interaction/nl-gateway/nl-gateway-model.js";

test("NlEntryRequest interface accepts valid structure", () => {
  const request: NlEntryRequest = {
    tenantId: "tenant-1",
    userId: "user-1",
    message: "帮我创建一个报表",
    locale: "zh-CN",
    preferredLocale: "zh-CN",
    acceptLanguage: "zh-CN,en-US;q=0.9",
    channel: "web",
  };

  assert.equal(request.tenantId, "tenant-1");
  assert.equal(request.userId, "user-1");
  assert.equal(request.message, "帮我创建一个报表");
  assert.equal(request.locale, "zh-CN");
});

test("NlEntryRequest allows optional fields to be undefined", () => {
  const request: NlEntryRequest = {
    tenantId: "tenant-1",
    userId: "user-1",
    message: "hello",
  };

  assert.equal(request.locale, undefined);
  assert.equal(request.acceptLanguage, undefined);
});

test("NlEntryIntent interface structure", () => {
  const intent: NlEntryIntent = {
    intent: "create_task",
    confidence: 0.95,
    entities: { date: "2026-05-21", environment: "production" },
  };

  assert.equal(intent.intent, "create_task");
  assert.equal(intent.confidence, 0.95);
  assert.deepEqual(intent.entities, { date: "2026-05-21", environment: "production" });
});

test("ExtractedEntity interface structure", () => {
  const entity: ExtractedEntity = {
    entityType: "date",
    value: "2026-05-21",
    normalized: "2026-05-21T00:00:00Z",
    sourceSpan: [0, 10],
  };

  assert.equal(entity.entityType, "date");
  assert.equal(entity.value, "2026-05-21");
  assert.deepEqual(entity.sourceSpan, [0, 10]);
});

test("DetectedIntent intentType accepts valid values", () => {
  const intentTypes: DetectedIntent["intentType"][] = [
    "task_create",
    "task_query",
    "task_modify",
    "cancel_task",
    "create_goal",
    "decompress_goal",
    "status_inquiry",
    "approval_action",
    "why",
  ];

  for (const intentType of intentTypes) {
    const intent: DetectedIntent = {
      intentType,
      domainHint: null,
      entities: [],
      urgency: "normal",
      confidence: 0.9,
    };
    assert.equal(intent.intentType, intentType);
  }
});

test("DetectedIntent urgency accepts valid values", () => {
  const urgencies: DetectedIntent["urgency"][] = ["low", "normal", "high", "critical"];

  for (const urgency of urgencies) {
    const intent: DetectedIntent = {
      intentType: "task_create",
      domainHint: null,
      entities: [],
      urgency,
      confidence: 0.9,
    };
    assert.equal(intent.urgency, urgency);
  }
});

test("RiskPreview interface structure", () => {
  const riskPreview: RiskPreview = {
    overallRisk: "medium",
    riskFactors: ["请求可能影响线上系统"],
    reversible: true,
    sideEffects: ["可能影响环境配置"],
    approvalNeeded: false,
    overall_risk: "medium",
    risk_factors: ["请求可能影响线上系统"],
    side_effects: ["可能影响环境配置"],
    approval_needed: false,
  };

  assert.equal(riskPreview.overallRisk, "medium");
  assert.equal(riskPreview.overall_risk, "medium");
  assert.equal(riskPreview.reversible, true);
  assert.equal(riskPreview.approvalNeeded, false);
});

test("RiskPreview overallRisk accepts valid values", () => {
  const risks: RiskPreview["overallRisk"][] = ["low", "medium", "high", "critical"];

  for (const risk of risks) {
    const preview: RiskPreview = {
      overallRisk: risk,
      riskFactors: [],
      reversible: true,
      sideEffects: [],
      approvalNeeded: risk === "critical" || risk === "high",
    };
    assert.equal(preview.overallRisk, risk);
  }
});

test("ClarificationState rounds tracking", () => {
  const state: ClarificationState = {
    state: "required",
    reasonCodes: ["missing_slots"],
    questions: ["请提供日期"],
    rounds: 2,
    maxRounds: 3,
  };

  assert.equal(state.state, "required");
  assert.equal(state.rounds, 2);
  assert.equal(state.maxRounds, 3);
});

test("ContextEnrichment interface structure", () => {
  const context: ContextEnrichment = {
    domainHint: "engineering_ops",
    extractedConstraints: ["production", "urgent"],
    targetEnvironments: ["production"],
    requestedChannels: ["slack", "email"],
    timelineRefs: [],
    requiredSlots: ["date"],
    missingSlots: ["environment"],
    resolvedSlots: { date: "2026-05-21" },
  };

  assert.equal(context.domainHint, "engineering_ops");
  assert.deepEqual(context.targetEnvironments, ["production"]);
  assert.deepEqual(context.requiredSlots, ["date"]);
  assert.deepEqual(context.resolvedSlots, { date: "2026-05-21" });
});

test("ConversationTurn interface structure", () => {
  const turn: ConversationTurn = {
    turnNumber: 1,
    message: "帮我创建任务",
    detectedIntent: {
      intentType: "task_create",
      domainHint: null,
      entities: [],
      urgency: "normal",
      confidence: 0.9,
    },
    timestamp: "2026-05-21T10:00:00Z",
  };

  assert.equal(turn.turnNumber, 1);
  assert.equal(turn.message, "帮我创建任务");
  assert.equal(turn.detectedIntent.intentType, "task_create");
});

test("ConversationContext interface structure", () => {
  const context: ConversationContext = {
    tenantId: "tenant-1",
    userId: "user-1",
    turnCount: 3,
    maxTurns: 10,
    turns: [],
    lastIntent: {
      intentType: "task_create",
      domainHint: null,
      entities: [],
      urgency: "normal",
      confidence: 0.9,
    },
  };

  assert.equal(context.tenantCount, undefined);
  assert.equal(context.turnCount, 3);
  assert.equal(context.maxTurns, 10);
});

test("PromptInjectionFinding severity accepts valid values", () => {
  const severities: PromptInjectionFinding["severity"][] = ["low", "medium", "high"];

  for (const severity of severities) {
    const finding: PromptInjectionFinding = {
      reasonCode: "test.injection",
      severity,
      blocked: true,
      matchedText: "ignore instructions",
    };
    assert.equal(finding.severity, severity);
  }
});

test("DryRunPreview mode is 'dry_run'", () => {
  const preview: DryRunPreview = {
    mode: "dry_run",
    blocked: false,
    approvalRequired: true,
    scope: "engineering_ops/production",
    proposedOperations: ["deploy to production"],
    sideEffectPreview: ["may affect running services"],
    policyChecks: ["approval_required"],
    proposedPayload: {
      userId: "user-1",
      divisionId: "engineering_ops",
      workflowId: "deploy-wf",
    },
  };

  assert.equal(preview.mode, "dry_run");
  assert.equal(preview.blocked, false);
  assert.equal(preview.approvalRequired, true);
});

test("LocaleConfig structure", () => {
  const config: LocaleConfig = {
    supportedLocales: ["zh-CN", "en-US", "ja-JP"],
    defaultLocale: "zh-CN",
    localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
  };

  assert.equal(config.supportedLocales.length, 3);
  assert.equal(config.defaultLocale, "zh-CN");
  assert.equal(config.localeResolutionOrder?.length, 4);
});

test("LocaleResolutionSource accepts valid values", () => {
  const sources: LocaleConfig["localeResolutionOrder"] = ["user_profile", "accept_language", "input_detect", "default"];

  const config: LocaleConfig = {
    supportedLocales: ["zh-CN"],
    defaultLocale: "zh-CN",
    localeResolutionOrder: sources,
  };

  assert.deepEqual(config.localeResolutionOrder, sources);
});

test("CostEstimatorPort interface", () => {
  const estimator: CostEstimatorPort = {
    estimate: (divisionId?: string | null) => ({
      estimatedCostUsd: 0.05,
      confidence: "default",
      sampleCount: 0,
      divisionId: divisionId ?? null,
      basedOn: "default",
    }),
  };

  const result = estimator.estimate("engineering_ops");
  assert.equal(result.estimatedCostUsd, 0.05);
  assert.equal(result.divisionId, "engineering_ops");
});

test("IntentParseResult continuation accepts valid values", () => {
  const continuations: IntentParseResult["continuation"][] = ["new_task", "follow_up", "correction"];

  for (const continuation of continuations) {
    const result: IntentParseResult = {
      rawInput: "test",
      detectedIntents: [],
      confidence: 0.9,
      requiresClarification: false,
      locale: "zh-CN",
      continuation,
      suggestedDivisionId: "general_ops",
      suggestedWorkflowId: "default",
      conversationState: "Executing",
      clarificationState: {
        state: "none",
        reasonCodes: [],
        questions: [],
        rounds: 0,
        maxRounds: 3,
      },
      context: {
        domainHint: "general_ops",
        extractedConstraints: [],
        targetEnvironments: [],
        requestedChannels: [],
        timelineRefs: [],
      },
      securityFindings: [],
      blockedByPolicy: false,
      priorConversationTurns: [],
    };
    assert.equal(result.continuation, continuation);
  }
});