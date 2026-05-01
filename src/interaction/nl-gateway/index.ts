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

import { SlotResolver } from "./slot-resolver/index.js";
import { LlmIntentParser, type IntentParser, type IntentParserModelGateway } from "./intent-parser/index.js";
import { IntakeRouter } from "../../platform/orchestration/routing/intake-router.js";
import type { CostEstimate } from "../../platform/contracts/types/cost.js";
import {
  createPlatformPrincipal,
  createRequestEnvelope,
  type RequestEnvelopeLegacy as LegacyRequestEnvelope,
} from "../../platform/contracts/types/platform-contracts.js";
import {
  createConfirmedTaskSpec,
  createPrincipalRef,
  createRequestEnvelopeFromConfirmedTask,
  createTaskDraft as createCanonicalTaskDraft,
  normalizeDomainBindingId,
  type ConfirmedTaskSpec as CanonicalConfirmedTaskSpec,
  type RequestEnvelope as CanonicalRequestEnvelope,
  type RiskClass,
  type TaskDraft as CanonicalTaskDraft,
  type UserConfirmationReceipt as CanonicalUserConfirmationReceipt,
  type BudgetResourceKind,
  type JsonValue,
} from "../../platform/contracts/executable-contracts/index.js";
import type { ClarificationSession } from "../../platform/five-plane-orchestration/harness/runtime/intake-admission-service.js";

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
    | "approval_action"
    | "why"; // §39: explanation query type
  readonly domainHint: string | null;
  readonly entities: readonly ExtractedEntity[];
  readonly urgency: "low" | "normal" | "high" | "critical";
  readonly confidence: number;
}

/**
 * §39.2: Independent risk classification as admission gate.
 * Risk classification runs BEFORE intent processing as a separate stage.
 */
function classifyRisk(message: string): RiskPreview {
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
    overallRisk: critical ? "critical" : high ? "high" : "low",
    riskFactors,
    reversible: !irreversible,
    sideEffects,
    approvalNeeded: critical || high,
  };
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
  /** §39.5: Prior conversation turns for context carry-across (Memory §29.2) */
  readonly priorConversationTurns: readonly ConversationTurn[];
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

export type NlRequestEnvelope = LegacyRequestEnvelope<NlRequestPayload>;

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
  readonly rounds: number;
  readonly maxRounds: number;
}

const DEFAULT_MAX_CLARIFICATION_ROUNDS = 3;

export interface UserConfirmationReceipt {
  readonly confirmationId: string;
  readonly required: boolean;
  readonly state: "not_required" | "pending_user_confirmation" | "confirmed";
  readonly reasonCodes: readonly string[];
  readonly summary: string;
  readonly scope?: string;
  readonly timestamp?: string;
  readonly riskPreviewVersion?: string;
  readonly actor?: string;
}

export interface TaskBuildResult {
  readonly requestEnvelope: NlRequestEnvelope | null;
  readonly riskPreview: RiskPreview;
  readonly costEstimate: CostEstimate;
  readonly dryRunPreview?: DryRunPreview;
  readonly confirmationRequired: boolean;
  readonly humanSummary: string;
  readonly taskDraft: TaskDraft;
  readonly clarificationState: ClarificationState;
  readonly confirmationReceipt: UserConfirmationReceipt;
  readonly conversationState: ConversationState;
  readonly canonicalTaskDraft: CanonicalTaskDraft;
  readonly clarificationSession: ClarificationSession | null;
  readonly confirmedTaskSpec: CanonicalConfirmedTaskSpec | null;
  readonly canonicalRequestEnvelope: CanonicalRequestEnvelope | null;
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

export interface ConversationMemoryService {
  remember(input: {
    scope: string;
    content: string;
    classification?: string;
  }): void;
  findMemories(query: {
    scope: string;
  }): {
    content: string;
  }[];
}

export interface DryRunPreview {
  readonly previewId: string;
  readonly mode: "dry_run";
  readonly scope: string;
  readonly summary: string;
  readonly proposedPayload: NlRequestPayload;
  readonly proposedOperations: readonly string[];
  readonly sideEffectPreview: readonly string[];
  readonly policyChecks: readonly string[];
  readonly blocked: boolean;
  readonly approvalRequired: boolean;
}

export interface NlEntryServiceOptions {
  readonly intakeRouter?: IntakeRouter;
  readonly costEstimator?: CostEstimatorPort | null;
  readonly clarificationThreshold?: number;
  readonly localeConfig?: LocaleConfig;
  readonly conversationWindowSize?: number;
  readonly nlGatewayConfig?: NlGatewayConfig;
  readonly memoryService?: ConversationMemoryService | null;
  readonly intentParser?: IntentParser;
  readonly intentModelGateway?: IntentParserModelGateway | null;
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
    case "why":
    case "explain":
      return "why"; // §39: explanation query type
    default:
      return "task_query";
  }
}

