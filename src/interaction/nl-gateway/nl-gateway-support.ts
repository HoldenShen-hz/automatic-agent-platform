import { createHash } from "node:crypto";
import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import {
  INTAKE_INTENT_CONFIDENCE_THRESHOLD,
  INTAKE_SLOT_CONFIDENCE_THRESHOLD,
} from "../../platform/contracts/constants/index.js";
import type { JsonValue } from "../../platform/contracts/executable-contracts/index.js";
import type {
  ClarificationState,
  ContextEnrichment,
  ConversationState,
  ConversationTurn,
  DetectedIntent,
  DryRunExecutorPort,
  DryRunPreview,
  ExtractedEntity,
  LocaleConfig,
  NlEntryRequest,
  PromptInjectionFinding,
  RiskPreview,
} from "./nl-gateway-model.js";

export const INTENT_CONFIDENCE_THRESHOLD = INTAKE_INTENT_CONFIDENCE_THRESHOLD;
export const SLOT_CONFIDENCE_THRESHOLD = INTAKE_SLOT_CONFIDENCE_THRESHOLD;
// R5-30: Default maximum clarification rounds
export const DEFAULT_MAX_CLARIFICATION_ROUNDS = 3;
export const DEFAULT_MAX_ACTIVE_CONVERSATION_CONTEXTS = 1000;
const DEFAULT_PROMPT_INJECTION_PATTERNS = [
  /ignore (?:(?:all|any)\s+)?(?:(?:previous|prior)\s+)?instructions/i,
  /reveal (the )?(system|developer) prompt/i,
  /show me (the )?(hidden|internal) instructions/i,
  /bypass (the )?(guardrails|safety|policy)/i,
  /忽略(所有|之前|上面)指令/,
  /泄露(系统|开发者)?提示词/,
  /绕过(安全|策略|护栏)/,
] as const;
export const PROMPT_INJECTION_PATTERNS = [...DEFAULT_PROMPT_INJECTION_PATTERNS];

export const DEFAULT_LOCALE_CONFIG: LocaleConfig = {
  supportedLocales: ["zh-CN", "en-US", "ja-JP", "de-DE"],
  defaultLocale: "zh-CN",
  localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
};

const DEFAULT_GENERIC_AMBIGUOUS_PATTERNS = [
  /^\s*做一份报表[。.!?？]?\s*$/iu,
  /^\s*处理一下[。.!?？]?\s*$/iu,
  /^\s*看一下[。.!?？]?\s*$/iu,
  /^\s*帮我处理[。.!?？]?\s*$/iu,
  /^\s*帮我做[。.!?？]?\s*$/iu,
  /^\s*做一个[。.!?？]?\s*$/iu,
  /^\s*optimize this[.?!]?\s*$/iu,
  /^\s*handle it[.?!]?\s*$/iu,
  /^\s*fix this[.?!]?\s*$/iu,
  /^\s*do the report[.?!]?\s*$/iu,
] as const;
export const GENERIC_AMBIGUOUS_PATTERNS = [...DEFAULT_GENERIC_AMBIGUOUS_PATTERNS];

export const HIGH_RISK_KEYWORDS = [
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

export const CRITICAL_RISK_KEYWORDS = [
  "delete production",
  "drop table",
  "mass delete",
  "delete all",
  "删除全部",
  "删除生产",
  "清空",
] as const;

export const IRREVERSIBLE_KEYWORDS = [
  "delete",
  "drop",
  "erase",
  "remove",
  "删除",
  "清空",
  "覆盖",
] as const;

export const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;
export const PERCENT_PATTERN = /\d+(?:\.\d+)?%/g;
export const CURRENCY_PATTERN = /(?:¥|\$|￥)\s?\d+(?:\.\d+)?/g;
export const ENV_PATTERN = /\b(prod|production|staging|stage|dev|test)\b|线上|生产环境|测试环境/gi;
export const CHANNEL_PATTERN = /\b(slack|telegram|webhook|email|api)\b/gi;
const regexCloneCache = new Map<string, RegExp>();

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tryParseRegexLiteral(source: string): RegExp | null {
  const trimmed = source.trim();
  if (!trimmed.startsWith("/") || trimmed.length < 2) {
    return null;
  }
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash <= 0) {
    return null;
  }
  const patternSource = trimmed.slice(1, lastSlash);
  const flags = trimmed.slice(lastSlash + 1);
  if (!/^[dgimsuvy]*$/u.test(flags)) {
    return null;
  }
  return new RegExp(patternSource, flags);
}

function normalizePatternFlags(pattern: RegExp, requiredFlags: string): RegExp {
  const flagSet = new Set(`${pattern.flags}${requiredFlags}`.split(""));
  return new RegExp(pattern.source, [...flagSet].join(""));
}

function getCachedRegex(pattern: RegExp, requiredFlags = ""): RegExp {
  const flagSet = new Set(`${pattern.flags}${requiredFlags}`.split(""));
  const flags = [...flagSet].join("");
  const key = `${pattern.source}/${flags}`;
  const cached = regexCloneCache.get(key);
  if (cached) {
    cached.lastIndex = 0;
    return cached;
  }
  const compiled = new RegExp(pattern.source, flags);
  regexCloneCache.set(key, compiled);
  return compiled;
}

