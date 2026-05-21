import type { LoadedDivisionDefinition } from "../../../domains/governance/division-loader.js";

/** Intent types for request classification */
export type IntakeIntent =
  | "query"
  | "create"
  | "modify"
  | "approve"
  | "cancel"
  | "clarify"
  | "chitchat"
  | "correction";

/** Continuation type indicating if this is new work or follow-up */
export type IntakeContinuation = "new_task" | "follow_up" | "correction";

/**
 * Result of intent classification for a request.
 */
export interface IntakeIntentClassification {
  intent: IntakeIntent;
  continuation: IntakeContinuation;
  confidence: number;
  matchedRules: string[];
  ambiguityDetected?: boolean;
  ambiguityFlags?: readonly string[];
  suggestedClarifications?: readonly string[];
}

/** Keywords indicating the request may need multi-step orchestration */
export const ORCHESTRATION_HINTS = [
  "plan",
  "orchestrate",
  "workflow",
  "compare",
  "review",
  "summarize",
  "research",
  "analyze",
  "design",
  "implement",
  "draft",
  "investigate",
  "设计",
  "实现",
  "分析",
  "总结",
  "评审",
  "研究",
  "对比",
  "方案",
] as const;

/** R6-11: Confidence threshold below which LLM intent extraction should be used per §39.3 */
export const CONFIDENCE_THRESHOLD = 0.80;

/** Intent detection rules mapping intents to keyword lists */
const INTENT_RULES: Readonly<Record<IntakeIntent, readonly string[]>> = {
  query: [
    "what", "why", "how", "when", "where", "who", "which", "show", "list",
    "status", "query", "search", "find", "explain", "lookup", "check",
    "what is", "how do", "can you tell", "what's", "查询", "查看", "看看",
    "列出", "展示", "说明", "解释", "是什么", "怎么", "如何", "状态",
  ],
  create: [
    "create", "build", "implement", "write", "draft", "generate", "produce",
    "prepare", "compose", "make", "新增", "创建", "实现", "编写", "起草",
    "生成", "产出", "做一个", "开发",
  ],
  modify: [
    "modify", "update", "edit", "refactor", "improve", "fix", "patch",
    "adjust", "revise", "rewrite", "修改", "更新", "调整", "优化", "修复",
    "补丁", "改一下", "重构", "改造",
  ],
  approve: [
    "approve", "approved", "ship it", "merge it", "sign off", "go ahead",
    "confirm", "accept", "批准", "审批通过", "同意", "确认通过", "可以发布", "准许",
  ],
  cancel: [
    "cancel", "abort", "stop", "terminate", "drop it", "hold off", "撤销",
    "取消", "停止", "终止", "先不要", "算了",
  ],
  clarify: [
    "clarify", "clarification", "what do you mean", "can you clarify",
    "be more specific", "which one", "please clarify", "澄清", "具体一点",
    "说清楚", "你是指", "哪一个", "再解释一下",
  ],
  chitchat: [
    "hello", "hi", "hey", "thanks", "thank you", "good morning",
    "good afternoon", "how are you", "你好", "嗨", "谢谢", "辛苦了",
    "早上好", "下午好",
  ],
  correction: [
    "correction", "correct that", "actually", "instead", "i meant",
    "that's wrong", "fix the mistake", "修正", "更正", "纠正", "不对",
    "我指的是", "改成", "不是这个",
  ],
} as const;

/** Rules for detecting follow-up/continuation requests */
const FOLLOW_UP_RULES = [
  "continue",
  "continuation",
  "follow up",
  "follow-up",
  "next",
  "then",
  "also",
  "same as above",
  "based on that",
  "continue from",
  "继续",
  "接着",
  "继续做",
  "然后",
  "另外",
  "再做",
  "基于上面",
  "延续",
] as const;

const ASCII_RULE_REGEX_CACHE = new Map<string, RegExp>();

/**
 * The result of routing an intake request, containing the selected workflow
 * and division along with metadata about how the decision was made.
 */