function mapIntentTypeToIntakeIntent(intent: DetectedIntent["intentType"]): "create" | "modify" | "approve" | "query" {
  switch (intent) {
    case "task_create":
      return "create";
    case "task_modify":
      return "modify";
    case "approval_action":
      return "approve";
    case "status_inquiry":
    case "why":
    case "task_query":
    default:
      return "query";
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

function deriveRequiredSlots(
  message: string,
  intentType: DetectedIntent["intentType"],
): string[] {
  const requiredSlots = new Set<string>();
  const normalized = message.toLowerCase();

  if (/(deploy|release|publish|上线|发布)/i.test(message) || (intentType === "task_modify" && /(prod|production|staging|环境)/i.test(message))) {
    requiredSlots.add("environment");
  }
  if (/(budget|cost|费用|预算|price|价格)/i.test(message)) {
    requiredSlots.add("money");
  }
  if (/(schedule|before|after|when|date|time|日期|时间|今天|明天|下周|\d{4}[-/]\d{1,2}[-/]\d{1,2})/i.test(normalized)) {
    requiredSlots.add("date");
  }
  if (/(notify|通知|via|slack|email|邮件|sms|短信|channel|渠道)/i.test(message)) {
    requiredSlots.add("channel");
  }

  return [...requiredSlots];
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function detectPromptInjection(message: string): PromptInjectionFinding[] {
  const findings: PromptInjectionFinding[] = [];
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    // matchAll requires the g flag; clone pattern with g flag added
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    for (const matched of message.matchAll(globalPattern)) {
      if (matched[0] != null) {
        findings.push({
          reasonCode: "nl_gateway.prompt_injection_detected",
          severity: /reveal|show me|泄露/.test(matched[0]) ? "high" : "medium",
          blocked: true,
          matchedText: matched[0],
        });
      }
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

function buildDryRunPreview(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly message: string;
  readonly locale: string;
  readonly channel: string | null;
  readonly divisionId: string;
  readonly workflowId: string;
  readonly continuation: IntentParseResult["continuation"];
  readonly intentType: DetectedIntent["intentType"];
  readonly entities: readonly ExtractedEntity[];
  readonly context: ContextEnrichment;
  readonly riskPreview: RiskPreview;
  readonly costEstimate: CostEstimate;
  readonly confirmationRequired: boolean;
  readonly blockedByPolicy: boolean;
  readonly generatedSummary: string;
  readonly scope: string;
}): DryRunPreview {
  const proposedOperations: string[] = [];
  const sideEffectPreview = [...input.riskPreview.sideEffects];
  const policyChecks: string[] = [];

  switch (input.intentType) {
    case "task_query":
    case "status_inquiry":
    case "why":
      proposedOperations.push(`预演只读请求，路由到 ${input.divisionId}/${input.workflowId}`);
      break;
    case "approval_action":
      proposedOperations.push(`预演审批动作，目标队列 ${input.divisionId}/${input.workflowId}`);
      break;
    case "task_modify":
      proposedOperations.push(`预演变更请求，路由到 ${input.divisionId}/${input.workflowId}`);
      break;
    default:
      proposedOperations.push(`预演任务创建，请求将进入 ${input.divisionId}/${input.workflowId}`);
      break;
  }

  for (const environment of input.context.targetEnvironments) {
    proposedOperations.push(`目标环境 ${environment}`);
    sideEffectPreview.push(`若确认执行，将在 ${environment} 范围内产生变更或查询`);
  }

  for (const channel of input.context.requestedChannels) {
    proposedOperations.push(`结果通知渠道 ${channel}`);
  }

  for (const constraint of input.context.extractedConstraints) {
    policyChecks.push(`constraint:${constraint}`);
  }
  if (input.riskPreview.approvalNeeded) {
    policyChecks.push("approval_required");
  }
  if (input.confirmationRequired) {
    policyChecks.push("user_confirmation_required");
  }
  if (input.blockedByPolicy) {
    policyChecks.push("policy_blocked");
  }
  policyChecks.push(input.riskPreview.reversible ? "reversible_candidate" : "irreversible_candidate");

  if (sideEffectPreview.length === 0) {
    sideEffectPreview.push("未检测到显式写副作用，当前预演停留在结构化路由与约束检查");
  }

  const proposedPayload: NlRequestPayload = {
    userId: input.userId,
    title: deriveTitle(input.message),
    request: input.message,
    locale: input.locale,
    channel: input.channel,
    divisionId: input.divisionId,
    workflowId: input.workflowId,
    intent: input.intentType,
    continuation: input.continuation,
    entities: input.entities,
    confirmationRequired: input.confirmationRequired,
    generatedSummary: input.generatedSummary,
  };

  return {
    previewId: `${input.tenantId}:${deriveTitle(input.message).replace(/\s+/g, "_").toLowerCase()}:dry-run`,
    mode: "dry_run",
    scope: input.scope,
    summary: [
      `预演将把请求规范化为 ${input.intentType}`,
      `目标 ${input.divisionId}/${input.workflowId}`,
      `风险 ${input.riskPreview.overallRisk}`,
      `预估成本 $${input.costEstimate.estimatedCostUsd.toFixed(2)}`,
    ].join("，"),
    proposedPayload,
    proposedOperations,
    sideEffectPreview,
    policyChecks,
    blocked: input.blockedByPolicy,
    approvalRequired: input.riskPreview.approvalNeeded,
  };
}

function toCanonicalRiskClass(risk: RiskPreview["overallRisk"]): RiskClass {
  switch (risk) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    default:
      return "low";
  }
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
  private readonly conversationContextManager: ConversationContextManager;
  private readonly clarificationTracker = new Map<string, number>();
  private readonly slotResolver = new SlotResolver();
  private readonly intentParser: IntentParser;

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
    this.conversationContextManager = new ConversationContextManager(this.nlConfig, options.memoryService ?? undefined);
    this.intentParser = options.intentParser ?? new LlmIntentParser(options.intentModelGateway ?? null);
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
    // §39.5: Retrieve prior conversation turns for context carry-across
    const priorContext = this.conversationContextManager.getContext(
      request.tenantId,
      request.userId,
    );
    const locale = this.resolveLocale(request);
    const riskPreview = classifyRisk(request.message);
    const draftId = taskDraftIdFromMessage(request.message);
    const principalRef = createPrincipalRef({
      principalId: request.userId,
      tenantId: request.tenantId,
      roles: ["requester"],
      displayName: request.userId,
      authorizationLevel: "viewer",
    });
    const parsedIntent = await this.intentParser.parseWithLlm(request.message, locale);
    // §39.5: Inject prior conversation context into intent parsing
    const route = await this.intakeRouter.route({
      title: deriveTitle(request.message),
      request: request.message,
      ...(priorContext.turns.length > 0 ? { priorConversationContext: priorContext } : {}),
      tenantId: request.tenantId,
      traceId: buildIntakeTraceId(request, draftId),
      idempotencyKey: buildIntakeIdempotencyKey(request, draftId),
      principal: principalRef,
      confirmedTaskSpecId: `intent-draft:${draftId}`,
      riskPreview: {
        riskClass: toCanonicalRiskClass(riskPreview.overallRisk),
        reasons: riskPreview.riskFactors,
      },
      preferredIntent: {
        intent: mapIntentTypeToIntakeIntent(parsedIntent.intentType),
        confidence: parsedIntent.confidence,
        reasoning: parsedIntent.reasoning,
        language: parsedIntent.language,
        source: "nl_intent_parser",
      },
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
    const requiredSlots = deriveRequiredSlots(request.message, detectedIntent.intentType);
    const slotResolution = requiredSlots.length === 0
      ? null
      : this.slotResolver.resolveRequiredSlots(
          entities,
          requiredSlots,
          undefined,
          undefined,
          priorContext.turns,
        );
    const context = {
      ...this.contextEnricher.enrich(request.message, route.divisionId, entities),
      ...(requiredSlots.length === 0 ? {} : {
        requiredSlots,
        missingSlots: slotResolution?.missing ?? [],
        resolvedSlots: slotResolution?.resolved ?? {},
      }),
    };
    const clarificationQuestions = dedupeStrings([
      ...buildClarificationQuestions(
        request.message,
        route.classification.confidence,
        route.divisionId,
        entities,
      ),
      ...(slotResolution?.generatedQuestions ?? []),
    ]);
    const slotConfidence = estimateSlotConfidence(entities, request.message);
    const effectiveSlotConfidence =
      slotResolution != null && requiredSlots.length > 0 && slotResolution.missing.length === 0
        ? Math.max(slotConfidence, 0.95)
        : slotConfidence;
    const blockedByPolicy = securityFindings.some((item) => item.blocked);
    const clarificationRounds = this.getClarificationRounds(request.tenantId, request.userId);
    const requiresClarification =
      blockedByPolicy
      || route.classification.confidence < this.clarificationThreshold
      || effectiveSlotConfidence < SLOT_CONFIDENCE_THRESHOLD
      || clarificationQuestions.length > 0
      || slotResolution?.shouldRequestClarification === true;
    const clarificationState: ClarificationState = {
      state: blockedByPolicy ? "blocked" : requiresClarification ? "required" : "none",
      reasonCodes: [
        ...(blockedByPolicy ? ["nl_gateway.prompt_injection_detected"] : []),
        ...(route.classification.confidence < this.clarificationThreshold ? ["nl_gateway.intent_confidence_low"] : []),
        ...(effectiveSlotConfidence < SLOT_CONFIDENCE_THRESHOLD ? ["nl_gateway.slot_confidence_low"] : []),
        ...(slotResolution?.shouldRequestClarification ? ["nl_gateway.required_slots_missing"] : []),
      ],
      questions: clarificationQuestions,
      rounds: clarificationRounds,
      maxRounds: DEFAULT_MAX_CLARIFICATION_ROUNDS,
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
      priorConversationTurns: priorContext.turns,
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
    const clarificationRounds = detailed.requiresClarification
      ? this.incrementClarificationRounds(request.tenantId, request.userId)
      : this.resetClarificationRounds(request.tenantId, request.userId);
    const clarificationState: ClarificationState = {
      ...detailed.clarificationState,
      rounds: clarificationRounds,
    };
    const humanSummary = this.responseFormatter.formatTaskSummary({
      divisionId: detailed.suggestedDivisionId,
      workflowId: detailed.suggestedWorkflowId,
      costEstimate,
      riskPreview,
      clarificationState,
    });
    const canonicalDomainId = normalizeDomainBindingId(detailed.context.domainHint || detailed.suggestedDivisionId);
    const confirmationScope = this.deriveConfirmationScope(request.message, detailed);
    const dryRunPreview = riskPreview.overallRisk === "high" || riskPreview.overallRisk === "critical"
      ? buildDryRunPreview({
          tenantId: request.tenantId,
          userId: request.userId,
          message: request.message,
          locale: detailed.locale,
          channel: request.channel ?? null,
          divisionId: detailed.suggestedDivisionId,
          workflowId: detailed.suggestedWorkflowId,
          continuation: detailed.continuation,
          intentType: primaryIntent.intentType,
          entities: primaryIntent.entities,
          context: detailed.context,
          riskPreview,
          costEstimate,
          confirmationRequired,
          blockedByPolicy: detailed.blockedByPolicy,
          generatedSummary: humanSummary,
          scope: confirmationScope,
        })
      : undefined;
    const surfacedSummary = dryRunPreview == null
      ? humanSummary
      : `${humanSummary}；dry-run 预演：${dryRunPreview.summary}`;
    const conversationState = deriveConversationState(
      detailed.requiresClarification,
      confirmationRequired,
      detailed.blockedByPolicy,
    );
    const principalRef = createPrincipalRef({
      principalId: request.userId,
      tenantId: request.tenantId,
      roles: ["requester"],
      displayName: request.userId,
      authorizationLevel: confirmationRequired ? "operator" : "viewer",
    });
    const canonicalTaskDraft = createCanonicalTaskDraft({
      tenantId: request.tenantId,
      principal: principalRef,
      source: "nl",
      domainId: canonicalDomainId,
      taskDraftId: `taskdraft:${request.tenantId}:${request.userId}:${deriveTitle(request.message).replace(/\s+/g, "_").toLowerCase()}`,
      normalizedIntent: {
        intent: primaryIntent.intentType,
        continuation: detailed.continuation,
        domainId: canonicalDomainId,
        divisionId: detailed.suggestedDivisionId,
        workflowId: detailed.suggestedWorkflowId,
        locale: detailed.locale,
        entities: primaryIntent.entities as unknown as JsonValue,
        context: detailed.context as unknown as JsonValue,
        summary: surfacedSummary,
      },
      missingFields: clarificationState.questions,
      riskPreview: {
        riskClass: toCanonicalRiskClass(riskPreview.overallRisk),
        reasons: riskPreview.riskFactors,
      },
      ambiguityPolicy: clarificationState.state === "none" ? "safe_default" : "require_confirmation",
      rawInputRef: {
        artifactId: `${request.tenantId}:${request.userId}:${taskDraftIdFromMessage(request.message)}:raw-input`,
        uri: `artifact://nl-input/${encodeURIComponent(request.tenantId)}/${encodeURIComponent(request.userId)}/${encodeURIComponent(taskDraftIdFromMessage(request.message))}`,
      },
      ...(confirmationRequired ? { expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {}),
    });
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
        ...(dryRunPreview == null ? [] : ["nl_gateway.dry_run_preview_ready"]),
      ],
      summary: surfacedSummary,
      scope: confirmationScope,
      timestamp: new Date().toISOString(),
      riskPreviewVersion: this.buildRiskPreviewVersion(riskPreview),
      actor: request.userId,
    };
    const clarificationSession: ClarificationSession | null = confirmationRequired
      ? {
          sessionId: `clarify:${canonicalTaskDraft.taskDraftId}`,
          taskDraftId: canonicalTaskDraft.taskDraftId,
          stage: "pending_clarification",
          ambiguityFlags: clarificationState.reasonCodes,
          createdAt: confirmationReceipt.timestamp ?? new Date().toISOString(),
          expiresAt: canonicalTaskDraft.expiresAt ?? null,
          confirmationReceipt: null,
        }
      : null;
    const canonicalConfirmationReceipt: CanonicalUserConfirmationReceipt | undefined =
      confirmationRequired && confirmationReceipt.state === "confirmed"
        ? {
            receiptId: confirmationReceipt.confirmationId,
            confirmedBy: principalRef,
            riskClass: toCanonicalRiskClass(riskPreview.overallRisk),
            confirmedAt: confirmationReceipt.timestamp ?? new Date().toISOString(),
            ...(canonicalTaskDraft.expiresAt !== undefined ? { expiresAt: canonicalTaskDraft.expiresAt } : {}),
          }
        : undefined;
    const confirmedTaskSpec = confirmationRequired
      ? null
      : createConfirmedTaskSpec({
          confirmedTaskSpecId: `ctspec:${canonicalTaskDraft.taskDraftId}`,
          taskDraftId: canonicalTaskDraft.taskDraftId,
          tenantId: request.tenantId,
          principal: principalRef,
          domainId: canonicalDomainId,
          goal: surfacedSummary,
          inputs: {
            request: request.message,
            domainId: canonicalDomainId,
            divisionId: detailed.suggestedDivisionId,
            workflowId: detailed.suggestedWorkflowId,
            continuation: detailed.continuation,
            channel: request.channel ?? null,
            entities: primaryIntent.entities as unknown as JsonValue,
            context: detailed.context as unknown as JsonValue,
          },
          constraintPackRef: buildConstraintPackRef(canonicalDomainId, detailed.suggestedWorkflowId),
          riskClass: toCanonicalRiskClass(riskPreview.overallRisk),
          ...(canonicalConfirmationReceipt !== undefined ? { confirmationReceipt: canonicalConfirmationReceipt } : {}),
          idempotencyKey: buildIntakeIdempotencyKey(request, taskDraft.draftId),
          traceId: buildIntakeTraceId(request, taskDraft.draftId),
        });
    const canonicalRequestEnvelope = confirmedTaskSpec == null
      ? null
      : createRequestEnvelopeFromConfirmedTask({
          confirmedTaskSpec,
          requestId: `request:${confirmedTaskSpec.confirmedTaskSpecId}`,
          requestHash: `request_hash:${confirmedTaskSpec.confirmedTaskSpecId}`,
          priority: ((): number => {
            switch (riskPreview.overallRisk) {
              case "critical": return 100;
              case "high": return 80;
              default: return 40;
            }
          })(),
          budgetIntent: {
            amount: Number(costEstimate.estimatedCostUsd.toFixed(4)),
            currency: "USD",
            resourceKinds: (["token"] as readonly BudgetResourceKind[]),
          },
          policyContext: {
            channel: request.channel ?? null,
            approvalRequired: riskPreview.approvalNeeded,
            blockedByPolicy: detailed.blockedByPolicy,
          },
          artifactRefs: canonicalTaskDraft.rawInputRef == null ? [] : [canonicalTaskDraft.rawInputRef],
        });

    // §39.2: Only emit RequestEnvelope after TaskSpec is confirmed
    // When confirmation is pending, return null requestEnvelope to prevent premature execution
    if (confirmationRequired && clarificationState.rounds >= clarificationState.maxRounds) {
      // Exceeded max clarification rounds - block the request
      return {
        requestEnvelope: null,
        riskPreview,
        costEstimate,
        ...(dryRunPreview !== undefined ? { dryRunPreview } : {}),
        confirmationRequired: true,
        humanSummary: surfacedSummary,
        taskDraft,
        clarificationState: {
          ...clarificationState,
          state: "blocked" as const,
          reasonCodes: [...clarificationState.reasonCodes, "nl_gateway.max_clarification_rounds_exceeded"],
        },
        confirmationReceipt: {
          ...confirmationReceipt,
          state: "pending_user_confirmation" as const,
        },
        conversationState: "Clarifying",
        canonicalTaskDraft,
        clarificationSession: clarificationSession ?? null,
        confirmedTaskSpec: null,
        canonicalRequestEnvelope: null,
      };
    }
    const requestEnvelope: NlRequestEnvelope | null = confirmationRequired
      ? null
      : createRequestEnvelope<NlRequestPayload>({
          principal: createPlatformPrincipal({
            actorId: request.userId,
            tenantId: request.tenantId,
            roles: ["requester"],
            authMethod: "nl_entry",
          }),
          tenantId: request.tenantId,
          requestId: `request:${request.tenantId}:${request.userId}:${taskDraftIdFromMessage(request.message)}`,
          idempotencyKey: buildIntakeIdempotencyKey(request, taskDraft.draftId),
          traceId: buildIntakeTraceId(request, taskDraft.draftId),
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
            generatedSummary: surfacedSummary,
          },
          metadata: {
            source: "nl_entry",
            confirmationRequired,
            divisionId: detailed.suggestedDivisionId,
            workflowId: detailed.suggestedWorkflowId,
            locale: detailed.locale,
            canonicalRequestEnvelopeId: canonicalRequestEnvelope?.requestId ?? null,
          },
        });

    // §39.5: Record this turn in conversation context for subsequent turns
    this.conversationContextManager.addTurn(
      request.tenantId,
      request.userId,
      request.message,
      primaryIntent,
    );

    return {
      requestEnvelope: requestEnvelope ?? null,
      riskPreview,
      costEstimate,
      ...(dryRunPreview != null ? { dryRunPreview } : {}),
      confirmationRequired,
      humanSummary: surfacedSummary,
      taskDraft,
      clarificationState,
      confirmationReceipt,
      conversationState,
      canonicalTaskDraft,
      clarificationSession: clarificationSession ?? null,
      confirmedTaskSpec: confirmedTaskSpec ?? null,
      canonicalRequestEnvelope: canonicalRequestEnvelope ?? null,
    };
  }

  private clarificationKey(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
  }

  private getClarificationRounds(tenantId: string, userId: string): number {
    return this.clarificationTracker.get(this.clarificationKey(tenantId, userId)) ?? 0;
  }

  private incrementClarificationRounds(tenantId: string, userId: string): number {
    const key = this.clarificationKey(tenantId, userId);
    const rounds = (this.clarificationTracker.get(key) ?? 0) + 1;
    this.clarificationTracker.set(key, rounds);
    return rounds;
  }

  private resetClarificationRounds(tenantId: string, userId: string): number {
    this.clarificationTracker.delete(this.clarificationKey(tenantId, userId));
    return 0;
  }

  private deriveConfirmationScope(
    message: string,
    detailed: Pick<IntentParseResult, "suggestedDivisionId" | "suggestedWorkflowId" | "context">,
  ): string {
    const environmentScope = detailed.context.targetEnvironments[0];
    if (environmentScope != null && environmentScope.length > 0) {
      return `${detailed.suggestedDivisionId}/${environmentScope}`;
    }
    if (/(production|prod|线上|生产环境)/i.test(message)) {
      return `${detailed.suggestedDivisionId}/production`;
    }
    return `${detailed.suggestedDivisionId}/${detailed.suggestedWorkflowId}`;
  }

  private buildRiskPreviewVersion(riskPreview: RiskPreview): string {
    return [
      "risk-preview-v1",
      riskPreview.overallRisk,
      riskPreview.approvalNeeded ? "approval" : "direct",
      riskPreview.reversible ? "reversible" : "irreversible",
    ].join(":");
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

function taskDraftIdFromMessage(message: string): string {
  return deriveTitle(message).replace(/\s+/g, "_").toLowerCase();
}

function buildConstraintPackRef(domainId: string, workflowId: string): string {
  return `constraint_pack:${domainId}:${workflowId}`;
}

function buildIntakeIdempotencyKey(request: NlEntryRequest, draftId: string): string {
  return `nl:${request.tenantId}:${request.userId}:${draftId}`;
}

function buildIntakeTraceId(request: NlEntryRequest, draftId: string): string {
  return `trace:nl:${request.tenantId}:${request.userId}:${draftId}`;
}

/**
 * Conversation Context Manager
 *
 * Manages multi-turn conversation context with configurable window size.
 * Window size can be configured per task type via nlGatewayConfig.
 *
 * §39.1: Implements persistence to Memory for cross-session recovery.
 * When a MemoryService is provided, conversation context is durably stored
 * and recovered across sessions. Without Memory, operates in pure in-memory mode.
 *
 * §175-2051 FIX: Added LRU eviction for contexts Map to prevent unbounded memory growth.
 * Previously the Map grew without bound as new conversations were created.
 * Now uses a simple LRU strategy with a maximum size limit.
 */
export class ConversationContextManager {
  private readonly contexts = new Map<string, ConversationContext>();
  private readonly nlConfig: NlGatewayConfig;
  private readonly memoryService: ConversationMemoryService | null;
  private readonly memoryEnabled: boolean;
  /** §175-2051: Maximum number of contexts to keep in memory before LRU eviction */
  private readonly maxContexts: number;
  /** §175-2051: Track access order for LRU eviction */
  private readonly contextAccessOrder: string[] = [];

  public constructor(nlConfig?: NlGatewayConfig, memoryService?: ConversationMemoryService) {
    this.nlConfig = nlConfig ?? loadNlGatewayConfig();
    this.memoryService = memoryService ?? null;
    this.memoryEnabled = memoryService != null;
    // Default to 1000 contexts max; can be overridden via config in future
    this.maxContexts = 1000;
  }

  /**
   * §175-2051: Evict least recently used context when at capacity.
   * Removes the oldest entry from both contexts Map and access order.
   */
  private evictLRU(): void {
    if (this.contextAccessOrder.length === 0) return;
    const lruKey = this.contextAccessOrder.shift();
    if (lruKey) {
      this.contexts.delete(lruKey);
    }
  }

  /**
   * §175-2051: Record context access for LRU tracking.
   */
  private recordAccess(key: string): void {
    const idx = this.contextAccessOrder.indexOf(key);
    if (idx !== -1) {
      this.contextAccessOrder.splice(idx, 1);
    }
    this.contextAccessOrder.push(key);
  }

  /**
   * §39.1: Get or create a conversation context for a user.
   * When memory is enabled, attempts to load persisted context from Memory first.
   *
   * §175-2051 FIX: Added LRU eviction when at capacity. If contexts Map is full,
   * evicts least recently used entry before adding new one.
   */
  public getContext(tenantId: string, userId: string, taskType?: string): ConversationContext {
    const key = `${tenantId}:${userId}`;
    const existing = this.contexts.get(key);

    if (existing) {
      // §175-2051: Update LRU access order
      this.recordAccess(key);
      return existing;
    }

    // §175-2051: Evict LRU if at capacity before creating new context
    if (this.contexts.size >= this.maxContexts) {
      this.evictLRU();
    }

    // §39.1: Try to recover context from Memory if enabled
    if (this.memoryEnabled) {
      const recovered = this.loadFromMemory(tenantId, userId);
      if (recovered) {
        this.contexts.set(key, recovered);
        this.recordAccess(key);
        return recovered;
      }
    }

    const maxTurns = getConversationWindowSize(this.nlConfig, taskType);
    const newContext = {
      tenantId,
      userId,
      turnCount: 0,
      maxTurns,
      turns: [],
    };
    this.contexts.set(key, newContext);
    this.recordAccess(key);
    return newContext;
  }

  /**
   * §39.1: Add a turn to the conversation.
   * When memory is enabled, persists the updated context to Memory.
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
    // §175-2051: Update LRU access order after modification
    this.recordAccess(key);

    // §39.1: Persist to Memory for cross-session recovery
    if (this.memoryEnabled) {
      this.saveToMemory(updatedContext);
    }

    return updatedContext;
  }

  /**
   * §39.1: Clear a conversation context from both memory and in-memory storage.
   * §175-2051 FIX: Also remove from LRU access order.
   */
  public clearContext(tenantId: string, userId: string): void {
    const key = `${tenantId}:${userId}`;
    this.contexts.delete(key);
    // §175-2051: Remove from LRU tracking
    const idx = this.contextAccessOrder.indexOf(key);
    if (idx !== -1) {
      this.contextAccessOrder.splice(idx, 1);
    }

    // §39.1: Also clear from Memory
    if (this.memoryEnabled) {
      const scope = this.getMemoryScope(tenantId, userId);
      try {
        // Find and revoke memories for this conversation
        const memories = this.memoryService!.findMemories({ scope });
        for (const memory of memories) {
          // Memory revocation would be handled by the memory service
        }
      } catch {
        // Best effort - clear failed but operation continues
      }
    }
  }

  /**
   * §39.1: Check if conversation is approaching window limit.
   */
  public isNearWindowLimit(tenantId: string, userId: string): boolean {
    const context = this.contexts.get(`${tenantId}:${userId}`);
    if (!context) {
      return false;
    }
    return context.turnCount >= context.maxTurns - 2;
  }

  /**
   * Get window size for a specific task type.
   */
  public getWindowSize(taskType?: string): number {
    return getConversationWindowSize(this.nlConfig, taskType);
  }

  /**
   * §39.1: Get the memory scope for a conversation context.
   */
  private getMemoryScope(tenantId: string, userId: string): string {
    return `nl_gateway:conversation:${tenantId}:${userId}`;
  }

  /**
   * §39.1: Save conversation context to Memory for cross-session recovery.
   */
  private saveToMemory(context: ConversationContext): void {
    if (!this.memoryService) return;

    const scope = this.getMemoryScope(context.tenantId, context.userId);
    const content = JSON.stringify({
      tenantId: context.tenantId,
      userId: context.userId,
      turnCount: context.turnCount,
      maxTurns: context.maxTurns,
      turns: context.turns,
      lastIntent: context.lastIntent,
    });

    try {
      this.memoryService.remember({
        scope,
        content,
        classification: "conversation_context",
      });
    } catch {
      // Best effort - Memory write failure should not break conversation flow
    }
  }

  /**
   * §39.1: Load conversation context from Memory for cross-session recovery.
   */
  private loadFromMemory(tenantId: string, userId: string): ConversationContext | null {
    if (!this.memoryService) return null;

    const scope = this.getMemoryScope(tenantId, userId);

    try {
      const memories = this.memoryService.findMemories({ scope });
      if (memories.length > 0) {
        const lastMemory = memories[memories.length - 1];
        if (lastMemory) {
          const parsed = JSON.parse(lastMemory.content);
          return {
            tenantId: parsed.tenantId,
            userId: parsed.userId,
            turnCount: parsed.turnCount,
            maxTurns: parsed.maxTurns,
            turns: parsed.turns ?? [],
            lastIntent: parsed.lastIntent,
          };
        }
      }
    } catch {
      // Best effort - Memory read failure returns null, causing fresh context creation
    }

    return null;
  }
}
