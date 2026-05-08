export { detectAmbiguity } from "./ambiguity-handler/index.js";
export * from "./disambiguation-handler/index.js";
export * from "./intent-parser/index.js";
export * from "./slot-resolver/index.js";

import {
  loadNlGatewayConfig,
  getConversationWindowSize,
  shouldRequestClarification,
  type NlGatewayConfig,
  type ConversationWindowConfig,
  type DisambiguationConfig,
  type IntentConfig,
  type EntityExtractionConfig,
} from "./nl-gateway-config-loader.js";

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
};

import { IntakeRouter } from "../../platform/orchestration/routing/intake-router.js";
import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import {
  createPlatformPrincipal,
  createRequestEnvelope,
  type RequestEnvelope as PlatformRequestEnvelope,
} from "../../platform/contracts/types/index.js";

export interface NlEntryRequest {
  readonly tenantId: string;
  readonly userId: string;
  readonly message: string;
  readonly locale?: string;
  readonly preferredLocale?: string;
  readonly acceptLanguage?: string;
  readonly channel?: string;
}

export interface NlEntryIntent {
  readonly intent: string;
  readonly confidence: number;
  readonly entities: Record<string, string>;
}

export interface NlEntryPort {
  parse(request: NlEntryRequest): Promise<NlEntryIntent>;
}

export interface ExtractedEntity {
  readonly entityType: string;
  readonly value: string;
  readonly normalized: unknown;
  readonly sourceSpan: readonly [number, number];
}

export interface DetectedIntent {
  readonly intentType:
    | "task_create"
    | "task_query"
    | "task_modify"
    | "status_inquiry"
    | "approval_action";
  readonly domainHint: string | null;
  readonly entities: readonly ExtractedEntity[];
  readonly urgency: "low" | "normal" | "high" | "critical";
  readonly confidence: number;
}

export interface IntentParseResult {
  readonly rawInput: string;
  readonly detectedIntents: readonly DetectedIntent[];
  readonly confidence: number;
  readonly requiresClarification: boolean;
  readonly clarificationQuestions?: readonly string[];
  readonly locale: string;
  readonly continuation: "new_task" | "follow_up" | "correction";
  readonly suggestedDivisionId: string;
  readonly suggestedWorkflowId: string;
  readonly conversationState: ConversationState;
  readonly clarificationState: ClarificationState;
  readonly context: ContextEnrichment;
  readonly securityFindings: readonly PromptInjectionFinding[];
  readonly blockedByPolicy: boolean;
}

export interface RiskPreview {
  readonly overallRisk: "low" | "medium" | "high" | "critical";
  readonly riskFactors: readonly string[];
  readonly reversible: boolean;
  readonly sideEffects: readonly string[];
  readonly approvalNeeded: boolean;
}

export interface NlRequestPayload {
  readonly userId: string;
  readonly title: string;
  readonly request: string;
  readonly locale: string;
  readonly channel: string | null;
  readonly divisionId: string;
  readonly workflowId: string;
  readonly intent: DetectedIntent["intentType"];
  readonly continuation: IntentParseResult["continuation"];
  readonly entities: readonly ExtractedEntity[];
  readonly confirmationRequired: boolean;
  readonly generatedSummary: string;
}

export type RequestEnvelope = PlatformRequestEnvelope<NlRequestPayload>;

export type ConversationState =
  | "Idle"
  | "IntentParsing"
  | "Clarifying"
  | "Building"
  | "Confirming"
  | "Executing"
  | "Reporting";

export interface PromptInjectionFinding {
  readonly reasonCode: string;
  readonly severity: "low" | "medium" | "high";
  readonly blocked: boolean;
  readonly matchedText: string;
}

export interface ContextEnrichment {
  readonly domainHint: string;
  readonly extractedConstraints: readonly string[];
  readonly targetEnvironments: readonly string[];
  readonly requestedChannels: readonly string[];
  readonly timelineRefs: readonly string[];
}

