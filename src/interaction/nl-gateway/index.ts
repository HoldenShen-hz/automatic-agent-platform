export {
  detectAmbiguity,
  detectAmbiguity as detectAmbiguityFn,
  DisambiguationHandler,
} from "./disambiguation-handler/index.js";

export type {
  ClarificationQuestion,
  DisambiguationConfig as HandlerDisambiguationConfig,
  DisambiguationResult,
} from "./disambiguation-handler/index.js";
export { parseIntentTokensWithModel } from "./intent-parser/index.js";
export { buildSlotClarificationState } from "./slot-resolver/index.js";

export {
  loadNlGatewayConfig,
  getConversationWindowSize,
  shouldRequestClarification,
} from "./nl-gateway-config-loader.js";

export type {
  NlGatewayConfig,
  ConversationWindowConfig,
  DisambiguationConfig,
  IntentConfig,
  EntityExtractionConfig,
} from "./nl-gateway-config-loader.js";

import { IntakeRouter } from "../../platform/five-plane-orchestration/routing/intake-router.js";
import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import { createPlatformPrincipal } from "../../platform/contracts/index.js";
import {
  createConfirmedTaskSpec,
  createPrincipalRef,
  createRequestEnvelopeFromConfirmedTask,
  createTaskDraft as createCanonicalTaskDraft,
} from "../../platform/contracts/executable-contracts/index.js";
import { loadNlGatewayConfig, getConversationWindowSize, type NlGatewayConfig } from "./nl-gateway-config-loader.js";
import {
  parseIntentTokensWithModel,
  type IntentType as ParsedIntentType,
  type ModelIntentParserPort,
} from "./intent-parser/index.js";
import { buildSlotClarificationState } from "./slot-resolver/index.js";
import { createRequestEnvelope } from "../../platform/contracts/types/index.js";
import { nowIso } from "../../platform/contracts/types/ids.js";

export type {
  ClarificationSession,
  ClarificationState,
  ContextEnrichment,
  ConversationContext,
  ConversationContextManagerOptions,
  ConversationState,
  ConversationTurn,
  CostEstimatorPort,
  DetectedIntent,
  DryRunExecutorPort,
  DryRunPreview,
  ExtractedEntity,
  IntentParseResult,
  IntentParserLlmResult,
  IntentParserPort,
  LocaleConfig,
  LocaleResolutionSource,
  MemoryServicePort,
  NlEntryIntent,
  NlEntryPort,
  NlEntryRequest,
  NlEntryServiceOptions,
  NlRequestPayload,
  PromptInjectionFinding,
  RequestEnvelope,
  RiskPreview,
  TaskBuildResult,
  TaskDraft,
  UserConfirmationReceipt,
} from "./nl-gateway-model.js";

import type {
  ClarificationSession,
  ClarificationState,
  ContextEnrichment,
  ConversationContext,
  ConversationContextManagerOptions,
  ConversationTurn,
  CostEstimatorPort,
  DetectedIntent,
  DryRunExecutorPort,
  DryRunPreview,
  ExtractedEntity,
  IntentParseResult,
  IntentParserLlmResult,
  IntentParserPort,
  LocaleConfig,
  MemoryServicePort,
  NlEntryIntent,
  NlEntryPort,
  NlEntryRequest,
  NlEntryServiceOptions,
  NlRequestPayload,
  PromptInjectionFinding,
  RequestEnvelope,
  RiskPreview,
  TaskBuildResult,
  TaskDraft,
  UserConfirmationReceipt,
} from "./nl-gateway-model.js";