export interface IntakeRouteDecision {
  workflowId: string;
  divisionId: string;
  agentId?: string;
  routeReason: string;
  routeTrace: string[];
  requiresOrchestration: boolean;
  classification: IntakeIntentClassification;
  confirmedTaskSpecId?: string;
  taskDraft?: {
    taskDraftId: string;
    title?: string;
    request: string;
    tenantId?: string;
    principal?: IntakePrincipal;
  };
  clarificationSession?: {
    clarificationSessionId: string;
    taskDraftId: string;
    questions: readonly string[];
  };
  confirmedTaskSpec?: {
    confirmedTaskSpecId: string;
    taskDraftId: string;
    tenantId?: string;
    traceId?: string;
    idempotencyKey?: string;
  };
  requestEnvelope?: {
    requestEnvelopeId: string;
    confirmedTaskSpecId: string;
    tenantId?: string;
    traceId?: string;
    idempotencyKey?: string;
  };
  routeDecision?: IntakeRouteDecision;
}

export interface IntakePrincipal {
  readonly principalId: string;
  readonly tenantId?: string;
  readonly roles?: readonly string[];
}

/**
 * The input provided to the router for making a routing decision.
 */
export interface IntakeRouteInput {
  title?: string;
  request: string;
  priorConversationContext?: unknown;
  requiredCapabilities?: readonly string[];
  tenantId?: string;
  traceId?: string;
  idempotencyKey?: string;
  principal?: IntakePrincipal;
  confirmedTaskSpecId?: string;
  riskPreview?: {
    readonly riskClass: "low" | "medium" | "high" | "critical";
    readonly reasons?: readonly string[];
  };
  preferredIntent?: {
    readonly intent: IntakeIntent;
    readonly confidence: number;
    readonly reasoning?: string;
  };
}

/**
 * Configuration options for the IntakeRouter.
 */
export interface IntakeRouterOptions {
  divisionRegistry?: import("../../../domains/governance/division-loader.js").DivisionRegistry | null;
  loadBalancing?: LoadBalancingStrategy;
  skillTaxonomy?: SkillTaxonomy;
}

/**
 * Load balancing strategies for distributing requests across divisions.
 */
export type LoadBalancingStrategy =
  | "round-robin"
  | "least-load"
  | "weighted"
  | "capacity-aware"
  | "random";

/**
 * Skill category types for taxonomy-based routing.
 */
export type SkillCategory =
  | "coding"
  | "data"
  | "analysis"
  | "communication"
  | "automation"
  | "review"
  | "infrastructure"
  | "security"
  | "general";

/**
 * Skill taxonomy entry mapping keywords to skill categories.
 */
export interface SkillTaxonomyEntry {
  category: SkillCategory;
  keywords: readonly string[];
  weight: number;
}

/**
 * Skill taxonomy for categorizing requests based on capability keywords.
 */
export interface SkillTaxonomy {
  entries: readonly SkillTaxonomyEntry[];
  defaultCategory: SkillCategory;
}

/**
 * Result of skill taxonomy classification for a request.
 */
export interface SkillTaxonomyResult {
  category: SkillCategory;
  confidence: number;
  matchedSkills: readonly string[];
}