export interface TaskDraft {
  readonly draftId: string;
  readonly rawInput: string;
  readonly locale: string;
  readonly intent: DetectedIntent;
  readonly context: ContextEnrichment;
  readonly riskPreview: RiskPreview;
  readonly state: Extract<ConversationState, "Building" | "Confirming" | "Executing">;
}

export interface ClarificationState {
  readonly state: "none" | "required" | "blocked";
  readonly reasonCodes: readonly string[];
  readonly questions: readonly string[];
}

export interface UserConfirmationReceipt {
  readonly confirmationId: string;
  readonly required: boolean;
  readonly state: "not_required" | "pending_user_confirmation";
  readonly reasonCodes: readonly string[];
  readonly summary: string;
}

export interface TaskBuildResult {
  readonly requestEnvelope: RequestEnvelope;
  readonly riskPreview: RiskPreview;
  readonly costEstimate: CostEstimate;
  readonly confirmationRequired: boolean;
  readonly humanSummary: string;
  readonly taskDraft: TaskDraft;
  readonly clarificationState: ClarificationState;
  readonly confirmationReceipt: UserConfirmationReceipt;
  readonly conversationState: ConversationState;
}

export interface LocaleConfig {
  readonly supportedLocales: readonly string[];
  readonly defaultLocale: string;
  readonly localeResolutionOrder?: readonly LocaleResolutionSource[];
}

export type LocaleResolutionSource = "user_profile" | "accept_language" | "input_detect" | "default";

export interface CostEstimatorPort {
  estimate(divisionId?: string | null): CostEstimate;
}

export interface NlEntryServiceOptions {
  readonly intakeRouter?: IntakeRouter;
  readonly costEstimator?: CostEstimatorPort | null;
  readonly clarificationThreshold?: number;
  readonly localeConfig?: LocaleConfig;
  readonly conversationWindowSize?: number;
  readonly nlGatewayConfig?: NlGatewayConfig;
}

const INTENT_CONFIDENCE_THRESHOLD = 0.8;
const SLOT_CONFIDENCE_THRESHOLD = 0.85;
const PROMPT_INJECTION_PATTERNS = [
  /ignore (all|any|previous|prior) instructions/i,
  /reveal (the )?(system|developer) prompt/i,
  /show me (the )?(hidden|internal) instructions/i,
  /bypass (the )?(guardrails|safety|policy)/i,
  /忽略(所有|之前|上面)指令/,
  /泄露(系统|开发者)?提示词/,
  /绕过(安全|策略|护栏)/,
] as const;

/**
 * Conversation context for multi-turn dialogs
 */
export interface ConversationContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly turnCount: number;
  readonly maxTurns: number;
  readonly turns: readonly ConversationTurn[];
  readonly lastIntent?: DetectedIntent;
}

export interface ConversationTurn {
  readonly turnNumber: number;
  readonly message: string;
  readonly detectedIntent: DetectedIntent;
  readonly timestamp: string;
}

const DEFAULT_LOCALE_CONFIG: LocaleConfig = {
  supportedLocales: ["zh-CN", "en-US", "ja-JP", "de-DE"],
  defaultLocale: "zh-CN",
  localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
};

const GENERIC_AMBIGUOUS_PATTERNS = [
  "做一份报表",
  "处理一下",
  "看一下",
  "帮我处理",
  "帮我做",
  "做一个",
  "optimize this",
  "handle it",
  "fix this",
  "do the report",
] as const;

const HIGH_RISK_KEYWORDS = [
  "delete",
  "drop",
  "remove",
  "erase",
  "purge",
  "deploy",
  "release",
  "publish",
  "approve",
  "price",
  "production",
  "prod",
  "删除",
  "清理",
  "下线",
  "发布",
  "上线",
  "审批",
  "价格",
  "生产环境",
] as const;

const CRITICAL_RISK_KEYWORDS = [
  "delete production",
  "drop table",
  "mass delete",
  "delete all",
  "删除全部",
  "删除生产",
  "清空",
] as const;

const IRREVERSIBLE_KEYWORDS = [
  "delete",
  "drop",
  "erase",
  "remove",
  "删除",
  "清空",
  "覆盖",
] as const;