import {
  buildCanonicalDomainId,
  buildClarificationQuestions,
  buildConfirmationScope,
  buildConversationMemoryScope,
  buildDryRunPreview,
  buildGenericAmbiguousPatterns,
  buildMissingSlotQuestions,
  buildPromptInjectionPatterns,
  buildRiskPreview,
  buildRiskPreviewWithDryRun,
  buildStableIdempotencyKey,
  collectResolvedSlotsFromTurns,
  CRITICAL_RISK_KEYWORDS,
  DEFAULT_LOCALE_CONFIG,
  DEFAULT_MAX_ACTIVE_CONVERSATION_CONTEXTS,
  DEFAULT_MAX_CLARIFICATION_ROUNDS,
  defaultCostEstimate,
  deriveConversationState,
  deriveTitle,
  deriveUrgency,
  detectInputLocale,
  detectPromptInjection,
  estimateSlotConfidence,
  extractEntities,
  HIGH_RISK_KEYWORDS,
  inferRequiredSlots,
  INTENT_CONFIDENCE_THRESHOLD,
  IRREVERSIBLE_KEYWORDS,
  isMediumRiskIntent,
  mapIntentType,
  memoryScopeFor,
  parseAcceptLanguage,
  clarificationRoundKey,
  parseStoredConversationTurn,
  requiresApprovalIntent,
  resolveAutonomyMode,
  resolveRuntimeMode,
  serializeEntities,
  SLOT_CONFIDENCE_THRESHOLD,
  toJsonValue,
} from "./nl-gateway-support.js";

function toParsedIntentType(intentType: IntentParserLlmResult["intentType"]): ParsedIntentType {
  switch (intentType) {
    case "cancel_task":
      return "task_modify";
    case "create_goal":
      return "task_create";
    case "decompress_goal":
      return "task_query";
    default:
      return intentType;
  }
}

function adaptModelIntentParser(
  parser: IntentParserPort | null | undefined,
  priorConversationContext: ConversationContext | undefined,
): ModelIntentParserPort | null {
  if (parser?.parseWithLlm == null) {
    return null;
  }
  return {
    async parseWithLlm(input) {
      const parsed = await parser.parseWithLlm?.({
        message: input.message,
        locale: input.locale,
        ...(priorConversationContext == null ? {} : { priorConversationContext }),
      });
      return parsed == null ? null : {
        intentType: toParsedIntentType(parsed.intentType),
        confidence: parsed.confidence,
      };
    },
  };
}

export class ContextEnricher {
  public enrich(
    message: string,
    divisionId: string,
    entities: readonly ExtractedEntity[],
  ): ContextEnrichment {
    return {
      domainHint: divisionId,
      extractedConstraints: [
        ...(entities.some((entity) => entity.entityType === "money") ? ["budget_constraint"] : []),
        ...(entities.some((entity) => entity.entityType === "date") ? ["timeline_constraint"] : []),
        ...(/(prod|production|线上|生产环境)/i.test(message) ? ["production_scope"] : []),
      ],
      targetEnvironments: entities
        .filter((entity) => entity.entityType === "environment")
        .map((entity) => String(entity.normalized)),
      requestedChannels: entities
        .filter((entity) => entity.entityType === "channel")
        .map((entity) => String(entity.normalized)),
      timelineRefs: entities
        .filter((entity) => entity.entityType === "date")
        .map((entity) => String(entity.normalized)),
    };
  }
}

export class ResponseFormatter {
  public formatTaskSummary(input: {
    readonly divisionId: string;
    readonly workflowId: string;
    readonly costEstimate: CostEstimate;
    readonly riskPreview: RiskPreview;
    readonly clarificationState: ClarificationState;
  }): string {
    const clarificationHint = input.clarificationState.state === "required"
      ? "需要先完成澄清"
      : input.clarificationState.state === "blocked"
        ? "请求命中安全防护，需要人工确认"
        : "可直接进入执行编排";
    return [
      `我将把请求路由到 ${input.divisionId}`,
      `使用工作流 ${input.workflowId}`,
      `预估成本 $${input.costEstimate.estimatedCostUsd.toFixed(2)}`,
      `风险等级 ${input.riskPreview.overallRisk}`,
      clarificationHint,
    ].join("，");
  }
}

export class NlEntryService implements NlEntryPort {
  private readonly intakeRouter: IntakeRouter;
  private readonly costEstimator: CostEstimatorPort | null;
  private readonly clarificationThreshold: number;
  private readonly localeConfig: LocaleConfig;
  private readonly conversationWindowSize: number;
  private readonly nlConfig: NlGatewayConfig;
  private readonly intentParser: IntentParserPort | null;
  private readonly memoryService: MemoryServicePort | null;
  private readonly dryRunExecutor: DryRunExecutorPort | null;
  private readonly conversationContextManager: ConversationContextManager;
  private readonly contextEnricher = new ContextEnricher();
  private readonly responseFormatter = new ResponseFormatter();
  private readonly clarificationRounds = new Map<string, number>();
  private readonly requestRateLimits = new Map<string, { count: number; windowStartedAt: number }>();
  private readonly promptInjectionPatterns: readonly RegExp[];
  private readonly genericAmbiguousPatterns: readonly RegExp[];