/** Built-in skill taxonomy with common capability categories */
export const BUILT_IN_SKILL_TAXONOMY: SkillTaxonomy = {
  entries: [
    {
      category: "coding",
      keywords: [
        "code", "programming", "implement", "develop", "function", "class",
        "module", "api", "debug", "refactor", "write", "script", "algorithm",
        "编码", "编程", "开发", "实现", "代码", "函数", "模块",
      ],
      weight: 0.9,
    },
    {
      category: "data",
      keywords: [
        "data", "database", "query", "sql", "table", "record", "schema",
        "analytics", "metrics", "report", "dashboard", "数据", "数据库",
        "查询", "分析", "报表", "统计",
      ],
      weight: 0.85,
    },
    {
      category: "analysis",
      keywords: [
        "analyze", "analysis", "review", "evaluate", "assess", "compare",
        "research", "investigate", "insight", "pattern", "trend", "分析",
        "研究", "评审", "评估", "比较", "调查", "洞察",
      ],
      weight: 0.8,
    },
    {
      category: "communication",
      keywords: [
        "write", "email", "message", "notify", "summarize", "document",
        "draft", "compose", "communicate", "传达", "写作", "写", "邮件",
        "通知", "文档", "草稿",
      ],
      weight: 0.75,
    },
    {
      category: "automation",
      keywords: [
        "automate", "workflow", "pipeline", "schedule", "trigger", "batch",
        "integration", "connect", "webhook", "自动化", "工作流", "流水线",
        "调度", "触发", "集成", "连接",
      ],
      weight: 0.85,
    },
    {
      category: "review",
      keywords: [
        "review", "approve", "check", "validate", "verify", "audit",
        "inspect", "test", "quality", "评审", "审批", "检查", "验证",
        "审计", "测试", "质量",
      ],
      weight: 0.8,
    },
    {
      category: "infrastructure",
      keywords: [
        "deploy", "infrastructure", "server", "container", "kubernetes",
        "cloud", "network", "config", "infrastructure", "部署", "基础设施",
        "服务器", "容器", "云", "网络", "配置",
      ],
      weight: 0.85,
    },
    {
      category: "security",
      keywords: [
        "security", "auth", "permission", "access", "encrypt", "secure",
        "vulnerability", "threat", "安全", "认证", "授权", "权限", "加密",
        "漏洞", "威胁",
      ],
      weight: 0.9,
    },
  ],
  defaultCategory: "general",
} as const;

/**
 * Result of load-balanced selection among division candidates.
 */
export interface LoadBalancedSelection<T> {
  selected: T;
  position: number;
}

/**
 * R6-11: Result of intent extraction with confidence scoring.
 */
interface IntentExtractionResult {
  extractedGoal: string;
  confidence: number;
  ambiguityDetected: boolean;
  ambiguityFlags: readonly string[];
  suggestedClarifications: readonly string[];
}

/**
 * Normalizes text for comparison by trimming whitespace and converting to lowercase.
 */
export function normalize(text: string | null | undefined): string {
  return (text ?? "").trim().toLowerCase();
}

/**
 * Finds the longest matching trigger pattern for a division against an input.
 */
export function findMatchedTrigger(
  division: LoadedDivisionDefinition,
  normalizedInput: string,
): string | null {
  const alternatives = division.triggers.flatMap((trigger) =>
    trigger
      .split("|")
      .map((item) => normalize(item))
      .filter((item) => item.length > 0),
  );

  const matches = alternatives.filter((alternative) => normalizedInput.includes(alternative));
  if (matches.length === 0) {
    return null;
  }
  return matches.sort((left, right) => right.length - left.length)[0] ?? null;
}

/**
 * Classifies the intent of a normalized input based on keyword matching.
 */
export function classifyIntent(
  normalizedInput: string,
  matchedHints: readonly string[],
): IntakeIntentClassification {
  const matchedRulesByIntent = {
    query: findRuleMatches(INTENT_RULES.query, normalizedInput),
    create: findRuleMatches(INTENT_RULES.create, normalizedInput),
    modify: findRuleMatches(INTENT_RULES.modify, normalizedInput),
    approve: findRuleMatches(INTENT_RULES.approve, normalizedInput),
    cancel: findRuleMatches(INTENT_RULES.cancel, normalizedInput),
    clarify: findRuleMatches(INTENT_RULES.clarify, normalizedInput),
    chitchat: findRuleMatches(INTENT_RULES.chitchat, normalizedInput),
    correction: findRuleMatches(INTENT_RULES.correction, normalizedInput),
  } satisfies Record<IntakeIntent, string[]>;

  const intent = selectIntent(normalizedInput, matchedRulesByIntent);
  const continuation = selectContinuation(normalizedInput, matchedRulesByIntent.correction);
  const matchedRules = dedupeRules([
    ...matchedRulesByIntent[intent],
    ...(continuation === "follow_up" ? findRuleMatches(FOLLOW_UP_RULES, normalizedInput) : []),
  ]);
  const confidence = computeConfidence(normalizedInput, matchedRules, matchedHints, continuation, intent);

  return {
    intent,
    continuation,
    confidence,
    matchedRules,
  };
}

