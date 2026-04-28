/**
 * Intake Router (Business Alias: VP Operations)
 *
 * ## Overview
 *
 * Routes incoming requests to the appropriate division and workflow based on
 * content analysis and trigger pattern matching. Entry point for request classification.
 *
 * ## Architecture Role
 *
 * Part of the control layer canonical mapping:
 * - Canonical ID: intake_router
 * - Business Alias: VP Operations
 * - Responsibility: Input triage, classification, routing, budget entry
 *
 * ## Routing Decisions
 *
 * - Which division handles the request (based on trigger patterns)
 * - Which workflow to use (simple vs. orchestration)
 * - Whether multi-step orchestration is required
 *
 * ## Routing Logic
 *
 * - Keyword matching for orchestration hints (plan, orchestrate, analyze, etc.)
 * - Division trigger patterns (matched against normalized input)
 * - Request complexity threshold (120 characters)
 *
 * @see Architecture: docs_zh/architecture/00-platform-architecture.md
 * @see Workflow Routing ADR: docs_zh/adr/004-workflow-routing.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md (intake_router)
 */

import type { DivisionRegistry, LoadedDivisionDefinition } from "../../../domains/governance/division-loader.js";
import { getDefaultDivisionRegistry } from "../../../domains/governance/division-loader.js";

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
}