  public constructor(options: NlEntryServiceOptions = {}) {
    this.intakeRouter = options.intakeRouter ?? new IntakeRouter();
    this.costEstimator = options.costEstimator ?? null;
    const configuredThreshold = options.clarificationThreshold
      ?? options.nlGatewayConfig?.disambiguation.threshold
      ?? INTENT_CONFIDENCE_THRESHOLD;
    this.clarificationThreshold = Math.max(INTENT_CONFIDENCE_THRESHOLD, configuredThreshold);
    this.localeConfig = options.localeConfig ?? DEFAULT_LOCALE_CONFIG;
    this.nlConfig = options.nlGatewayConfig ?? loadNlGatewayConfig();
    this.conversationWindowSize = options.conversationWindowSize
      ?? this.nlConfig.conversationWindow.defaultSize;
    this.promptInjectionPatterns = buildPromptInjectionPatterns(
      this.nlConfig.guardrails?.additionalPromptInjectionPatterns,
    );
    this.genericAmbiguousPatterns = buildGenericAmbiguousPatterns(
      this.nlConfig.guardrails?.additionalGenericAmbiguousPatterns,
    );
    this.intentParser = options.intentParser ?? null;
    this.memoryService = options.memoryService ?? null;
    this.dryRunExecutor = options.dryRunExecutor ?? null;
    this.conversationContextManager = new ConversationContextManager(this.nlConfig);
  }

  /**
   * Get the configured conversation window size for a given task type
   */
  public getConversationWindowSize(taskType?: string): number {
    if (taskType == null) {
      return this.conversationWindowSize;
    }
    return getConversationWindowSize(this.nlConfig, taskType);
  }

  /**
   * Get the configured clarification threshold
   */
  public getClarificationThreshold(): number {
    return this.clarificationThreshold;
  }

  /**
   * Check if clarification should be requested based on config
   */
  public shouldRequestClarification(confidence: number): boolean {
    return confidence < this.clarificationThreshold;
  }

  public async parse(request: NlEntryRequest): Promise<NlEntryIntent> {
    const detailed = await this.parseDetailed(request);
    const primary = detailed.detectedIntents[0];
    return {
      intent: primary?.intentType ?? "task_query",
      confidence: detailed.confidence,
      entities: Object.fromEntries(
        (primary?.entities ?? []).map((entity) => [entity.entityType, String(entity.value)]),
      ),
    };
  }

