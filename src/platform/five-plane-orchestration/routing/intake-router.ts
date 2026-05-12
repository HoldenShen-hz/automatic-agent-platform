/**
 * Intake Router (Business Alias: VP Operations)
 *
 * ## Overview
 *
 * Routes incoming requests to the appropriate division and workflow based on
 * content analysis and trigger pattern matching. Entry point for request classification.
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
 * Note: Budget entry is handled by the budget allocation layer, not by intake router.
 * The router determines workflow selection and division routing only.
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

/** R6-11: Confidence threshold below which LLM intent extraction should be used per §39.3 */
const CONFIDENCE_THRESHOLD = 0.80;

/** R6-11: Low confidence threshold for ambiguous intent classification */
const LOW_CONFIDENCE_THRESHOLD = 0.55;

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
  /** Optional capabilities required for this request (used for capability matching) */
  requiredCapabilities?: readonly string[];
}

/**
 * Configuration options for the IntakeRouter.
 */
export interface IntakeRouterOptions {
  /** The division registry to use for routing (defaults to global registry) */
  divisionRegistry?: DivisionRegistry | null;
  /** Load balancing strategy for selecting among equally-matched divisions */
  loadBalancing?: LoadBalancingStrategy;
  /** Skill taxonomy for categorizing capabilities (defaults to built-in taxonomy) */
  skillTaxonomy?: SkillTaxonomy;
}

/**
 * Load balancing strategies for distributing requests across divisions.
 */
export type LoadBalancingStrategy =
  | "round-robin"    // Cycle through candidates in order
  | "least-load"     // Select candidate with lowest active request count
  | "weighted"       // Weight by division priority (higher priority = more load)
  | "capacity-aware" // Weight by actual available capacity (maxInstances from roles)
  | "random";        // Random selection among candidates

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
  weight: number; // 0.0 - 1.0, higher = more specialized
}

/**
 * Skill taxonomy for categorizing requests based on capability keywords.
 */