function compilePatternSource(
  source: string,
  mode: "prompt_injection" | "generic_ambiguity",
): RegExp {
  const parsed = tryParseRegexLiteral(source);
  if (parsed != null) {
    return normalizePatternFlags(parsed, mode === "prompt_injection" ? "g" : "");
  }

  const escaped = escapeRegexLiteral(source.trim()).replace(/\s+/g, "\\s+");
  if (mode === "generic_ambiguity") {
    return new RegExp(`^\\s*(?:${escaped})[。.!?？]?\\s*$`, "iu");
  }
  return new RegExp(escaped, "giu");
}

function dedupePatterns(patterns: readonly RegExp[]): RegExp[] {
  const seen = new Set<string>();
  const deduped: RegExp[] = [];
  for (const pattern of patterns) {
    const key = `${pattern.source}/${pattern.flags}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(pattern);
  }
  return deduped;
}

function normalizeMessageForPatternMatch(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

export function buildPromptInjectionPatterns(additionalPatterns: readonly string[] = []): readonly RegExp[] {
  return dedupePatterns([
    ...DEFAULT_PROMPT_INJECTION_PATTERNS.map((pattern) => normalizePatternFlags(pattern, "g")),
    ...additionalPatterns.map((pattern) => compilePatternSource(pattern, "prompt_injection")),
  ]);
}

export function buildGenericAmbiguousPatterns(additionalPatterns: readonly string[] = []): readonly RegExp[] {
  return dedupePatterns([
    ...DEFAULT_GENERIC_AMBIGUOUS_PATTERNS,
    ...additionalPatterns.map((pattern) => compilePatternSource(pattern, "generic_ambiguity")),
  ]);
}

export function hasGenericAmbiguityPattern(
  message: string,
  patterns: readonly RegExp[] = GENERIC_AMBIGUOUS_PATTERNS,
): boolean {
  const normalized = normalizeMessageForPatternMatch(message);
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(normalized);
  });
}

export function detectInputLocale(message: string): string | null {
  if (/[\u3040-\u30ff]/.test(message)) {
    return "ja-JP";
  }
  if (/[\u4e00-\u9fff]/.test(message)) {
    return "zh-CN";
  }
  if (/[äöüß]/i.test(message)) {
    return "de-DE";
  }
  if (/[a-z]/i.test(message)) {
    return "en-US";
  }
  return null;
}

export function parseAcceptLanguage(raw?: string): string[] {
  if (raw == null || raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim().split(";")[0]?.trim())
    .filter((item): item is string => Boolean(item && item.length > 0));
}

export function mapIntentType(intent: string): DetectedIntent["intentType"] {
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

export function isMediumRiskIntent(intentType: DetectedIntent["intentType"]): boolean {
  return intentType === "task_modify" || intentType === "cancel_task";
}

export function requiresApprovalIntent(intentType: DetectedIntent["intentType"]): boolean {
  return intentType === "approval_action";
}

export function deriveUrgency(message: string): DetectedIntent["urgency"] {
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

export function deriveTitle(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  if (compact.length <= 60) {
    return compact;
  }
  return `${compact.slice(0, 57)}...`;
}

export function dedupeEntities(entities: readonly ExtractedEntity[]): ExtractedEntity[] {
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

export function toJsonValue(value: unknown): JsonValue {
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

export function serializeEntities(entities: readonly ExtractedEntity[]): readonly JsonValue[] {
  return entities.map((entity) => ({
    entityType: entity.entityType,
    value: entity.value,
    normalized: toJsonValue(entity.normalized),
    sourceSpan: [entity.sourceSpan[0], entity.sourceSpan[1]],
  }));
}

export function collectRegexEntities(message: string, pattern: RegExp, entityType: string, normalizeValue?: (value: string) => unknown): ExtractedEntity[] {
  const regex = getCachedRegex(pattern);
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

export function extractEntities(message: string): ExtractedEntity[] {
  const entities = [
    ...collectRegexEntities(message, DATE_PATTERN, "date", (value) => value),
    ...collectRegexEntities(message, PERCENT_PATTERN, "percentage", (value) => Number.parseFloat(value.replace("%", "")) / 100),
    ...collectRegexEntities(message, CURRENCY_PATTERN, "money", (value) => Number.parseFloat(value.replace(/[^\d.]/g, ""))),
    ...collectRegexEntities(message, ENV_PATTERN, "environment", (value) => value.toString().toLowerCase()),
    ...collectRegexEntities(message, CHANNEL_PATTERN, "channel", (value) => value.toString().toLowerCase()),
  ];
  return dedupeEntities(entities);
}

export function defaultCostEstimate(): CostEstimate {
  return {
    estimatedCostUsd: 0.05,
    confidence: "default",
    sampleCount: 0,
    divisionId: null,
    basedOn: "default",
  };
}

export function estimateSlotConfidence(entities: readonly ExtractedEntity[], message: string): number {
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

export function buildConversationMemoryScope(tenantId: string, userId: string): string {
  return `nl_gateway.conversation:${tenantId}:${userId}`;
}

export function collectResolvedSlotsFromTurns(turns: readonly ConversationTurn[]): Readonly<Record<string, unknown>> {
  const resolved: Record<string, unknown> = {};
  for (const turn of turns) {
    for (const entity of turn.detectedIntent.entities) {
      resolved[entity.entityType] = entity.normalized;
    }
  }
  return resolved;
}

export function buildClarificationQuestions(
  message: string,
  confidence: number,
  divisionId: string,
  entities: readonly ExtractedEntity[],
  ambiguousPatterns: readonly RegExp[] = GENERIC_AMBIGUOUS_PATTERNS,
): string[] {
  const questions: string[] = [];
  if (confidence < INTENT_CONFIDENCE_THRESHOLD) {
    questions.push("你希望我先查询现状、创建新任务，还是修改已有内容？");
  }
  if (hasGenericAmbiguityPattern(message, ambiguousPatterns)) {
    questions.push("请补充更具体的范围，例如业务域、时间区间或目标对象。");
  }
  if (divisionId === "general-ops" && /(报表|report|campaign|广告|合同|招聘|deploy|release|代码|bug)/i.test(message)) {
    questions.push("这是哪个业务域的请求？例如工程、营销、法务或 HR。");
  }
  if (entities.length === 0 && /(modify|update|delete|修改|更新|删除|deploy|release|发布)/i.test(message)) {
    questions.push("请指出具体对象或环境，避免误操作。");
  }
  return questions;
}

export function buildMissingSlotQuestions(missingSlots: readonly string[]): string[] {
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

export function detectPromptInjection(
  message: string,
  patterns: readonly RegExp[] = PROMPT_INJECTION_PATTERNS,
): PromptInjectionFinding[] {
  const findings: PromptInjectionFinding[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const regex = getCachedRegex(pattern, "g");
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

export function deriveConversationState(
  requiresClarification: boolean,
  confirmationRequired: boolean,
  blockedByPolicy: boolean,
): ConversationState {
  const decisionKey = `${requiresClarification ? 1 : 0}:${confirmationRequired ? 1 : 0}:${blockedByPolicy ? 1 : 0}`;
  const decisionTable: Record<string, ConversationState> = {
    "1:1:1": "Clarifying",
    "1:1:0": "Clarifying",
    "1:0:1": "Clarifying",
    "1:0:0": "Clarifying",
    "0:1:1": "Clarifying",
    "0:1:0": "Confirming",
    "0:0:1": "Clarifying",
    "0:0:0": "Executing",
  };
  return decisionTable[decisionKey] ?? "Clarifying";
}

export function buildRiskPreview(
  message: string,
  intentType: DetectedIntent["intentType"],
  _dryRunExecutor?: DryRunExecutorPort | null,
  _dryRunContext?: { divisionId: string; workflowId: string; userId: string; locale: string } | null,
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

  return {
    overallRisk: critical ? "critical" : high ? "high" : isMediumRiskIntent(intentType) ? "medium" : "low",
    riskFactors,
    reversible: !irreversible,
    sideEffects,
    approvalNeeded: critical || high || requiresApprovalIntent(intentType),
  };
}

/**
 * R9-41: Async version of risk preview with actual dry-run execution
 */
export async function buildRiskPreviewWithDryRun(
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
  };
}

export function inferRequiredSlots(
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

export function memoryScopeFor(request: Pick<NlEntryRequest, "tenantId" | "userId">): string {
  return `${request.tenantId}:${request.userId}:nl_gateway`;
}

export function clarificationRoundKey(request: Pick<NlEntryRequest, "tenantId" | "userId" | "message">): string {
  return `${request.tenantId}:${request.userId}:${request.message.trim().toLowerCase()}`;
}

export function buildConfirmationScope(divisionId: string, context: ContextEnrichment): string {
  const environment = context.targetEnvironments[0]
    ?? (context.extractedConstraints.includes("production_scope") ? "production" : null);
  return environment == null ? divisionId : `${divisionId}/${environment}`;
}

export function buildCanonicalDomainId(divisionId: string): string {
  if (divisionId === "platform_engineering" || divisionId === "engineering-ops") {
    return "coding";
  }
  return divisionId;
}

export function resolveAutonomyMode(
  confirmationRequired: boolean,
  riskPreview: RiskPreview,
): "suggestion" | "full_auto" {
  return confirmationRequired || riskPreview.approvalNeeded ? "suggestion" : "full_auto";
}

export function resolveRuntimeMode(
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

export function buildStableIdempotencyKey(request: Pick<NlEntryRequest, "tenantId" | "userId" | "message">): string {
  const digest = createHash("sha256")
    .update(`${request.tenantId}:${request.userId}:${request.message}`)
    .digest("hex")
    .slice(0, 24);
  return `nl:${digest}`;
}

export function parseStoredConversationTurn(content: string): ConversationTurn | null {
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

export function buildDryRunPreview(input: {
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