  public async parseDetailed(request: NlEntryRequest): Promise<IntentParseResult> {
    this.enforceRateLimit(request);
    const locale = this.resolveLocale(request);
    const priorConversationContext = this.getPriorConversationContext(request);
    const securityFindings = detectPromptInjection(request.message, this.promptInjectionPatterns);
    const blockedByPolicy = securityFindings.some((item) => item.blocked);
    const route = await Promise.resolve(this.intakeRouter.route({
      title: deriveTitle(request.message),
      request: request.message,
      priorConversationContext,
    }));
    const entities = extractEntities(request.message);
    const parsedIntentTokens = blockedByPolicy
      ? []
      : await parseIntentTokensWithModel(request.message, {
          locale,
          parser: adaptModelIntentParser(this.intentParser, priorConversationContext),
          minimumConfidence: this.clarificationThreshold,
        });
    const parserIntent = parsedIntentTokens[0];
    const resolvedIntentType = parserIntent != null
      && (
        parserIntent.intentType === "why"
        || parserIntent.confidence >= route.classification.confidence
      )
      ? parserIntent.intentType
      : mapIntentType(route.classification.intent);
    const resolvedConfidence = Math.max(route.classification.confidence, parserIntent?.confidence ?? 0);
    const detectedIntent: DetectedIntent = {
      intentType: resolvedIntentType,
      domainHint: route.divisionId,
      entities,
      urgency: deriveUrgency(request.message),
      confidence: resolvedConfidence,
    };
    // R5-16: Independent risk classification pipeline stage
    // This stage runs AFTER intent parsing and is independent of intent confidence
    const riskClassification = this.classifyRisk(request.message, detectedIntent.intentType);

    const requiredSlots = inferRequiredSlots(request.message, detectedIntent.intentType, route.workflowId);
    const slotResolution = buildSlotClarificationState(
      entities,
      requiredSlots,
      {
        previousResolved: collectResolvedSlotsFromTurns(priorConversationContext?.turns ?? []),
      },
    );
    const context = {
      ...this.contextEnricher.enrich(request.message, route.divisionId, entities),
      requiredSlots,
      missingSlots: slotResolution.missing,
      resolvedSlots: slotResolution.resolved,
    };
    const clarificationQuestions = [...new Set([
      ...buildClarificationQuestions(
        request.message,
        resolvedConfidence,
        route.divisionId,
        entities,
        this.genericAmbiguousPatterns,
      ),
      ...slotResolution.questions,
    ])];
    const slotConfidence = estimateSlotConfidence(entities, request.message);
    const requiresClarification =
      blockedByPolicy
      || resolvedConfidence < this.clarificationThreshold
      || slotConfidence < SLOT_CONFIDENCE_THRESHOLD
      || !slotResolution.isComplete
      || clarificationQuestions.length > 0
      // R5-16: Risk classification is an independent gate - high/critical risk requires clarification regardless of intent confidence
      || riskClassification.riskLevel === "critical"
      || riskClassification.riskLevel === "high";
    const clarificationState: ClarificationState = {
      state: blockedByPolicy ? "blocked" : requiresClarification ? "required" : "none",
      reasonCodes: [
        ...(blockedByPolicy ? ["nl_gateway.prompt_injection_detected"] : []),
        ...(resolvedConfidence < this.clarificationThreshold ? ["nl_gateway.intent_confidence_low"] : []),
        ...(slotConfidence < SLOT_CONFIDENCE_THRESHOLD ? ["nl_gateway.slot_confidence_low"] : []),
        ...(!slotResolution.isComplete ? ["nl_gateway.required_slots_missing"] : []),
        // R5-16: Risk-based reason code for independent risk gate
        ...(riskClassification.riskLevel === "critical" ? ["nl_gateway.risk_classification_critical"] : []),
        ...(riskClassification.riskLevel === "high" ? ["nl_gateway.risk_classification_high"] : []),
      ],
      questions: clarificationQuestions,
      // R5-30: Initialize rounds to 0, maxRounds defaults to 3
      rounds: 0,
      maxRounds: DEFAULT_MAX_CLARIFICATION_ROUNDS,
    };

    return {
      rawInput: request.message,
      detectedIntents: [detectedIntent],
      confidence: resolvedConfidence,
      requiresClarification,
      locale,
      continuation: route.classification.continuation,
      suggestedDivisionId: route.divisionId,
      suggestedWorkflowId: route.workflowId,
      conversationState: deriveConversationState(requiresClarification, false, blockedByPolicy),
      clarificationState,
      context,
      securityFindings,
      blockedByPolicy,
      priorConversationTurns: priorConversationContext?.turns ?? [],
      // R5-16: Include risk classification result
      riskClassification,
      ...(clarificationQuestions.length > 0 ? { clarificationQuestions } : {}),
    };
  }

  /**
   * R5-16: Independent risk classification pipeline stage
   * This is a separate, independent gate that evaluates risk without dependence on intent confidence.
   * It classifies the request based on content analysis alone.
   */
  private classifyRisk(message: string, intentType: DetectedIntent["intentType"]): { riskLevel: "low" | "medium" | "high" | "critical"; riskFactors: readonly string[]; requiresApproval: boolean } {
    const normalized = message.toLowerCase();
    const critical = CRITICAL_RISK_KEYWORDS.some((keyword) => normalized.includes(keyword));
    const high = critical || HIGH_RISK_KEYWORDS.some((keyword) => normalized.includes(keyword));
    const irreversible = IRREVERSIBLE_KEYWORDS.some((keyword) => normalized.includes(keyword));
    const riskFactors: string[] = [];

    if (critical) {
      riskFactors.push("请求涉及破坏性或生产级变更");
    } else if (high) {
      riskFactors.push("请求可能影响线上系统、审批流或成本");
    }
    if (requiresApprovalIntent(intentType)) {
      riskFactors.push("请求属于审批类动作，需要审计和责任链");
    }
    if (/(budget|cost|费用|预算|price|价格)/i.test(message)) {
      riskFactors.push("可能改变成本或预算分配");
    }
    if (/(deploy|release|publish|发布|上线)/i.test(message)) {
      riskFactors.push("可能影响运行中的环境或用户体验");
    }
    if (/(delete|drop|remove|删除|清空)/i.test(message)) {
      riskFactors.push("可能移除已有数据或配置");
    }

    const riskLevel = critical ? "critical" : high ? "high" : isMediumRiskIntent(intentType) ? "medium" : "low";
    const requiresApproval = critical || high || requiresApprovalIntent(intentType);

    return { riskLevel, riskFactors, requiresApproval };
  }

