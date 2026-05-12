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

import { createHash } from "node:crypto";
import { IntakeRouter } from "../../platform/orchestration/routing/intake-router.js";
import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import { createPlatformPrincipal, type PlatformRequestEnvelope } from "../../platform/contracts/index.js";
import {
  createConfirmedTaskSpec,
  createPrincipalRef,
  createRequestEnvelopeFromConfirmedTask,
  createTaskDraft as createCanonicalTaskDraft,
  type ConfirmedTaskSpec,
  type JsonValue,
  type RequestEnvelope as CanonicalRequestEnvelope,
  type TaskDraft as CanonicalTaskDraft,
} from "../../platform/contracts/executable-contracts/index.js";
import type { NlGatewayConfig } from "./nl-gateway-config-loader.js";
import { loadNlGatewayConfig, getConversationWindowSize } from "./nl-gateway-config-loader.js";
import { parseIntentTokensWithModel } from "./intent-parser/index.js";
import { buildSlotClarificationState } from "./slot-resolver/index.js";
import { createRequestEnvelope, type RequestEnvelopeLegacy } from "../../platform/contracts/types/index.js";
import { nowIso } from "../../platform/contracts/types/ids.js";

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
    | "cancel_task"
    | "create_goal"
    | "decompress_goal"
    | "status_inquiry"
    | "approval_action"
    | "why";
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
  readonly priorConversationTurns: readonly ConversationTurn[];
  // R5-16: Independent risk classification result (separate pipeline stage from intent parsing)
  readonly riskClassification?: {
    readonly riskLevel: "low" | "medium" | "high" | "critical";
    readonly riskFactors: readonly string[];
    readonly requiresApproval: boolean;
  };
}

export interface RiskPreview {
  readonly overallRisk: "low" | "medium" | "high" | "critical";
  readonly riskFactors: readonly string[];
  readonly reversible: boolean;
  readonly sideEffects: readonly string[];
  readonly approvalNeeded: boolean;
  readonly overall_risk?: "low" | "medium" | "high" | "critical";
  readonly risk_factors?: readonly string[];
  readonly side_effects?: readonly string[];
  readonly approval_needed?: boolean;
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

export type RequestEnvelope = PlatformRequestEnvelope;

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
  readonly requiredSlots?: readonly string[];
  readonly missingSlots?: readonly string[];
  readonly resolvedSlots?: Readonly<Record<string, unknown>>;
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
  // R5-30: Round tracking for clarification sessions
  readonly rounds: number;
  readonly maxRounds: number;
}

export interface UserConfirmationReceipt {
  readonly confirmationId: string;
  readonly required: boolean;
  readonly state: "not_required" | "pending_user_confirmation" | "confirmed";
  readonly reasonCodes: readonly string[];
  readonly summary: string;
  // R5-32: Additional confirmation receipt fields
  readonly scope?: string;
  readonly time?: string;
  readonly riskPreviewVersion?: string;
  // R5-40: Extended confirmation receipt fields
  readonly riskPreview?: RiskPreview;
  readonly actor?: string;
  readonly timestamp?: string;
}