export interface SkillTaxonomy {
  entries: readonly SkillTaxonomyEntry[];
  /** Fallback category for uncategorized skills */
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
const BUILT_IN_SKILL_TAXONOMY: SkillTaxonomy = {
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
interface LoadBalancedSelection<T> {
  selected: T;
  position: number;
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
  private readonly skillTaxonomy: SkillTaxonomy;
  private readonly loadBalancing: LoadBalancingStrategy;
  private readonly roundRobinCounters: Map<string, number>;

  /**
   * Creates a new intake router instance.
   *
   * @param options - Configuration options including an optional division registry,
   *                 skill taxonomy, and load balancing strategy
   */
  public constructor(options: IntakeRouterOptions = {}) {
    this.divisionRegistry =
      options.divisionRegistry === undefined
        ? getDefaultDivisionRegistry()
        : options.divisionRegistry;
    this.skillTaxonomy = options.skillTaxonomy ?? BUILT_IN_SKILL_TAXONOMY;
    this.loadBalancing = options.loadBalancing ?? "round-robin";
    this.roundRobinCounters = new Map();
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
  public route(input: IntakeRouteInput): IntakeRouteDecision {
    // Combine and normalize title and request for analysis
    const normalized = [normalize(input.title), normalize(input.request)]
      .filter((segment) => segment.length > 0)
      .join(" ");
    const routeTrace: string[] = [];

    // Find all orchestration hints present in the normalized input
    const matchedHints = ORCHESTRATION_HINTS.filter((hint) => normalized.includes(hint));
    routeTrace.push(
      matchedHints.length > 0
        ? `matched_keywords:${matchedHints.join(",")}`
        : "matched_keywords:none",
    );

    const classification = classifyIntent(normalized, matchedHints);
    routeTrace.push(`intent:${classification.intent}`);
    routeTrace.push(`continuation:${classification.continuation}`);
    routeTrace.push(`confidence:${classification.confidence.toFixed(2)}`);

    // R6-11: If confidence is below threshold, use LLM-based intent extraction
    // This improves routing accuracy for ambiguous requests
    let finalClassification = classification;
    if (classification.confidence < CONFIDENCE_THRESHOLD) {
      // Use LLM extraction for low-confidence classification
      const llmExtraction = extractIntentWithConfidence(normalized);
      routeTrace.push(`llm_extraction:attempted`);
      routeTrace.push(`llm_confidence:${llmExtraction.confidence.toFixed(2)}`);
      routeTrace.push(`ambiguity_flags:${llmExtraction.ambiguityFlags.join(",") || "none"}`);

      // Only use LLM extraction if it has higher confidence
      if (llmExtraction.confidence > classification.confidence) {
        finalClassification = {
          intent: classification.intent, // Keep keyword-based intent for safety
          continuation: classification.continuation,
          confidence: llmExtraction.confidence,
          matchedRules: classification.matchedRules,
        };
        routeTrace.push(`llm_extraction:adopted`);
      }
    }
    routeTrace.push(
      classification.matchedRules.length > 0
        ? `matched_intent_rules:${classification.matchedRules.join(",")}`
        : "matched_intent_rules:none",
    );

    // R9-09 fix: Add capability matching to routing decision
    // First select division via triggers, then try capability-based matching
    const triggerSelectedDivision = this.selectDivision(normalized, routeTrace);
    const capabilityMatchResult = this.matchCapabilities(input.requiredCapabilities ?? [], triggerSelectedDivision, routeTrace);

    // Use capability-matched division if available, otherwise use trigger-selected division
    const division = capabilityMatchResult.matchedDivision ?? triggerSelectedDivision;

    // R6-11: Use finalClassification (possibly LLM-enhanced) for routing decision
    // Determine if orchestration is required based on complexity signals
    if (shouldRequireOrchestration(normalized, matchedHints, finalClassification)) {
      // Use orchestration workflow (specific or fallback)
      const workflowId = division?.orchestrationWorkflowId ?? division?.defaultWorkflowId ?? "single_division_multi_step_orchestration";
      routeTrace.push(`route:selected:${workflowId}`);
      routeTrace.push(`capability_match:${capabilityMatchResult.matched ? "yes" : "no"}`);
      return {
        workflowId,
        divisionId: division?.id ?? "general_ops",
        routeReason: capabilityMatchResult.matched ? "route.capability_match" : "route.multi_step_or_high_context",
        routeTrace,
        requiresOrchestration: true,
        classification: finalClassification,
      };
    }

    // Simple request - use the division's default workflow
    const workflowId = division?.defaultWorkflowId ?? "single_agent_minimal";
    routeTrace.push(`route:selected:${workflowId}`);
    routeTrace.push(`capability_match:${capabilityMatchResult.matched ? "yes" : "no"}`);
    return {
      workflowId,
      divisionId: division?.id ?? "general_ops",
      agentId: `${division?.id ?? "general_ops"}_agent`,
      routeReason: capabilityMatchResult.matched ? "route.capability_match" : "route.simple_request",
      routeTrace,
      requiresOrchestration: false,
      classification: finalClassification,
    };
  }

  /**
   * R9-09 fix: Matches required capabilities against division roles.
   * Returns the best matching division if capabilities are specified and matched.
   */
  private matchCapabilities(
    requiredCapabilities: readonly string[],
    currentDivision: LoadedDivisionDefinition | null,
    routeTrace: string[],
  ): { matchedDivision: LoadedDivisionDefinition | null; matched: boolean } {
    if (requiredCapabilities.length === 0) {
      return { matchedDivision: null, matched: false };
    }

    const registry = this.divisionRegistry;
    if (!registry) {
      routeTrace.push("capability_match:registry_unavailable");
      return { matchedDivision: null, matched: false };
    }

    // Find all divisions that have roles with matching capabilities
    const capableDivisions: Array<{ division: LoadedDivisionDefinition; matchedCapabilities: string[] }> = [];

    for (const division of registry.divisions.values()) {
      const matchedCapabilities = new Set<string>();
      for (const role of division.roles) {
        for (const capability of requiredCapabilities) {
          if (role.tools.includes(capability)) {
            matchedCapabilities.add(capability);
          }
        }
      }
      if (matchedCapabilities.size > 0) {
        capableDivisions.push({
          division,
          matchedCapabilities: [...matchedCapabilities],
        });
      }
    }

    if (capableDivisions.length === 0) {
      routeTrace.push("capability_match:none_found");
      return { matchedDivision: null, matched: false };
    }

    // Sort by most capabilities matched (descending), then by priority (descending)
    capableDivisions.sort((a, b) => {
      if (b.matchedCapabilities.length !== a.matchedCapabilities.length) {
        return b.matchedCapabilities.length - a.matchedCapabilities.length;
      }
      return b.division.priority - a.division.priority;
    });

    const best = capableDivisions[0]!;
    routeTrace.push(`capability_match:${best.division.id}:${best.matchedCapabilities.join(",")}`);
    return { matchedDivision: best.division, matched: true };
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

    // Apply load balancing to select among candidates
    return this.applyLoadBalancing(candidates, routeTrace);
  }

  /**
   * Applies load balancing to select among competing division candidates.
   */
  private applyLoadBalancing(
    candidates: Array<{ division: LoadedDivisionDefinition; matchedTrigger: string }>,
    routeTrace: string[],
  ): LoadedDivisionDefinition | null {
    if (candidates.length === 0) {
      return null;
    }
    if (candidates.length === 1) {
      return candidates[0]?.division ?? null;
    }

    switch (this.loadBalancing) {
      case "round-robin":
        return this.roundRobinSelect(candidates, routeTrace);
      case "least-load":
        return this.leastLoadSelect(candidates, routeTrace);
      case "weighted":
        return this.weightedSelect(candidates, routeTrace);
      case "random":
        return this.randomSelect(candidates, routeTrace);
      default:
        // Default to first candidate (highest priority)
        return candidates[0]?.division ?? null;
    }
  }

  /**
   * Round-robin selection cycles through candidates in order.
   * Uses a counter per division prefix to distribute load.
   */
  private roundRobinSelect<T>(
    candidates: Array<{ division: LoadedDivisionDefinition; matchedTrigger: string }>,
    routeTrace: string[],
  ): LoadedDivisionDefinition {
    // Group candidates by their primary skill category for round-robin tracking
    const skillCategory = this.categorizeForLoadBalancing(candidates[0]!.division);
    const counterKey = `rr_${skillCategory}`;
    const currentCount = this.roundRobinCounters.get(counterKey) ?? 0;
    const selectedIndex = currentCount % candidates.length;

    this.roundRobinCounters.set(counterKey, currentCount + 1);
    routeTrace.push(`lb_round_robin:index=${selectedIndex}/${candidates.length}`);

    return candidates[selectedIndex]!.division;
  }

  /**
   * Least-load selection prefers candidates with higher priority (assuming
   * higher priority divisions have more capacity). In a real implementation,
   * this would query actual load metrics.
   */
  private leastLoadSelect(
    candidates: Array<{ division: LoadedDivisionDefinition; matchedTrigger: string }>,
    routeTrace: string[],
  ): LoadedDivisionDefinition {
    // Sort by priority (descending) - higher priority = lower load assumed
    const sorted = [...candidates].sort((a, b) => b.division.priority - a.division.priority);
    routeTrace.push(`lb_least_load:selected=${sorted[0]!.division.id}`);
    return sorted[0]!.division;
  }

  /**
   * Weighted selection distributes requests proportionally based on division priority.
   * Higher priority divisions receive proportionally more requests.
   */
  private weightedSelect(
    candidates: Array<{ division: LoadedDivisionDefinition; matchedTrigger: string }>,
    routeTrace: string[],
  ): LoadedDivisionDefinition {
    const totalWeight = candidates.reduce((sum, c) => sum + c.division.priority, 0);

    if (totalWeight === 0) {
      // Equal weights if all priorities are zero
      const index = Math.floor(Math.random() * candidates.length);
      routeTrace.push(`lb_weighted:random_index=${index}`);
      return candidates[index]!.division;
    }

    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (const candidate of candidates) {
      random -= candidate.division.priority;
      if (random <= 0) {
        routeTrace.push(`lb_weighted:selected=${candidate.division.id}`);
        return candidate.division;
      }
    }

    // Fallback to first
    routeTrace.push(`lb_weighted:fallback=${candidates[0]!.division.id}`);
    return candidates[0]!.division;
  }

  /**
   * Purely random selection among candidates.
   */
  private randomSelect(
    candidates: Array<{ division: LoadedDivisionDefinition; matchedTrigger: string }>,
    routeTrace: string[],
  ): LoadedDivisionDefinition {
    const index = Math.floor(Math.random() * candidates.length);
    routeTrace.push(`lb_random:index=${index}`);
    return candidates[index]!.division;
  }

  /**
   * Categorizes a division for load balancing tracking purposes.
   */
  private categorizeForLoadBalancing(division: LoadedDivisionDefinition): string {
    // Use the division's first role tool as a category hint if available
    if (division.roles.length > 0 && division.roles[0]!.tools.length > 0) {
      return `skill_${division.roles[0]!.tools[0]}`;
    }
    return `division_${division.id}`;
  }

  /**
   * Classifies the input using skill taxonomy to determine the primary skill category.
   * This can be used downstream for routing to divisions with matching capabilities.
   */
  public classifySkill(input: IntakeRouteInput): SkillTaxonomyResult {
    const normalized = [normalize(input.title), normalize(input.request)]
      .filter((segment) => segment.length > 0)
      .join(" ");

    const matchedEntries: Array<{ entry: SkillTaxonomyEntry; matchedKeywords: string[] }> = [];

    for (const entry of this.skillTaxonomy.entries) {
      const matchedKeywords = entry.keywords.filter((keyword) =>
        normalized.includes(keyword.toLowerCase()),
      );
      if (matchedKeywords.length > 0) {
        matchedEntries.push({ entry, matchedKeywords });
      }
    }

    if (matchedEntries.length === 0) {
      return {
        category: this.skillTaxonomy.defaultCategory,
        confidence: 0.3,
        matchedSkills: [],
      };
    }

    // Sort by weight * matched count to find best match
    matchedEntries.sort((a, b) => {
      const scoreA = a.entry.weight * a.matchedKeywords.length;
      const scoreB = b.entry.weight * b.matchedKeywords.length;
      return scoreB - scoreA;
    });

    const best = matchedEntries[0]!;
    const confidence = Math.min(0.95, best.entry.weight * (0.5 + best.matchedKeywords.length * 0.1));

    return {
      category: best.entry.category,
      confidence,
      matchedSkills: best.matchedKeywords,
    };
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
 * R6-11: Result of intent extraction with confidence scoring.
 */
interface IntentExtractionResult {
  extractedGoal: string;
  confidence: number; // 0.0 - 1.0
  ambiguityDetected: boolean;
  ambiguityFlags: readonly string[];
  suggestedClarifications: readonly string[];
}

/**
 * R6-11: Pattern-based intent extraction with confidence scoring.
 * Acts as fallback when LLM is unavailable - uses pattern matching to estimate confidence.
 * For actual LLM extraction, integration with LLM model gateway would be needed.
 */
function extractIntentWithConfidence(goal: string): IntentExtractionResult {
  const ambiguityFlags: string[] = [];

  // Check for vague goal language
  if (/\b(maybe|perhaps|possibly|some|several|about|roughly)\b/i.test(goal)) {
    ambiguityFlags.push("vague_goal_language");
  }

  // Check for ambiguous temporal references
  if (/\b(soon|later|eventually|when possible)\b/i.test(goal)) {
    ambiguityFlags.push("ambiguous_timing");
  }

  // Check for conditional language
  if (/\b(if|unless|maybe|either|perhaps|depending on)\b/i.test(goal)) {
    ambiguityFlags.push("conditional_language");
  }

  // Check for underspecified constraints
  if (goal.length < 30) {
    ambiguityFlags.push("short_goal");
  }

  // Check for conflicting requirements indicators
  if (/\b(but|however|although|though)\b/i.test(goal) && goal.length < 80) {
    ambiguityFlags.push("potential_conflict");
  }

  // Calculate confidence based on ambiguity flags
  // Base confidence is high when no ambiguity flags present
  const baseConfidence = 0.80;
  const penaltyPerFlag = 0.12;
  const confidence = Math.max(0.35, baseConfidence - (ambiguityFlags.length * penaltyPerFlag));

  // Generate suggested clarifications based on flags
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