/**
 * R6-11: Pattern-based intent extraction with confidence scoring.
 */
export function extractIntentWithConfidence(goal: string): IntentExtractionResult {
  const ambiguityFlags: string[] = [];

  if (/\b(maybe|perhaps|possibly|some|several|about|roughly)\b/i.test(goal)) {
    ambiguityFlags.push("vague_goal_language");
  }
  if (/\b(soon|later|eventually|when possible)\b/i.test(goal)) {
    ambiguityFlags.push("ambiguous_timing");
  }
  if (/\b(if|unless|maybe|either|perhaps|depending on)\b/i.test(goal)) {
    ambiguityFlags.push("conditional_language");
  }
  if (goal.length < 30) {
    ambiguityFlags.push("short_goal");
  }
  if (/\b(but|however|although|though)\b/i.test(goal) && goal.length < 80) {
    ambiguityFlags.push("potential_conflict");
  }

  const confidence = Math.max(0.35, 0.80 - (ambiguityFlags.length * 0.12));
  const suggestedClarifications: string[] = [];
  if (ambiguityFlags.includes("vague_goal_language")) {
    suggestedClarifications.push("Specify concrete requirements or criteria");
  }
  if (ambiguityFlags.includes("ambiguous_timing")) {
    suggestedClarifications.push("Provide a specific deadline or time frame");
  }
  if (ambiguityFlags.includes("short_goal")) {
    suggestedClarifications.push("Provide more details about the desired outcome");
  }
  if (ambiguityFlags.includes("conditional_language")) {
    suggestedClarifications.push("Clarify the conditions or dependencies");
  }
  if (ambiguityFlags.includes("potential_conflict")) {
    suggestedClarifications.push("Resolve potential conflicts in requirements");
  }

  return {
    extractedGoal: goal,
    confidence,
    ambiguityDetected: ambiguityFlags.length > 0,
    ambiguityFlags,
    suggestedClarifications,
  };
}

/**
 * Determines whether a request requires orchestration based on complexity.
 */
export function shouldRequireOrchestration(
  normalizedInput: string,
  matchedHints: readonly string[],
  classification: IntakeIntentClassification,
  riskClass?: "low" | "medium" | "high" | "critical",
): boolean {
  const containsHighComplexityChineseCue =
    /(分析|研究|设计|对比|方案)/u.test(normalizedInput);

  if (riskClass === "high" || riskClass === "critical") {
    return true;
  }
  if (matchedHints.length >= 2 || normalizedInput.length >= 120) {
    return true;
  }
  if (containsHighComplexityChineseCue && matchedHints.length >= 1) {
    return true;
  }
  if (classification.continuation === "follow_up" && matchedHints.length >= 1) {
    return true;
  }
  if ((classification.intent === "create"
      || classification.intent === "modify"
      || classification.intent === "correction")
    && (matchedHints.length >= 1 || normalizedInput.length > 80)) {
    return true;
  }
  return false;
}

export function withOptionalConfirmedTaskSpecId(
  decision: Omit<IntakeRouteDecision, "confirmedTaskSpecId">,
  confirmedTaskSpecId: string | undefined,
): IntakeRouteDecision {
  return confirmedTaskSpecId == null || confirmedTaskSpecId.length === 0
    ? decision
    : { ...decision, confirmedTaskSpecId };
}

/**
 * Selects the primary intent based on matched rules and priorities.
 */