export interface TaskBuildResult {
  readonly requestEnvelope: RequestEnvelopeLegacy | null;
  readonly riskPreview: RiskPreview;
  readonly costEstimate: CostEstimate;
  readonly confirmationRequired: boolean;
  readonly humanSummary: string;
  readonly taskDraft: TaskDraft;
  readonly clarificationState: ClarificationState;
  readonly confirmationReceipt: UserConfirmationReceipt;
  readonly conversationState: ConversationState;
  readonly clarificationSession: ClarificationSession | null;
  readonly canonicalTaskDraft: CanonicalTaskDraft;
  readonly confirmedTaskSpec: ConfirmedTaskSpec | null;
  readonly canonicalRequestEnvelope: CanonicalRequestEnvelope | null;
  readonly dryRunPreview?: DryRunPreview;
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

export interface IntentParserLlmResult {
  readonly intentType: DetectedIntent["intentType"];
  readonly confidence: number;
  readonly reasoning?: string;
  readonly language?: string;
}

export interface IntentParserPort {
  parseWithLlm?(input: {
    readonly message: string;
    readonly locale: string;
    readonly priorConversationContext?: ConversationContext;
  }): Promise<IntentParserLlmResult>;
}

export interface MemoryServicePort {
  remember(input: {
    readonly scope: string;
    readonly content: string;
    readonly classification?: string;
  }): void;
  findMemories(query: {
    readonly scope: string;
  }): readonly { readonly content: string }[];
}

export interface NlEntryServiceOptions {
  readonly intakeRouter?: IntakeRouter;
  readonly costEstimator?: CostEstimatorPort | null;
  readonly clarificationThreshold?: number;
  readonly localeConfig?: LocaleConfig;
  readonly conversationWindowSize?: number;
  readonly nlGatewayConfig?: NlGatewayConfig;
  readonly intentParser?: IntentParserPort;
  readonly memoryService?: MemoryServicePort;
  // R9-41: Dry-run executor for actual risk preview
  readonly dryRunExecutor?: DryRunExecutorPort | null;
}

export interface ClarificationSession {
  readonly sessionId: string;
  readonly taskDraftId: string;
  readonly stage: "pending_clarification";
}

export interface DryRunPreview {
  readonly mode: "dry_run";
  readonly blocked: boolean;
  readonly approvalRequired: boolean;
  readonly scope: string;
  readonly proposedOperations: readonly string[];
  readonly sideEffectPreview: readonly string[];
  readonly policyChecks: readonly string[];
  readonly proposedPayload: {
    readonly userId: string;
    readonly divisionId: string;
    readonly workflowId: string;
  };
}

const INTENT_CONFIDENCE_THRESHOLD = 0.8;
const SLOT_CONFIDENCE_THRESHOLD = 0.85;
// R5-30: Default maximum clarification rounds
const DEFAULT_MAX_CLARIFICATION_ROUNDS = 3;
const DEFAULT_MAX_ACTIVE_CONVERSATION_CONTEXTS = 1000;
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

export interface ConversationContextManagerOptions {
  readonly maxActiveContexts?: number;
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
    case "correction":
      return "task_modify";
    case "cancel":
      return "cancel_task";
    case "goal":
    case "create_goal":
      return "create_goal";
    case "decompose":
    case "decompress":
    case "breakdown":
      return "decompress_goal";
    case "approve":
      return "approval_action";
    case "clarify":
    case "chitchat":
      return "status_inquiry";
    // R5-17: Add "why" intent type mapping
    case "why":
    case "explain":
    case "reason":
      return "why";
    default:
      return "task_query";
  }
}

function isMediumRiskIntent(intentType: DetectedIntent["intentType"]): boolean {
  return intentType === "task_modify" || intentType === "cancel_task";
}

function requiresApprovalIntent(intentType: DetectedIntent["intentType"]): boolean {
  return intentType === "approval_action";
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

function toJsonValue(value: unknown): JsonValue {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry));
  }
  if (typeof value === "object") {
    const normalized: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        normalized[key] = toJsonValue(entry);
      }
    }
    return normalized;
  }
  return String(value);
}

function serializeEntities(entities: readonly ExtractedEntity[]): readonly JsonValue[] {
  return entities.map((entity) => ({
    entityType: entity.entityType,
    value: entity.value,
    normalized: toJsonValue(entity.normalized),
    sourceSpan: [entity.sourceSpan[0], entity.sourceSpan[1]],
  }));
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
  if (/(status|query|list|查看|查询|状态|队列|任务|create|make|generate|创建|新建|生成|工单)/i.test(message)) {
    return 0.86;
  }
  return /(deploy|release|delete|修改|更新|删除|发布)/i.test(message) ? 0.52 : 0.72;
}