const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;
const PERCENT_PATTERN = /\b\d+(?:\.\d+)?%\b/g;
const CURRENCY_PATTERN = /(?:¥|\$|￥)\s?\d+(?:\.\d+)?/g;
const ENV_PATTERN = /\b(prod|production|staging|stage|dev|test)\b|线上|生产环境|测试环境/gi;
const CHANNEL_PATTERN = /\b(slack|telegram|webhook|email|api)\b/gi;

function detectInputLocale(message: string): string | null {
  if (/[\u4e00-\u9fff]/.test(message)) {
    return "zh-CN";
  }
  if (/[\u3040-\u30ff]/.test(message)) {
    return "ja-JP";
  }
  if (/[äöüß]/i.test(message)) {
    return "de-DE";
  }
  if (/[a-z]/i.test(message)) {
    return "en-US";
  }
  return null;
}

function parseAcceptLanguage(raw?: string): string[] {
  if (raw == null || raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim().split(";")[0]?.trim())
    .filter((item): item is string => Boolean(item && item.length > 0));
}

function mapIntentType(intent: string): DetectedIntent["intentType"] {
  switch (intent) {
    case "create":
      return "task_create";
    case "modify":
    case "cancel":
    case "correction":
      return "task_modify";
    case "approve":
      return "approval_action";
    case "clarify":
    case "chitchat":
      return "status_inquiry";
    default:
      return "task_query";
  }
}

function deriveUrgency(message: string): DetectedIntent["urgency"] {
  const normalized = message.toLowerCase();
  if (/(critical|sev1|p0|立刻停机|立即回滚|马上删除生产|critical incident|紧急停机)/.test(normalized)) {
    return "critical";
  }
  if (/(asap|immediately|urgent|立刻|马上|紧急|尽快)/.test(normalized)) {
    return "high";
  }
  if (/(today|before|今晚|今天|本周)/.test(normalized)) {
    return "normal";
  }
  return "low";
}

function deriveTitle(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  if (compact.length <= 60) {
    return compact;
  }
  return `${compact.slice(0, 57)}...`;
}