/** Keywords indicating the request may need multi-step orchestration */
const ORCHESTRATION_HINTS = [
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

/** Intent detection rules mapping intents to keyword lists */
const INTENT_RULES: Readonly<Record<IntakeIntent, readonly string[]>> = {
  query: [
    "what",
    "why",
    "how",
    "when",
    "where",
    "who",
    "which",
    "show",
    "list",
    "status",
    "query",
    "search",
    "find",
    "explain",
    "lookup",
    "check",
    "what is",
    "how do",
    "can you tell",
    "what's",
    "查询",
    "查看",
    "看看",
    "列出",
    "展示",
    "说明",
    "解释",
    "是什么",
    "怎么",
    "如何",
    "状态",
  ],
  create: [
    "create",
    "build",
    "implement",
    "write",
    "draft",
    "generate",
    "produce",
    "prepare",
    "compose",
    "make",
    "新增",
    "创建",
    "实现",
    "编写",
    "起草",
    "生成",
    "产出",
    "做一个",
    "开发",
  ],
  modify: [
    "modify",
    "update",
    "edit",
    "refactor",
    "improve",
    "fix",
    "patch",
    "adjust",
    "revise",
    "rewrite",
    "修改",
    "更新",
    "调整",
    "优化",
    "修复",
    "补丁",
    "改一下",
    "重构",
    "改造",
  ],
  approve: [
    "approve",
    "approved",
    "ship it",
    "merge it",
    "sign off",
    "go ahead",
    "confirm",
    "accept",
    "批准",
    "审批通过",
    "同意",
    "确认通过",
    "可以发布",
    "准许",
  ],
  cancel: [
    "cancel",
    "abort",
    "stop",
    "terminate",
    "drop it",
    "hold off",
    "撤销",
    "取消",
    "停止",
    "终止",
    "先不要",
    "算了",
  ],
  clarify: [
    "clarify",
    "clarification",
    "what do you mean",
    "can you clarify",
    "be more specific",
    "which one",
    "please clarify",
    "澄清",
    "具体一点",
    "说清楚",
    "你是指",
    "哪一个",
    "再解释一下",
  ],
  chitchat: [
    "hello",
    "hi",
    "hey",
    "thanks",
    "thank you",
    "good morning",
    "good afternoon",
    "how are you",
    "你好",
    "嗨",
    "谢谢",
    "辛苦了",
    "早上好",
    "下午好",
  ],
  correction: [
    "correction",
    "correct that",
    "actually",
    "instead",
    "i meant",
    "that's wrong",
    "fix the mistake",
    "修正",
    "更正",
    "纠正",
    "不对",
    "我指的是",
    "改成",
    "不是这个",
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

/**
 * The result of routing an intake request, containing the selected workflow
 * and division along with metadata about how the decision was made.
 */
export interface IntakeRouteDecision {
  /** ID of the workflow to execute for this request */
  workflowId: string;
  /** ID of the division that will handle this request */
  divisionId: string;
  /** ID of the default agent for simple execution routes */
  agentId?: string;
  /** Human-readable reason for the routing decision */
  routeReason: string;
  /** Trace of routing decisions made (for debugging/logging) */
  routeTrace: string[];
  /** Whether this request requires multi-step orchestration workflow */
  requiresOrchestration: boolean;
  /** Structured intake classification used to drive downstream routing/evaluation */
  classification: IntakeIntentClassification;
}

/**
 * The input provided to the router for making a routing decision.
 */
export interface IntakeRouteInput {
  /** The title/summary of the request */
  title?: string;
  /** The detailed request content or description */
  request: string;
}

/**
 * Configuration options for the IntakeRouter.
 */
export interface IntakeRouterOptions {
  /** The division registry to use for routing (defaults to global registry) */
  divisionRegistry?: DivisionRegistry | null;
}

/**
 * LLM intent extraction result.
 */
export interface LlmIntentResult {
  /** Primary intent from LLM classification */
  intent: IntakeIntent;
  /** Confidence score from LLM (0-1) */
  confidence: number;
  /** Reasoning from LLM */
  reasoning: string;
}

/**
 * Simulates LLM intent extraction for intake routing.
 * In production, this would call an actual LLM service.
 *
 * R6-11: Adds LLM intent extraction with confidence threshold (0.80) per §39.3.
 */
async function extractLlmIntent(request: string): Promise<LlmIntentResult | null> {
  // In a real implementation, this would call an LLM API
  // For now, we return null to indicate LLM extraction was not performed
  // The keyword-based classification will be used as fallback
  return null;
}

/**
 * Normalizes text for comparison by trimming whitespace and converting to lowercase.
 */
function normalize(text: string | null | undefined): string {
  return (text ?? "").trim().toLowerCase();
}

/**
 * Routes incoming requests to appropriate divisions and workflows.
 *
 * The router analyzes request content to determine:
 * 1. Whether orchestration is needed (based on keyword hints and request length)
 * 2. Which division should handle the request (based on trigger matching)
 * 3. Which specific workflow to execute
 *
 * Routing is deterministic and produces a trace of decisions for debugging.
 */
export class IntakeRouter {
  private readonly divisionRegistry: DivisionRegistry | null;

  /**
   * Creates a new intake router instance.
   *
   * @param options - Configuration options including an optional division registry
   */
  public constructor(options: IntakeRouterOptions = {}) {
    this.divisionRegistry =
      options.divisionRegistry === undefined
        ? getDefaultDivisionRegistry()
        : options.divisionRegistry;
  }

  /**
   * Routes an incoming request to the appropriate workflow and division.
   *
   * The routing algorithm:
   * 1. Normalizes the input (trim + lowercase)
   * 2. Checks for orchestration hints (keywords like "plan", "analyze", etc.)
   * 3. Selects the best matching division based on trigger patterns
   * 4. Determines whether orchestration is required based on:
   *    - Number of matched orchestration keywords (2+ triggers orchestration)
   *    - Request length exceeding 120 characters
   * 5. Returns the selected workflow, division, and routing metadata
   *
   * @param input - The intake request containing title and detailed request
   * @returns A complete routing decision with workflow, division, and trace
   */
  public async route(input: IntakeRouteInput): Promise<IntakeRouteDecision> {
    // Combine and normalize title and request for analysis
    const normalized = [normalize(input.title), normalize(input.request)]
      .filter((segment) => segment.length > 0)
      .join(" ");
    const routeTrace: string[] = [];

    // R6-11: Try LLM intent extraction with 0.80 confidence threshold per §39.3
    let classification = classifyIntent(normalized, []);
    let useLlmClassification = false;

    try {
      const llmResult = await extractLlmIntent(input.request);
      if (llmResult != null && llmResult.confidence >= 0.80) {
        classification = {
          intent: llmResult.intent,
          continuation: "new_task" as IntakeContinuation,
          confidence: llmResult.confidence,
          matchedRules: [`llm:${llmResult.reasoning}`],
        };
        useLlmClassification = true;
        routeTrace.push(`llm_intent:${llmResult.intent}`);
        routeTrace.push(`llm_confidence:${llmResult.confidence.toFixed(2)}`);
        routeTrace.push(`llm_reasoning:${llmResult.reasoning}`);
      }
    } catch {
      // LLM extraction failed, fall back to keyword classification
      routeTrace.push("llm_extraction_failed:fallback_to_keyword");
    }

    // If not using LLM classification, fall back to keyword-based classification
    let matchedHints: readonly string[] = [];
    if (!useLlmClassification) {
      // Find all orchestration hints present in the normalized input
      matchedHints = ORCHESTRATION_HINTS.filter((hint) => normalized.includes(hint));
      routeTrace.push(
        matchedHints.length > 0
          ? `matched_keywords:${matchedHints.join(",")}`
          : "matched_keywords:none",
      );

      classification = classifyIntent(normalized, matchedHints);
    }

    routeTrace.push(`intent:${classification.intent}`);
    routeTrace.push(`continuation:${classification.continuation}`);
    routeTrace.push(`confidence:${classification.confidence.toFixed(2)}`);
    routeTrace.push(
      classification.matchedRules.length > 0
        ? `matched_intent_rules:${classification.matchedRules.join(",")}`
        : "matched_intent_rules:none",
    );

    // R6-11: AmbiguityResolver - if confidence < 0.80, flag for human review
    const needsAmbiguityResolution = classification.confidence < 0.80;
    if (needsAmbiguityResolution) {
      routeTrace.push(`ambiguity:requires_resolution`);
    }

    // Select the best matching division based on trigger patterns
    const division = this.selectDivision(normalized, routeTrace);

    // Determine if orchestration is required based on complexity signals
    if (shouldRequireOrchestration(normalized, matchedHints, classification)) {
      // Use orchestration workflow (specific or fallback)
      const workflowId = division?.orchestrationWorkflowId ?? division?.defaultWorkflowId ?? "single_division_multi_step_orchestration";
      routeTrace.push(`route:selected:${workflowId}`);
      return {
        workflowId,
        divisionId: division?.id ?? "general_ops",
        routeReason: "route.multi_step_or_high_context",
        routeTrace,
        requiresOrchestration: true,
        classification,
      };
    }

    // Simple request - use the division's default workflow
    const workflowId = division?.defaultWorkflowId ?? "single_agent_minimal";
    routeTrace.push(`route:selected:${workflowId}`);
    return {
      workflowId,
      divisionId: division?.id ?? "general_ops",
      agentId: `${division?.id ?? "general_ops"}_agent`,
      routeReason: "route.simple_request",
      routeTrace,
      requiresOrchestration: false,
      classification,
    };
  }

  /**
   * Selects the best matching division for a normalized input.
   *
   * Division selection is based on trigger pattern matching:
   * 1. Expand trigger patterns (split by "|" for alternatives)
   * 2. Normalize each trigger alternative
   * 3. Find all triggers that match the input
   * 4. Sort candidates by priority, then by match length, then by ID
   * 5. Return the best match, or "general_ops" fallback if no matches
   */
  private selectDivision(
    normalizedInput: string,
    routeTrace: string[],
  ): LoadedDivisionDefinition | null {
    const registry = this.divisionRegistry;
    if (!registry) {
      routeTrace.push("matched_divisions:none");
      return null;
    }

    // Find all divisions with matching triggers
    const candidates = [...registry.divisions.values()]
      .map((division) => {
        const matchedTrigger = findMatchedTrigger(division, normalizedInput);
        return matchedTrigger ? { division, matchedTrigger } : null;
      })
      // Filter out divisions with no matching triggers
      .filter((entry): entry is { division: LoadedDivisionDefinition; matchedTrigger: string } => entry != null)
      // Sort by priority (descending), then by trigger match length (descending),
      // then by division ID (ascending for determinism)
      .sort((left, right) => {
        if (right.division.priority !== left.division.priority) {
          return right.division.priority - left.division.priority;
        }
        if (right.matchedTrigger.length !== left.matchedTrigger.length) {
          return right.matchedTrigger.length - left.matchedTrigger.length;
        }
        return left.division.id.localeCompare(right.division.id);
      });

    // No divisions matched - use "general_ops" as fallback
    if (candidates.length === 0) {
      routeTrace.push("matched_divisions:none");
      return registry.divisions.get("general_ops") ?? null;
    }

    // Record all candidates for debugging purposes
    routeTrace.push(
      `matched_divisions:${candidates.map((candidate) => `${candidate.division.id}:${candidate.matchedTrigger}`).join(",")}`,
    );
    return candidates[0]?.division ?? null;
  }
}

/**
 * Finds the longest matching trigger pattern for a division against an input.
 *
 * Trigger patterns support alternation via "|" (e.g., "code|programming" matches
 * either "code" or "programming"). Each alternative is normalized and checked.
 */
function findMatchedTrigger(
  division: LoadedDivisionDefinition,
  normalizedInput: string,
): string | null {
  // Expand trigger patterns into individual alternatives
  const alternatives = division.triggers.flatMap((trigger) =>
    trigger
      .split("|")
      .map((item) => normalize(item))
      .filter((item) => item.length > 0),
  );

  // Find all alternatives that appear in the input
  const matches = alternatives.filter((alternative) => normalizedInput.includes(alternative));
  if (matches.length === 0) {
    return null;
  }

  // Return the longest matching alternative (most specific match wins)
  return matches.sort((left, right) => right.length - left.length)[0] ?? null;
}

/**
 * Classifies the intent of a normalized input based on keyword matching.
 */
function classifyIntent(
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

  const createScore = scoreIntentMatches(matchedRulesByIntent.create, normalizedInput, "create");
  const modifyScore = scoreIntentMatches(matchedRulesByIntent.modify, normalizedInput, "modify");
  const queryScore = scoreIntentMatches(matchedRulesByIntent.query, normalizedInput, "query");
  const chitchatScore = scoreIntentMatches(matchedRulesByIntent.chitchat, normalizedInput, "chitchat");

  const ranked: Array<{ intent: IntakeIntent; score: number }> = [
    { intent: "create", score: createScore },
    { intent: "modify", score: modifyScore },
    { intent: "query", score: queryScore },
    { intent: "chitchat", score: chitchatScore },
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

/**
 * Computes a score for intent matching based on various factors.
 */
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

/**
 * Returns the priority of an intent for tie-breaking.
 */
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

/**
 * Determines the continuation type based on correction and follow-up rules.
 */
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

/**
 * Determines whether a request requires orchestration based on complexity.
 */
function shouldRequireOrchestration(
  normalizedInput: string,
  matchedHints: readonly string[],
  classification: IntakeIntentClassification,
): boolean {
  const containsHighComplexityChineseCue =
    /(分析|研究|设计|对比|方案)/u.test(normalizedInput);

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

/**
 * Computes the confidence score for intent classification.
 */
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

/**
 * Finds all rule matches for a given set of rules.
 */
function findRuleMatches(
  rules: readonly string[],
  normalizedInput: string,
): string[] {
  return rules.filter((rule) => matchesRule(normalizedInput, rule));
}

/**
 * Deduplicates rules while preserving order.
 */
function dedupeRules(rules: readonly string[]): string[] {
  return [...new Set(rules)];
}

/**
 * Checks if a normalized input matches a rule.
 */
function matchesRule(
  normalizedInput: string,
  rule: string,
): boolean {
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(rule)) {
    return normalizedInput.includes(rule);
  }
  const escapedRule = escapeRegExp(rule);
  return new RegExp(`(^|[^a-z0-9])${escapedRule}($|[^a-z0-9])`).test(normalizedInput);
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