  private enforceRateLimit(request: NlEntryRequest): void {
    if (!this.nlConfig.rateLimit.enabled) {
      return;
    }
    const now = Date.now();
    this.consumeRateLimit(`tenant:${request.tenantId}`, this.nlConfig.rateLimit.perTenantRequestsPerWindow, now);
    this.consumeRateLimit(`tenant:${request.tenantId}:user:${request.userId}`, this.nlConfig.rateLimit.perUserRequestsPerWindow, now);
  }

  private consumeRateLimit(key: string, limit: number, now: number): void {
    const windowMs = this.nlConfig.rateLimit.windowMs;
    const current = this.requestRateLimits.get(key);
    if (current == null || now - current.windowStartedAt >= windowMs) {
      this.requestRateLimits.set(key, { count: 1, windowStartedAt: now });
      return;
    }
    if (current.count >= limit) {
      throw new Error(`nl_gateway.rate_limited:${key}`);
    }
    current.count += 1;
  }

  public async buildTask(request: NlEntryRequest): Promise<TaskBuildResult> {
    const detailed = await this.parseDetailed(request);
    const primaryIntent = detailed.detectedIntents[0] ?? {
      intentType: "task_query" as const,
      domainHint: null,
      entities: [],
      urgency: "low" as const,
      confidence: detailed.confidence,
    };
    // R9-41: Use async dry-run version for actual risk assessment
    const riskPreview = await buildRiskPreviewWithDryRun(
      request.message,
      primaryIntent.intentType,
      this.dryRunExecutor,
      { message: request.message, divisionId: detailed.suggestedDivisionId, workflowId: detailed.suggestedWorkflowId, userId: request.userId, locale: detailed.locale },
    );
    const costEstimate = this.costEstimator?.estimate(detailed.suggestedDivisionId) ?? defaultCostEstimate();
    const confirmationRequired = detailed.requiresClarification || riskPreview.approvalNeeded || riskPreview.overallRisk === "critical" || detailed.blockedByPolicy;
    const clarificationKey = clarificationRoundKey(request);
    const nextClarificationRound = detailed.requiresClarification
      ? (this.clarificationRounds.get(clarificationKey) ?? 0) + 1
      : 0;
    if (detailed.requiresClarification) {
      this.clarificationRounds.set(clarificationKey, nextClarificationRound);
    } else {
      this.clarificationRounds.delete(clarificationKey);
    }
    const clarificationState: ClarificationState = {
      ...detailed.clarificationState,
      rounds: nextClarificationRound,
      state: nextClarificationRound > detailed.clarificationState.maxRounds
        ? "blocked"
        : detailed.clarificationState.state,
      reasonCodes: nextClarificationRound > detailed.clarificationState.maxRounds
        ? [...detailed.clarificationState.reasonCodes, "nl_gateway.max_clarification_rounds_exceeded"]
        : detailed.clarificationState.reasonCodes,
    };
    const dryRunPreview = buildDryRunPreview({
      request,
      divisionId: detailed.suggestedDivisionId,
      workflowId: detailed.suggestedWorkflowId,
      riskPreview,
      context: detailed.context,
    });
    const humanSummaryBase = this.responseFormatter.formatTaskSummary({
      divisionId: detailed.suggestedDivisionId,
      workflowId: detailed.suggestedWorkflowId,
      costEstimate,
      riskPreview,
      clarificationState,
    });
    const humanSummary = dryRunPreview == null
      ? humanSummaryBase
      : `${humanSummaryBase}，已生成 dry-run 预演摘要`;
    const conversationState = deriveConversationState(
      clarificationState.state !== "none",
      confirmationRequired,
      detailed.blockedByPolicy,
    );
    const taskDraft: TaskDraft = {
      draftId: deriveTitle(request.message).replace(/\s+/g, "_").toLowerCase(),
      rawInput: request.message,
      locale: detailed.locale,
      intent: primaryIntent,
      context: detailed.context,
      riskPreview,
      state: confirmationRequired ? "Confirming" : "Executing",
    };
    const confirmationScope = buildConfirmationScope(detailed.suggestedDivisionId, detailed.context);
    const confirmationReceipt: UserConfirmationReceipt = {
      confirmationId: `${taskDraft.draftId}:confirmation`,
      required: confirmationRequired,
      state: confirmationRequired ? "pending_user_confirmation" : "not_required",
      reasonCodes: [
        ...(clarificationState.state !== "none" ? ["nl_gateway.clarification_required"] : []),
        ...(riskPreview.approvalNeeded ? ["nl_gateway.approval_required"] : []),
        ...(detailed.blockedByPolicy ? ["nl_gateway.security_review_required"] : []),
        ...(dryRunPreview == null ? [] : ["nl_gateway.dry_run_preview_ready"]),
      ],
      summary: humanSummary,
      scope: confirmationScope,
      time: nowIso(),
      riskPreviewVersion: `risk-preview-v1:${riskPreview.overallRisk}`,
      riskPreview,
      actor: request.userId,
      timestamp: nowIso(),
    };
    const shouldEmitEnvelope = !confirmationRequired;
    const autonomyMode = resolveAutonomyMode(confirmationRequired, riskPreview);
    const runtimeMode = resolveRuntimeMode(confirmationRequired, riskPreview);
    const canonicalDomainId = buildCanonicalDomainId(detailed.suggestedDivisionId);
    const principalRef = createPrincipalRef({
      principalId: request.userId,
      tenantId: request.tenantId,
      roles: ["requester"],
      authorizationLevel: "operator",
    });
    const idempotencyKey = buildStableIdempotencyKey(request);
    const traceId = `trace:${idempotencyKey}`;
    const canonicalTaskDraft = createCanonicalTaskDraft({
      tenantId: request.tenantId,
      principal: principalRef,
      source: "nl",
      domainId: canonicalDomainId,
      taskDraftId: taskDraft.draftId,
      normalizedIntent: toJsonValue({
        intentType: primaryIntent.intentType,
        intent: primaryIntent.intentType,
        domainId: canonicalDomainId,
        divisionId: detailed.suggestedDivisionId,
        workflowId: detailed.suggestedWorkflowId,
        locale: detailed.locale,
        continuation: detailed.continuation,
        entities: serializeEntities(primaryIntent.entities),
        context: {
          ...detailed.context,
          autonomyMode,
          runtimeMode,
          confirmationScope,
        },
        summary: humanSummary,
      }),
      missingFields: detailed.context.missingSlots ?? [],
      riskPreview: {
        riskClass: riskPreview.overallRisk,
        reasons: riskPreview.riskFactors,
      },
      ambiguityPolicy: detailed.blockedByPolicy
        ? "reject"
        : confirmationRequired
          ? "require_confirmation"
          : "safe_default",
    });
    const confirmedTaskSpec = shouldEmitEnvelope
      ? createConfirmedTaskSpec({
          taskDraftId: canonicalTaskDraft.taskDraftId,
          tenantId: request.tenantId,
          principal: principalRef,
          domainId: canonicalDomainId,
          goal: deriveTitle(request.message),
          inputs: canonicalTaskDraft.normalizedIntent,
          constraintPackRef: `constraint_pack:nl:${detailed.suggestedDivisionId}:${detailed.suggestedWorkflowId}`,
          riskClass: riskPreview.overallRisk,
          idempotencyKey,
          traceId,
        })
      : null;
    const canonicalRequestEnvelope = confirmedTaskSpec == null
      ? null
      : createRequestEnvelopeFromConfirmedTask({
          confirmedTaskSpec,
          priority: riskPreview.overallRisk === "critical" ? 100 : riskPreview.overallRisk === "high" ? 75 : 25,
          requestHash: `request:${idempotencyKey}`,
          budgetIntent: {
            amount: costEstimate.estimatedCostUsd,
            currency: "USD",
            resourceKinds: ["token"],
          },
          policyContext: {
            autonomyMode,
            runtimeMode,
            confirmationScope,
          },
          sourcePlane: "interaction",
          targetPlane: "execution",
        });
    const clarificationSession = confirmationRequired
      ? {
          sessionId: `${taskDraft.draftId}:clarification`,
          taskDraftId: taskDraft.draftId,
          stage: "pending_clarification" as const,
        }
      : null;

    const result = {
      requestEnvelope: shouldEmitEnvelope
        ? createRequestEnvelope<NlRequestPayload>({
            principal: createPlatformPrincipal({
              actorId: request.userId,
              tenantId: request.tenantId,
              roles: ["requester"],
              authMethod: "nl_entry",
            }),
            tenantId: request.tenantId,
            payload: {
              userId: request.userId,
              title: deriveTitle(request.message),
              request: request.message,
              locale: detailed.locale,
              channel: request.channel ?? null,
              divisionId: detailed.suggestedDivisionId,
              workflowId: detailed.suggestedWorkflowId,
              intent: primaryIntent.intentType,
              continuation: detailed.continuation,
              entities: primaryIntent.entities,
              confirmationRequired: false,
              generatedSummary: humanSummary,
            },
            metadata: {
              source: "nl_entry",
              confirmationRequired: false,
              divisionId: detailed.suggestedDivisionId,
              workflowId: detailed.suggestedWorkflowId,
              locale: detailed.locale,
            },
          })
        : null,
      riskPreview,
      costEstimate,
      confirmationRequired,
      humanSummary,
      taskDraft,
      clarificationState,
      confirmationReceipt,
      conversationState,
      clarificationSession,
      canonicalTaskDraft,
      confirmedTaskSpec,
      canonicalRequestEnvelope,
      ...(dryRunPreview == null ? {} : { dryRunPreview }),
    };

    this.persistConversationTurn(request, primaryIntent);
    return result;
  }