function selectIntent(
  normalizedInput: string,
  matchedRulesByIntent: Record<IntakeIntent, string[]>,
): IntakeIntent {
  if (matchedRulesByIntent.correction.length > 0) {
    return "correction";
  }
  if (matchedRulesByIntent.cancel.length > 0) {
    return "cancel";
  }
  if (matchedRulesByIntent.approve.length > 0) {
    return "approve";
  }
  if (matchedRulesByIntent.clarify.length > 0) {
    return "clarify";
  }
  if (matchedRulesByIntent.chitchat.length > 0
    && matchedRulesByIntent.query.length === 0
    && matchedRulesByIntent.create.length === 0
    && matchedRulesByIntent.modify.length === 0) {
    return "chitchat";
  }

  const ranked: Array<{ intent: IntakeIntent; score: number }> = [
    { intent: "create", score: scoreIntentMatches(matchedRulesByIntent.create, normalizedInput, "create") },
    { intent: "modify", score: scoreIntentMatches(matchedRulesByIntent.modify, normalizedInput, "modify") },
    { intent: "query", score: scoreIntentMatches(matchedRulesByIntent.query, normalizedInput, "query") },
    { intent: "chitchat", score: scoreIntentMatches(matchedRulesByIntent.chitchat, normalizedInput, "chitchat") },
  ];

  if (ranked.every((candidate) => candidate.score === 0)) {
    return "query";
  }

  return ranked
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return intentPriority(left.intent) - intentPriority(right.intent);
    })[0]?.intent ?? "query";
}

function scoreIntentMatches(
  matches: readonly string[],
  normalizedInput: string,
  intent: IntakeIntent,
): number {
  let score = matches.length * 2;
  if (intent === "query" && normalizedInput.includes("?")) {
    score += 2;
  }
  if (intent === "query" && /^(what|why|how|when|where|who|which|show|list|查询|查看|列出|说明|解释)/.test(normalizedInput)) {
    score += 2;
  }
  if (intent !== "query" && matches.length === 0) {
    return 0;
  }
  if (intent === "chitchat" && normalizedInput.length <= 40) {
    score += 2;
  }
  if (intent === "create" && /(^|\s)(build|create|implement|draft|write|新增|创建|实现|开发)/.test(normalizedInput)) {
    score += 1;
  }
  if (intent === "modify" && /(^|\s)(fix|patch|update|modify|调整|修改|修复|更新)/.test(normalizedInput)) {
    score += 1;
  }
  return score;
}

function intentPriority(intent: IntakeIntent): number {
  switch (intent) {
    case "create":
      return 1;
    case "modify":
      return 2;
    case "query":
      return 3;
    case "chitchat":
      return 4;
    case "approve":
      return 5;
    case "cancel":
      return 6;
    case "clarify":
      return 7;
    case "correction":
      return 8;
    default:
      return 99;
  }
}

function selectContinuation(
  normalizedInput: string,
  correctionMatches: readonly string[],
): IntakeContinuation {
  if (correctionMatches.length > 0) {
    return "correction";
  }
  if (findRuleMatches(FOLLOW_UP_RULES, normalizedInput).length > 0) {
    return "follow_up";
  }
  return "new_task";
}

function computeConfidence(
  normalizedInput: string,
  matchedRules: readonly string[],
  matchedHints: readonly string[],
  continuation: IntakeContinuation,
  intent: IntakeIntent,
): number {
  let confidence = 0.52;
  confidence += Math.min(matchedRules.length, 3) * 0.12;
  confidence += Math.min(matchedHints.length, 2) * 0.05;
  if (continuation !== "new_task") {
    confidence += 0.08;
  }
  if (intent === "query" && normalizedInput.includes("?")) {
    confidence += 0.06;
  }
  if (intent === "chitchat" && normalizedInput.length <= 40) {
    confidence += 0.06;
  }
  if (matchedRules.length === 0 && matchedHints.length === 0) {
    confidence -= 0.08;
  }
  return Number(Math.max(0.45, Math.min(0.98, confidence)).toFixed(2));
}

function findRuleMatches(
  rules: readonly string[],
  normalizedInput: string,
): string[] {
  return rules.filter((rule) => matchesRule(normalizedInput, rule));
}

function dedupeRules(rules: readonly string[]): string[] {
  return [...new Set(rules)];
}

function matchesRule(
  normalizedInput: string,
  rule: string,
): boolean {
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(rule)) {
    return normalizedInput.includes(rule);
  }
  const cached = ASCII_RULE_REGEX_CACHE.get(rule);
  if (cached != null) {
    return cached.test(normalizedInput);
  }
  const compiled = new RegExp(`(^|[^a-z0-9])${escapeRegExp(rule)}($|[^a-z0-9])`);
  ASCII_RULE_REGEX_CACHE.set(rule, compiled);
  return compiled.test(normalizedInput);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