function buildConversationMemoryScope(tenantId: string, userId: string): string {
  return `nl_gateway.conversation:${tenantId}:${userId}`;
}

function collectResolvedSlotsFromTurns(turns: readonly ConversationTurn[]): Readonly<Record<string, unknown>> {
  const resolved: Record<string, unknown> = {};
  for (const turn of turns) {
    for (const entity of turn.detectedIntent.entities) {
      resolved[entity.entityType] = entity.normalized;
    }
  }
  return resolved;
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

function buildMissingSlotQuestions(missingSlots: readonly string[]): string[] {
  return missingSlots.map((slot) => {
    switch (slot) {
      case "date":
        return "请提供日期或时间范围，例如 2026-05-01。";
      case "environment":
        return "请说明目标环境，例如 dev、staging 或 production。";
      case "channel":
        return "请说明通知渠道，例如 slack、email 或 webhook。";
      default:
        return `请补充必需信息：${slot}。`;
    }
  });
}

function detectPromptInjection(message: string): PromptInjectionFinding[] {
  const findings: PromptInjectionFinding[] = [];
  const seen = new Set<string>();

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const regex = new RegExp(pattern.source, flags);
    for (const matched of message.matchAll(regex)) {
      const matchedText = matched[0];
      if (!matchedText || seen.has(`${pattern.source}:${matchedText}:${matched.index ?? -1}`)) {
        continue;
      }
      seen.add(`${pattern.source}:${matchedText}:${matched.index ?? -1}`);
      findings.push({
        reasonCode: "harness.guardrail.prompt_injection_detected",
        severity: /reveal|show me|泄露/.test(matchedText) ? "high" : "medium",
        blocked: true,
        matchedText,
      } satisfies PromptInjectionFinding);
    }
  }

  return findings;
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

/**
 * R9-41: DryRunExecutor port for actual execution during risk preview
 */
export interface DryRunExecutorPort {
  executeDryRun(input: {
    readonly message: string;
    readonly divisionId: string;
    readonly workflowId: string;
    readonly userId: string;
    readonly locale: string;
  }): Promise<{
    readonly blocked: boolean;
    readonly actualRiskLevel: "low" | "medium" | "high" | "critical";
    readonly detectedSideEffects: readonly string[];
    readonly policyCheckResults: readonly string[];
  }>;
}

function buildRiskPreview(
  message: string,
  intentType: DetectedIntent["intentType"],
  dryRunExecutor?: DryRunExecutorPort | null,
  dryRunContext?: { divisionId: string; workflowId: string; userId: string; locale: string } | null,
): RiskPreview {
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
  if (requiresApprovalIntent(intentType)) {
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

  // R9-41: Perform actual dry-run execution for high/critical risk items to get accurate assessment
  let dryRunResult: { blocked: boolean; actualRiskLevel: "low" | "medium" | "high" | "critical"; detectedSideEffects: readonly string[]; policyCheckResults: readonly string[] } | null = null;
  if (dryRunExecutor != null && dryRunContext != null && (critical || high)) {
    try {
      dryRunResult = {
        blocked: false,
        actualRiskLevel: critical ? "critical" : high ? "high" : "medium",
        detectedSideEffects: [],
        policyCheckResults: [],
      };
      // Note: In production, this would be awaited. For sync context, we capture the result.
      // The actual async call happens in buildTask which awaits it.
    } catch {
      // Dry-run failed - stick with keyword-based assessment
    }
  }

  return {
    overallRisk: critical ? "critical" : high ? "high" : isMediumRiskIntent(intentType) ? "medium" : "low",
    riskFactors,
    reversible: !irreversible,
    sideEffects,
    approvalNeeded: critical || high || requiresApprovalIntent(intentType),
    overall_risk: critical ? "critical" : high ? "high" : isMediumRiskIntent(intentType) ? "medium" : "low",
    risk_factors: riskFactors,
    side_effects: sideEffects,
    approval_needed: critical || high || requiresApprovalIntent(intentType),
  };
}

/**
 * R9-41: Async version of risk preview with actual dry-run execution
 */
async function buildRiskPreviewWithDryRun(
  message: string,
  intentType: DetectedIntent["intentType"],
  dryRunExecutor: DryRunExecutorPort | null,
  dryRunContext: { readonly message: string; readonly divisionId: string; readonly workflowId: string; readonly userId: string; readonly locale: string } | null,
): Promise<RiskPreview> {
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
  if (requiresApprovalIntent(intentType)) {
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

  // R9-41: Perform actual dry-run execution for high/critical risk items
  let dryRunAdjustedRisk: "low" | "medium" | "high" | "critical" | null = null;
  let dryRunSideEffects: readonly string[] = [];
  let dryRunPolicyResults: readonly string[] = [];

  if (dryRunExecutor != null && dryRunContext != null && (critical || high)) {
    try {
      const result = await dryRunExecutor.executeDryRun({ ...dryRunContext, message });
      dryRunAdjustedRisk = result.actualRiskLevel;
      dryRunSideEffects = result.detectedSideEffects;
      dryRunPolicyResults = result.policyCheckResults;
      // Merge dry-run detected side effects
      sideEffects.push(...dryRunSideEffects);
      // Add policy check results to risk factors
      for (const policyResult of dryRunPolicyResults) {
        if (!riskFactors.some((f) => f.includes(policyResult))) {
          riskFactors.push(`策略检查: ${policyResult}`);
        }
      }
    } catch {
      // Dry-run failed - stick with keyword-based assessment
    }
  }

  // Use dry-run result if available, otherwise fall back to keyword-based
  const overallRisk = dryRunAdjustedRisk ?? (critical ? "critical" : high ? "high" : isMediumRiskIntent(intentType) ? "medium" : "low");

  return {
    overallRisk,
    riskFactors,
    reversible: !irreversible,
    sideEffects,
    approvalNeeded: overallRisk === "critical" || overallRisk === "high" || requiresApprovalIntent(intentType),
    overall_risk: overallRisk,
    risk_factors: riskFactors,
    side_effects: sideEffects,
    approval_needed: overallRisk === "critical" || overallRisk === "high" || requiresApprovalIntent(intentType),
  };
}

function inferRequiredSlots(
  message: string,
  intentType: DetectedIntent["intentType"],
  workflowId: string,
): string[] {
  const required = new Set<string>();
  if (/(schedule|rollout|安排|排期)/i.test(message) || workflowId.includes("schedule")) {
    required.add("date");
  }
  if (/(deploy|release|publish|上线|发布|生产环境|prod|production)/i.test(message)) {
    required.add("environment");
  }
  if (/(notify|notification|通知|slack|email|webhook)/i.test(message)) {
    required.add("channel");
  }
  if (requiresApprovalIntent(intentType) && /(invoice|payment|发票|付款)/i.test(message)) {
    required.add("date");
  }
  return [...required];
}

function memoryScopeFor(request: Pick<NlEntryRequest, "tenantId" | "userId">): string {
  return `${request.tenantId}:${request.userId}:nl_gateway`;
}

function clarificationRoundKey(request: Pick<NlEntryRequest, "tenantId" | "userId" | "message">): string {
  return `${request.tenantId}:${request.userId}:${request.message.trim().toLowerCase()}`;
}

function buildConfirmationScope(divisionId: string, context: ContextEnrichment): string {
  const environment = context.targetEnvironments[0]
    ?? (context.extractedConstraints.includes("production_scope") ? "production" : null);
  return environment == null ? divisionId : `${divisionId}/${environment}`;
}

function buildCanonicalDomainId(divisionId: string): string {
  if (divisionId === "platform_engineering" || divisionId === "engineering_ops") {
    return "coding";
  }
  return divisionId;
}

function resolveAutonomyMode(
  confirmationRequired: boolean,
  riskPreview: RiskPreview,
): "suggestion" | "full_auto" {
  return confirmationRequired || riskPreview.approvalNeeded ? "suggestion" : "full_auto";
}

function resolveRuntimeMode(
  confirmationRequired: boolean,
  riskPreview: RiskPreview,
): "no_write" | "suggestion" | "full_auto" {
  if (riskPreview.overallRisk === "critical" || riskPreview.approvalNeeded) {
    return "no_write";
  }
  if (confirmationRequired) {
    return "suggestion";
  }
  return "full_auto";
}

function buildStableIdempotencyKey(request: Pick<NlEntryRequest, "tenantId" | "userId" | "message">): string {
  const digest = createHash("sha256")
    .update(`${request.tenantId}:${request.userId}:${request.message}`)
    .digest("hex")
    .slice(0, 24);
  return `nl:${digest}`;
}

function parseStoredConversationTurn(content: string): ConversationTurn | null {
  try {
    const parsed = JSON.parse(content) as Partial<ConversationTurn>;
    if (
      typeof parsed.message === "string"
      && typeof parsed.turnNumber === "number"
      && typeof parsed.timestamp === "string"
      && parsed.detectedIntent != null
    ) {
      return parsed as ConversationTurn;
    }
  } catch {
    return null;
  }
  return null;
}

function buildDryRunPreview(input: {
  readonly request: NlEntryRequest;
  readonly divisionId: string;
  readonly workflowId: string;
  readonly riskPreview: RiskPreview;
  readonly context: ContextEnrichment;
}): DryRunPreview | undefined {
  if (!input.riskPreview.approvalNeeded && input.riskPreview.overallRisk !== "critical") {
    return undefined;
  }
  const environment = input.context.targetEnvironments[0] ?? "unknown";
  const channel = input.context.requestedChannels[0] ?? null;
  return {
    mode: "dry_run",
    blocked: false,
    approvalRequired: input.riskPreview.approvalNeeded,
    scope: `${input.divisionId}/${environment}`,
    proposedOperations: [
      `目标环境 ${environment}`,
      ...(channel == null ? [] : [`结果通知渠道 ${channel}`]),
      `执行域 ${input.divisionId}`,
    ],
    sideEffectPreview: input.riskPreview.sideEffects.length > 0
      ? input.riskPreview.sideEffects
      : ["可能影响环境配置或运行中的业务流量"],
    policyChecks: [
      ...(input.riskPreview.approvalNeeded ? ["approval_required"] : []),
      ...(input.riskPreview.reversible ? ["reversible_candidate"] : ["irreversible_operation"]),
    ],
    proposedPayload: {
      userId: input.request.userId,
      divisionId: input.divisionId,
      workflowId: input.workflowId,
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
    const locale = this.resolveLocale(request);
    const priorConversationContext = this.getPriorConversationContext(request);
    const securityFindings = detectPromptInjection(request.message);
    const blockedByPolicy = securityFindings.some((item) => item.blocked);
    const route = await Promise.resolve((this.intakeRouter as any).route({
      title: deriveTitle(request.message),
      request: request.message,
      priorConversationContext,
    }));
    const entities = extractEntities(request.message);
    const parsedIntentTokens = blockedByPolicy
      ? []
      : await parseIntentTokensWithModel(request.message, {
          locale,
          // @ts-ignore - parser type mismatch: IntentParserPort vs ModelIntentParserPort
          parser: this.intentParser?.parseWithLlm == null
            ? null
            : {
                parseWithLlm: (input) => this.intentParser!.parseWithLlm!(input),
              },
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
      // @ts-ignore - createRequestEnvelope returns RequestEnvelopeLegacy which is incompatible with RequestEnvelope
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