  private resolveLocale(request: Pick<NlEntryRequest, "locale" | "preferredLocale" | "acceptLanguage" | "message">): string {
    const resolutionOrder = this.localeConfig.localeResolutionOrder ?? DEFAULT_LOCALE_CONFIG.localeResolutionOrder!;
    for (const source of resolutionOrder) {
      if (source === "user_profile") {
        const candidate = request.preferredLocale ?? request.locale;
        if (candidate && this.localeConfig.supportedLocales.includes(candidate)) {
          return candidate;
        }
      }
      if (source === "accept_language") {
        for (const candidate of parseAcceptLanguage(request.acceptLanguage)) {
          if (this.localeConfig.supportedLocales.includes(candidate)) {
            return candidate;
          }
          const partial = this.localeConfig.supportedLocales.find((item) => item.startsWith(candidate.split("-")[0] ?? ""));
          if (partial) {
            return partial;
          }
        }
      }
      if (source === "input_detect") {
        const detected = detectInputLocale(request.message);
        if (detected && this.localeConfig.supportedLocales.includes(detected)) {
          return detected;
        }
      }
      if (source === "default") {
        return this.localeConfig.defaultLocale;
      }
    }
    return this.localeConfig.defaultLocale;
  }

  private getPriorConversationContext(request: NlEntryRequest): ConversationContext | undefined {
    const localContext = this.conversationContextManager.getContext(request.tenantId, request.userId);
    const turns = localContext.turns.length > 0
      ? localContext.turns
      : this.rehydrateConversationTurns(request);
    if (turns.length === 0) {
      return undefined;
    }
    const lastIntent = turns[turns.length - 1]?.detectedIntent;
    return {
      tenantId: request.tenantId,
      userId: request.userId,
      turnCount: turns.length,
      maxTurns: this.conversationWindowSize,
      turns,
      ...(lastIntent == null ? {} : { lastIntent }),
    };
  }