function dedupeEntities(entities: readonly ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Set<string>();
  const result: ExtractedEntity[] = [];
  for (const entity of entities) {
    const key = `${entity.entityType}:${entity.value}:${JSON.stringify(entity.normalized)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entity);
  }
  return result;
}

function collectRegexEntities(message: string, pattern: RegExp, entityType: string, normalizeValue?: (value: string) => unknown): ExtractedEntity[] {
  const regex = new RegExp(pattern.source, pattern.flags);
  const entities: ExtractedEntity[] = [];
  for (const match of message.matchAll(regex)) {
    const value = match[0];
    if (value == null || match.index == null) {
      continue;
    }
    entities.push({
      entityType,
      value,
      normalized: normalizeValue?.(value) ?? value,
      sourceSpan: [match.index, match.index + value.length],
    });
  }
  return entities;
}

function extractEntities(message: string): ExtractedEntity[] {
  const entities = [
    ...collectRegexEntities(message, DATE_PATTERN, "date", (value) => value),
    ...collectRegexEntities(message, PERCENT_PATTERN, "percentage", (value) => Number.parseFloat(value.replace("%", "")) / 100),
    ...collectRegexEntities(message, CURRENCY_PATTERN, "money", (value) => Number.parseFloat(value.replace(/[^\d.]/g, ""))),
    ...collectRegexEntities(message, ENV_PATTERN, "environment", (value) => value.toString().toLowerCase()),
    ...collectRegexEntities(message, CHANNEL_PATTERN, "channel", (value) => value.toString().toLowerCase()),
  ];
  return dedupeEntities(entities);
}

function defaultCostEstimate(): CostEstimate {
  return {
    estimatedCostUsd: 0.05,
    confidence: "default",
    sampleCount: 0,
    divisionId: null,
    basedOn: "default",
  };
}

function estimateSlotConfidence(entities: readonly ExtractedEntity[], message: string): number {
  if (entities.length >= 2) {
    return 0.95;
  }
  if (entities.length === 1) {
    return /(deploy|release|delete|修改|更新|删除|发布)/i.test(message) ? 0.78 : 0.88;
  }
  return /(deploy|release|delete|修改|更新|删除|发布)/i.test(message) ? 0.52 : 0.72;
}

function buildClarificationQuestions(message: string, confidence: number, divisionId: string, entities: readonly ExtractedEntity[]): string[] {
  const questions: string[] = [];
  const normalized = message.toLowerCase();
  if (confidence < INTENT_CONFIDENCE_THRESHOLD) {
    questions.push("你希望我先查询现状、创建新任务，还是修改已有内容？");
  }
  if (GENERIC_AMBIGUOUS_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    questions.push("请补充更具体的范围，例如业务域、时间区间或目标对象。");
  }
  if (divisionId === "general_ops" && /(报表|report|campaign|广告|合同|招聘|deploy|release|代码|bug)/i.test(message)) {
    questions.push("这是哪个业务域的请求？例如工程、营销、法务或 HR。");
  }
  if (entities.length === 0 && /(modify|update|delete|修改|更新|删除|deploy|release|发布)/i.test(message)) {
    questions.push("请指出具体对象或环境，避免误操作。");
  }
  return questions;
}

function detectPromptInjection(message: string): PromptInjectionFinding[] {
  return PROMPT_INJECTION_PATTERNS.flatMap((pattern) => {
    const matched = pattern.exec(message);
    if (matched == null) {
      return [];
    }
    return [{
      reasonCode: "nl_gateway.prompt_injection_detected",
      severity: /reveal|show me|泄露/.test(matched[0]) ? "high" : "medium",
      blocked: true,
      matchedText: matched[0],
    } satisfies PromptInjectionFinding];
  });
}

function deriveConversationState(
  requiresClarification: boolean,
  confirmationRequired: boolean,
  blockedByPolicy: boolean,
): ConversationState {
  if (blockedByPolicy) {
    return "Clarifying";
  }
  if (requiresClarification) {
    return "Clarifying";
  }
  if (confirmationRequired) {
    return "Confirming";
  }
  return "Executing";
}

function buildRiskPreview(message: string, intentType: DetectedIntent["intentType"]): RiskPreview {
  const normalized = message.toLowerCase();
  const critical = CRITICAL_RISK_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const high = HIGH_RISK_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const irreversible = IRREVERSIBLE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const riskFactors: string[] = [];
  const sideEffects: string[] = [];

  if (critical) {
    riskFactors.push("请求涉及破坏性或生产级变更");
  } else if (high) {
    riskFactors.push("请求可能影响线上系统、审批流或成本");
  }
  if (intentType === "approval_action") {
    riskFactors.push("请求属于审批类动作，需要审计和责任链");
  }
  if (/(budget|cost|费用|预算|price|价格)/i.test(message)) {
    sideEffects.push("可能改变成本或预算分配");
  }
  if (/(deploy|release|publish|发布|上线)/i.test(message)) {
    sideEffects.push("可能影响运行中的环境或用户体验");
  }
  if (/(delete|drop|remove|删除|清空)/i.test(message)) {
    sideEffects.push("可能移除已有数据或配置");
  }

  return {
    overallRisk: critical ? "critical" : high ? "high" : intentType === "task_modify" ? "medium" : "low",
    riskFactors,
    reversible: !irreversible,
    sideEffects,
    approvalNeeded: critical || high || intentType === "approval_action",
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
  private readonly contextEnricher = new ContextEnricher();
  private readonly responseFormatter = new ResponseFormatter();

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
  }

  /**
   * Get the configured conversation window size for a given task type
   */
  public getConversationWindowSize(taskType?: string): number {
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
    const route = this.intakeRouter.route({
      title: deriveTitle(request.message),
      request: request.message,
    });
    const entities = extractEntities(request.message);
    const securityFindings = detectPromptInjection(request.message);
    const detectedIntent: DetectedIntent = {
      intentType: mapIntentType(route.classification.intent),
      domainHint: route.divisionId,
      entities,
      urgency: deriveUrgency(request.message),
      confidence: route.classification.confidence,
    };
    const context = this.contextEnricher.enrich(request.message, route.divisionId, entities);
    const clarificationQuestions = buildClarificationQuestions(
      request.message,
      route.classification.confidence,
      route.divisionId,
      entities,
    );
    const locale = this.resolveLocale(request);
    const slotConfidence = estimateSlotConfidence(entities, request.message);
    const blockedByPolicy = securityFindings.some((item) => item.blocked);
    const requiresClarification =
      blockedByPolicy
      || route.classification.confidence < this.clarificationThreshold
      || slotConfidence < SLOT_CONFIDENCE_THRESHOLD
      || clarificationQuestions.length > 0;
    const clarificationState: ClarificationState = {
      state: blockedByPolicy ? "blocked" : requiresClarification ? "required" : "none",
      reasonCodes: [
        ...(blockedByPolicy ? ["nl_gateway.prompt_injection_detected"] : []),
        ...(route.classification.confidence < this.clarificationThreshold ? ["nl_gateway.intent_confidence_low"] : []),
        ...(slotConfidence < SLOT_CONFIDENCE_THRESHOLD ? ["nl_gateway.slot_confidence_low"] : []),
      ],
      questions: clarificationQuestions,
    };

    return {
      rawInput: request.message,
      detectedIntents: [detectedIntent],
      confidence: route.classification.confidence,
      requiresClarification,
      locale,
      continuation: route.classification.continuation,
      suggestedDivisionId: route.divisionId,
      suggestedWorkflowId: route.workflowId,
      conversationState: requiresClarification ? "Clarifying" : "Building",
      clarificationState,
      context,
      securityFindings,
      blockedByPolicy,
      ...(clarificationQuestions.length > 0 ? { clarificationQuestions } : {}),
    };
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
    const riskPreview = buildRiskPreview(request.message, primaryIntent.intentType);
    const costEstimate = this.costEstimator?.estimate(detailed.suggestedDivisionId) ?? defaultCostEstimate();
    const confirmationRequired = detailed.requiresClarification || riskPreview.approvalNeeded || riskPreview.overallRisk === "critical" || detailed.blockedByPolicy;
    const humanSummary = this.responseFormatter.formatTaskSummary({
      divisionId: detailed.suggestedDivisionId,
      workflowId: detailed.suggestedWorkflowId,
      costEstimate,
      riskPreview,
      clarificationState: detailed.clarificationState,
    });
    const conversationState = deriveConversationState(
      detailed.requiresClarification,
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
    const confirmationReceipt: UserConfirmationReceipt = {
      confirmationId: `${taskDraft.draftId}:confirmation`,
      required: confirmationRequired,
      state: confirmationRequired ? "pending_user_confirmation" : "not_required",
      reasonCodes: [
        ...(detailed.requiresClarification ? ["nl_gateway.clarification_required"] : []),
        ...(riskPreview.approvalNeeded ? ["nl_gateway.approval_required"] : []),
        ...(detailed.blockedByPolicy ? ["nl_gateway.security_review_required"] : []),
      ],
      summary: humanSummary,
    };

    return {
      requestEnvelope: createRequestEnvelope<NlRequestPayload>({
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
          confirmationRequired,
          generatedSummary: humanSummary,
        },
        metadata: {
          source: "nl_entry",
          confirmationRequired,
          divisionId: detailed.suggestedDivisionId,
          workflowId: detailed.suggestedWorkflowId,
          locale: detailed.locale,
        },
      }),
      riskPreview,
      costEstimate,
      confirmationRequired,
      humanSummary,
      taskDraft,
      clarificationState: detailed.clarificationState,
      confirmationReceipt,
      conversationState,
    };
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

  public constructor(nlConfig?: NlGatewayConfig) {
    this.nlConfig = nlConfig ?? loadNlGatewayConfig();
  }

  /**
   * Get or create a conversation context for a user
   */
  public getContext(tenantId: string, userId: string, taskType?: string): ConversationContext {
    const key = `${tenantId}:${userId}`;
    const existing = this.contexts.get(key);

    if (existing) {
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
}