  private rehydrateConversationTurns(request: NlEntryRequest): readonly ConversationTurn[] {
    if (this.memoryService == null) {
      return [];
    }
    const memories = this.memoryService.findMemories({
      scope: buildConversationMemoryScope(request.tenantId, request.userId),
    });
    const turns: ConversationTurn[] = [];
    for (const memory of memories) {
      try {
        const parsed = JSON.parse(memory.content) as Partial<ConversationTurn>;
        if (
          typeof parsed.message === "string"
          && parsed.detectedIntent != null
          && typeof parsed.timestamp === "string"
        ) {
          turns.push({
            turnNumber: turns.length + 1,
            message: parsed.message,
            detectedIntent: parsed.detectedIntent as DetectedIntent,
            timestamp: parsed.timestamp,
          });
        }
      } catch {
        continue;
      }
    }
    return turns.slice(-this.conversationWindowSize);
  }

  private persistConversationTurn(request: NlEntryRequest, intent: DetectedIntent): void {
    const context = this.conversationContextManager.addTurn(
      request.tenantId,
      request.userId,
      request.message,
      intent,
      intent.intentType,
    );
    const latestTurn = context.turns[context.turns.length - 1];
    if (latestTurn == null || this.memoryService == null) {
      return;
    }
    this.memoryService.remember({
      scope: buildConversationMemoryScope(request.tenantId, request.userId),
      content: JSON.stringify(latestTurn),
      classification: "nl_gateway.conversation_turn",
    });
  }
}

/**
 * Conversation Context Manager
 *
 * Manages multi-turn conversation context with configurable window size.
 * Window size can be configured per task type via nlGatewayConfig.
 */
export class ConversationContextManager {
  private readonly contexts = new Map<string, ConversationContext>();
  private readonly nlConfig: NlGatewayConfig;
  private readonly maxActiveContexts: number;

  public constructor(nlConfig?: NlGatewayConfig, options: ConversationContextManagerOptions = {}) {
    this.nlConfig = nlConfig ?? loadNlGatewayConfig();
    this.maxActiveContexts = Math.max(1, options.maxActiveContexts ?? DEFAULT_MAX_ACTIVE_CONVERSATION_CONTEXTS);
  }

  /**
   * Get or create a conversation context for a user
   */
  public getContext(tenantId: string, userId: string, taskType?: string): ConversationContext {
    const key = `${tenantId}:${userId}`;
    const existing = this.contexts.get(key);

    if (existing) {
      this.touchContext(key, existing);
      return existing;
    }

    const maxTurns = getConversationWindowSize(this.nlConfig, taskType);
    return {
      tenantId,
      userId,
      turnCount: 0,
      maxTurns,
      turns: [],
    };
  }

  /**
   * Add a turn to the conversation
   */
  public addTurn(
    tenantId: string,
    userId: string,
    message: string,
    intent: DetectedIntent,
    taskType?: string,
  ): ConversationContext {
    const key = `${tenantId}:${userId}`;
    const current = this.getContext(tenantId, userId, taskType);
    const maxTurns = getConversationWindowSize(this.nlConfig, taskType);

    const turn: ConversationTurn = {
      turnNumber: current.turnCount + 1,
      message,
      detectedIntent: intent,
      timestamp: new Date().toISOString(),
    };

    const updatedTurns = [...current.turns, turn];

    // Prune to window size
    const prunedTurns = updatedTurns.length > maxTurns
      ? updatedTurns.slice(-maxTurns)
      : updatedTurns;

    const updatedContext: ConversationContext = {
      tenantId,
      userId,
      turnCount: prunedTurns.length,
      maxTurns,
      turns: prunedTurns,
      lastIntent: intent,
    };

    this.contexts.set(key, updatedContext);
    this.evictLeastRecentlyUsedContexts();
    return updatedContext;
  }

  /**
   * Clear a conversation context
   */
  public clearContext(tenantId: string, userId: string): void {
    const key = `${tenantId}:${userId}`;
    this.contexts.delete(key);
  }

  /**
   * Check if conversation is approaching window limit
   */
  public isNearWindowLimit(tenantId: string, userId: string): boolean {
    const context = this.contexts.get(`${tenantId}:${userId}`);
    if (!context) {
      return false;
    }
    return context.turnCount >= context.maxTurns - 2;
  }

  /**
   * Get window size for a specific task type
   */
  public getWindowSize(taskType?: string): number {
    return getConversationWindowSize(this.nlConfig, taskType);
  }

  private touchContext(key: string, context: ConversationContext): void {
    this.contexts.delete(key);
    this.contexts.set(key, context);
  }

  private evictLeastRecentlyUsedContexts(): void {
    while (this.contexts.size > this.maxActiveContexts) {
      const oldestKey = this.contexts.keys().next().value;
      if (oldestKey == null) {
        break;
      }
      this.contexts.delete(oldestKey);
    }
  }
}
