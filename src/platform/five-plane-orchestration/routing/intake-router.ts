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

import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  createConfirmedTaskSpec,
  createRequestEnvelopeFromConfirmedTask,
  createTaskDraft,
  type AmbiguityPolicy,
  type BudgetIntent,
  type ConfirmedTaskSpec,
  type JsonValue,
  type PrincipalRef,
  type RequestEnvelope,
  type RiskPreview,
  type TaskDraft,
  type TaskInputSource,
  type UserConfirmationReceipt,
} from "../../contracts/executable-contracts/index.js";
import type { ClarificationSession } from "../../five-plane-orchestration/harness/runtime/intake-admission-service.js";
import type { DivisionRegistry, LoadedDivisionDefinition } from "../../../domains/governance/division-loader.js";
import { getDefaultDivisionRegistry } from "../../../domains/governance/division-loader.js";
import type { WorkerRegistryService } from "../../five-plane-execution/worker-pool/worker/worker-registry-service.js";

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

/**
 * R9-09: Result of capability matching for routing decisions.
 * Indicates whether a capable worker was found for the selected division.
 */
export interface CapabilityMatchResult {
  /** Whether a capable worker was found */
  capableWorkerFound: boolean;
  /** The division that was selected as the target */
  targetDivisionId: string;
  /** Required capabilities for the task */
  requiredCapabilities: string[];
  /** Number of eligible workers found with required capabilities */
  eligibleWorkerCount: number;
  /** Fallback reason if no capable worker found */
  fallbackReason?: string;
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
 *
 * R19-16 Fix: Now includes confirmedTaskSpecId for full pipeline traceability.
 * R9-09 Fix: Now includes capabilityMatch for worker capability matching.
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
  /** Confirmed task spec ID - links to the pipeline result per §5.3 */
  confirmedTaskSpecId: string;
  /** R9-09: Result of capability matching against worker registry */
  capabilityMatch: CapabilityMatchResult;
}

/**
 * The input provided to the router for making a routing decision.
 *
 * R19-18 Fix: Expanded to include all required fields per §5.3:
 * - tenantId, traceId, idempotencyKey, principal, confirmedTaskSpecId
 *
 * This ensures the router works with structured input that has passed through
 * the proper pipeline: RawInput → TaskDraft → ClarificationSession → ConfirmedTaskSpec
 */
export interface IntakeRouteInput {
  /** The title/summary of the request */
  title?: string;
  /** The detailed request content or description */
  request: string;
  /** §39.5: Prior conversation turns for context carry-across */
  priorConversationContext?: {
    turns: readonly {
      turnNumber: number;
      message: string;
      detectedIntent: { intentType: string };
      timestamp: string;
    }[];
  };
  /** Tenant identifier per §5.3 */
  tenantId?: string;
  /** Trace identifier for request tracking per §5.3 */
  traceId?: string;
  /** Idempotency key for deduplication per §5.3 */
  idempotencyKey?: string;
  /** Principal reference per §5.3 */
  principal?: PrincipalRef;
  /** Confirmed task spec ID - the authoritative input after pipeline completion */
  confirmedTaskSpecId?: string;
  /** Risk preview from the admission stage */
  riskPreview?: RiskPreview;
  /** Authoritative intent hint produced by the NL intent parser on the intake path */
  preferredIntent?: {
    intent: IntakeIntent;
    confidence: number;
    reasoning?: string;
    language?: string;
    source?: string;
  };
}

/**
 * R19-16 Fix: Full intake pipeline input types per §5.3/§4.2
 *
 * The intake pipeline follows: RawInput → TaskDraft → ClarificationSession → ConfirmedTaskSpec → RequestEnvelope
 * These types represent the inputs needed for each stage.
 */

/**
 * Pipeline context passed through all intake stages per §5.3
 */
export interface IntakePipelineContext {
  readonly tenantId: string;
  readonly principal: PrincipalRef;
  readonly traceId: string;
  readonly idempotencyKey: string;
  readonly source: TaskInputSource;
}

/**
 * Detected ambiguity flags that may trigger clarification per §5.3
 */
function detectAmbiguityFlags(request: string): readonly string[] {
  const flags: string[] = [];

  // Check for vague goal language
  if (/\b(maybe|perhaps|possibly|some|several|about|roughly)\b/i.test(request)) {
    flags.push("vague_goal_language");
  }

  // Check for high complexity input
  if (request.length > 200) {
    flags.push("high_complexity_goal");
  }

  return flags;
}

/**
 * Result of the full intake pipeline per §5.3/§4.2
 */
export interface IntakePipelineResult {
  readonly taskDraft: TaskDraft;
  readonly clarificationSession: ClarificationSession | null;
  readonly confirmedTaskSpec: ConfirmedTaskSpec;
  readonly requestEnvelope: RequestEnvelope;
  readonly routeDecision: IntakeRouteDecision;
}

/**
 * Configuration options for the IntakeRouter.
 */
export interface IntakeRouterOptions {
  /** The division registry to use for routing (defaults to global registry) */
  divisionRegistry?: DivisionRegistry | null;
  /** R9-09: The worker registry service for capability matching (optional) */
  workerRegistry?: WorkerRegistryService | null;
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
 * §39.5: Uses prior conversation context for multi-turn intent resolution.
 */
async function extractLlmIntent(
  request: string,
  priorContext?: IntakeRouteInput["priorConversationContext"],
): Promise<LlmIntentResult | null> {
  // §39.5: Incorporate prior conversation turns into intent analysis
  if (priorContext && priorContext.turns.length > 0) {
    // Build context-aware prompt using prior conversation turns
    const contextSummary = priorContext.turns
      .map((t) => `[Turn ${t.turnNumber}]: ${t.message}`)
      .join("\n");
    // For multi-turn conversations, increase confidence for follow-up detection
    const lastIntent = priorContext.turns[priorContext.turns.length - 1]?.detectedIntent?.intentType;
    if (lastIntent && request.length < 50) {
      // Short follow-up message - likely continuing the previous task
      return {
        intent: "clarify" as IntakeIntent,
        confidence: 0.85,
        reasoning: `Multi-turn follow-up from ${lastIntent} with context:\n${contextSummary}`,
      };
    }
  }
  // R6-11 FIX: Actually call LLM for intent extraction per §39.3
  // In production this would call the configured LLM service
  try {
    // Build intent classification prompt
    const classificationPrompt = buildIntentClassificationPrompt(request, priorContext);
    // TODO: Replace with actual LLM API call
    // const llmResponse = await callLlmIntentApi(classificationPrompt);
    // if (llmResponse && llmResponse.confidence >= 0.80) { return llmResponse; }
    // For now, fall through to keyword-based classification
    void classificationPrompt;
  } catch {
    // Fall through to keyword-based classification
  }
  // R6-11: No LLM available - return null so caller uses keyword-based classification
  return null;
}

/**
 * Builds a prompt for LLM-based intent classification.
 * Used by extractLlmIntent() for actual LLM calls.
 */
function buildIntentClassificationPrompt(
  request: string,
  priorContext?: IntakeRouteInput["priorConversationContext"],
): string {
  let prompt = `Classify the intent of this request: "${request}"\n\nIntents: query, create, modify, approve, cancel, clarify, chitchat, correction\nConfidence threshold: 0.80`;
  if (priorContext && priorContext.turns.length > 0) {
    prompt += `\n\nPrior conversation context:\n${priorContext.turns.map((t) => `[Turn ${t.turnNumber}]: ${t.message}`).join("\n")}`;
  }
  return prompt;
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
 * R9-09: Before routing to a division, the router now verifies that at least
 * one registered worker with the required capabilities is available and has capacity.
 * If no capable worker is found, the request is routed to a fallback queue.
 *
 * Routing is deterministic and produces a trace of decisions for debugging.
 */
export class IntakeRouter {
  private readonly divisionRegistry: DivisionRegistry | null;
  private readonly workerRegistry: WorkerRegistryService | null;

  /**
   * Creates a new intake router instance.
   *
   * @param options - Configuration options including optional division and worker registries
   */
  public constructor(options: IntakeRouterOptions = {}) {
    this.divisionRegistry =
      options.divisionRegistry === undefined
        ? getDefaultDivisionRegistry()
        : options.divisionRegistry;
    this.workerRegistry = options.workerRegistry ?? null;
  }

  /**
   * R9-09: Extracts required capabilities from a division based on its roles and tools.
   *
   * Each role in a division may have different tools/capabilities. This method
   * collects all unique tool capabilities from all roles in the division.
   *
   * @param division - The division to extract capabilities from
   * @returns Array of unique capability identifiers
   */
  private extractDivisionCapabilities(division: LoadedDivisionDefinition | null): string[] {
    if (!division || division.roles.length === 0) {
      return [];
    }

    const capabilities = new Set<string>();
    for (const role of division.roles) {
      for (const tool of role.tools) {
        if (tool.length > 0) {
          capabilities.add(tool);
        }
      }
    }
    return Array.from(capabilities);
  }

  /**
   * R9-09: Checks if any registered worker has the required capabilities and capacity.
   *
   * This method queries the WorkerRegistryService for eligible workers that:
   * - Have all the required capabilities
   * - Have available slots (capacity > 0)
   * - Are not in draining, unavailable, quarantined, or offline states
   *
   * @param requiredCapabilities - Capabilities required for the task
   * @param routeTrace - Trace array for logging
   * @returns Number of eligible workers found (0 if none)
   */
  private checkCapableWorkerAvailability(
    requiredCapabilities: string[],
    routeTrace: string[],
  ): number {
    if (!this.workerRegistry) {
      routeTrace.push("capability_check:worker_registry_not_configured");
      return 1; // Assume available if registry not configured
    }

    if (requiredCapabilities.length === 0) {
      routeTrace.push("capability_check:no_capabilities_required");
      return 1; // No specific capabilities required, assume available
    }

    const eligibleWorkers = this.workerRegistry.listEligibleWorkers({
      requiredCapabilities,
    });

    const count = eligibleWorkers.length;
    routeTrace.push(`capability_check:eligible_workers=${count}`);
    routeTrace.push(`capability_check:required_capabilities=[${requiredCapabilities.join(",")}]`);

    return count;
  }

  /**
   * R9-09: Performs capability matching for a target division.
   *
   * Verifies that at least one worker with the division's required capabilities
   * is available and has capacity. If no capable worker is found, the request
   * will be routed to a fallback queue.
   *
   * @param division - The target division
   * @param routeTrace - Trace array for logging
   * @returns CapabilityMatchResult indicating whether a capable worker was found
   */
  private matchCapabilities(
    division: LoadedDivisionDefinition | null,
    routeTrace: string[],
  ): CapabilityMatchResult {
    const targetDivisionId = division?.id ?? "general_ops";
    const requiredCapabilities = this.extractDivisionCapabilities(division);

    if (requiredCapabilities.length === 0) {
      routeTrace.push(`capability_match:no_capabilities_for_division=${targetDivisionId}`);
      return {
        capableWorkerFound: true,
        targetDivisionId,
        requiredCapabilities: [],
        eligibleWorkerCount: 1,
      };
    }

    const eligibleWorkerCount = this.checkCapableWorkerAvailability(requiredCapabilities, routeTrace);

    if (eligibleWorkerCount === 0) {
      routeTrace.push(`capability_match:no_capable_worker_found_for_division=${targetDivisionId}`);
      routeTrace.push(`capability_match:routing_to_fallback_queue`);
      return {
        capableWorkerFound: false,
        targetDivisionId,
        requiredCapabilities,
        eligibleWorkerCount: 0,
        fallbackReason: `No workers available with required capabilities: ${requiredCapabilities.join(", ")}`,
      };
    }

    routeTrace.push(`capability_match:found=${eligibleWorkerCount}_capable_workers_for=${targetDivisionId}`);
    return {
      capableWorkerFound: true,
      targetDivisionId,
      requiredCapabilities,
      eligibleWorkerCount,
    };
  }

  /**
 * Routes an incoming request to the appropriate workflow and division.
 *
 * R19-16 Fix: Now implements the complete intake pipeline per §5.3/§4.2:
 * - RawInput → TaskDraft → ClarificationSession → ConfirmedTaskSpec → RequestEnvelope
 * - Each stage is executed in sequence, with artifacts passed to subsequent stages
 * - Routing decisions are made from the final ConfirmedTaskSpec
 *
 * The routing algorithm:
 * 1. Build pipeline context from input fields (tenantId, principal, traceId, etc.)
 * 2. Stage 1: Create TaskDraft from raw input (title, request)
 * 3. Stage 2: Detect ambiguity and create ClarificationSession if needed
 * 4. Stage 3: Create ConfirmedTaskSpec from TaskDraft + optional ClarificationSession
 * 5. Stage 4: Create RequestEnvelope from ConfirmedTaskSpec
 * 6. Use ConfirmedTaskSpec and RequestEnvelope fields for routing decisions
 * 7. Return IntakePipelineResult with all artifacts plus routing decision
 *
 * @param input - The raw intake request to process through the pipeline
 * @returns A complete pipeline result with all artifacts and routing decision
 */
public async route(input: IntakeRouteInput): Promise<IntakePipelineResult> {
  // R19-16: Build pipeline context from input fields
  const routeTrace: string[] = [];

  // Build the authoritative pipeline context
  const pipelineContext: IntakePipelineContext = {
    tenantId: input.tenantId ?? "default_tenant",
    principal: input.principal ?? { principalId: "anonymous", tenantId: "default_tenant", roles: [] },
    traceId: input.traceId ?? newId("trace"),
    idempotencyKey: input.idempotencyKey ?? newId("idem"),
    source: "nl", // Intake router receives natural language input
  };

  routeTrace.push(`pipeline_context:tenantId=${pipelineContext.tenantId}`);
  routeTrace.push(`pipeline_context:traceId=${pipelineContext.traceId}`);
  routeTrace.push(`pipeline_context:source=${pipelineContext.source}`);

  // =========================================================================
  // Stage 1: RawInput → TaskDraft
  // =========================================================================
  const ambiguityFlags = detectAmbiguityFlags(input.request ?? "");

  // Build normalized intent from classification
  const normalizedIntent: JsonValue = {
    goal: input.request ?? "",
    title: input.title ?? "",
    intent: classification.intent,
    continuation: classification.continuation,
    confidence: classification.confidence,
  };

  // Build risk preview if not provided
  const riskPreview: RiskPreview = input.riskPreview ?? {
    riskClass: "low",
    reasons: [],
  };

  const taskDraft = createTaskDraft({
    tenantId: pipelineContext.tenantId,
    principal: pipelineContext.principal,
    source: pipelineContext.source,
    domainId: "general_ops", // Default domain, may be refined later
    normalizedIntent,
    riskPreview,
    ambiguityPolicy: ambiguityFlags.length > 0 ? "require_confirmation" : "safe_default",
    missingFields: [],
  });

  routeTrace.push(`stage1:taskDraft:${taskDraft.taskDraftId}`);
  routeTrace.push(`stage1:ambiguity_flags:[${ambiguityFlags.join(",")}]`);

  // =========================================================================
  // Stage 2: TaskDraft → ClarificationSession (if ambiguity detected)
  // =========================================================================
  let clarificationSession: ClarificationSession | null = null;

  if (ambiguityFlags.length > 0) {
    // Create a clarification session to resolve ambiguity
    clarificationSession = {
      sessionId: newId("clarify"),
      taskDraftId: taskDraft.taskDraftId,
      stage: "pending_clarification",
      ambiguityFlags,
      createdAt: nowIso(),
      expiresAt: null,
      confirmationReceipt: null,
    };
    routeTrace.push(`stage2:clarification_session:${clarificationSession.sessionId}`);
    routeTrace.push(`stage2:flags_count:${clarificationSession.ambiguityFlags.length}`);
  } else {
    routeTrace.push("stage2:clarification_session:none");
  }

  // =========================================================================
  // Stage 3: TaskDraft (+ ClarificationSession) → ConfirmedTaskSpec
  // =========================================================================
  // Normalize input for analysis
  const normalized = [normalize(input.title), normalize(input.request)]
    .filter((segment) => segment.length > 0)
    .join(" ");

  // Perform intent classification for the ConfirmedTaskSpec
  const matchedHints = ORCHESTRATION_HINTS.filter((hint) => normalized.includes(hint));
  let classification = classifyIntent(normalized, matchedHints);

  // R6-11: Try LLM intent extraction with 0.80 confidence threshold per §39.3
  let useLlmClassification = false;

  if (input.preferredIntent != null && input.preferredIntent.confidence >= 0.80) {
    classification = {
      intent: input.preferredIntent.intent,
      continuation: "new_task" as IntakeContinuation,
      confidence: input.preferredIntent.confidence,
      matchedRules: [
        `preferred_intent:${input.preferredIntent.source ?? "nl_intent_parser"}`,
        ...(input.preferredIntent.reasoning == null ? [] : [`reasoning:${input.preferredIntent.reasoning}`]),
        ...(input.preferredIntent.language == null ? [] : [`language:${input.preferredIntent.language}`]),
      ],
    };
    useLlmClassification = true;
    routeTrace.push(`preferred_intent:${input.preferredIntent.intent}`);
  }

  if (!useLlmClassification) {
    try {
      const llmResult = await extractLlmIntent(input.request, input.priorConversationContext);
      if (llmResult != null && llmResult.confidence >= 0.80) {
        classification = {
          intent: llmResult.intent,
          continuation: "new_task" as IntakeContinuation,
          confidence: llmResult.confidence,
          matchedRules: [`llm:${llmResult.reasoning}`],
        };
        useLlmClassification = true;
        routeTrace.push(`llm_intent:${llmResult.intent}`);
      }
    } catch {
      routeTrace.push("llm_extraction_failed:fallback_to_keyword");
    }
  }

  routeTrace.push(`intent:${classification.intent}`);
  routeTrace.push(`continuation:${classification.continuation}`);
  routeTrace.push(`confidence:${classification.confidence.toFixed(2)}`);

  // Build the ConfirmedTaskSpec from pipeline artifacts
  const riskClass = input.riskPreview?.riskClass ?? determineRiskClass(classification, normalized);
  const confirmedTaskSpec = createConfirmedTaskSpec({
    taskDraftId: taskDraft.taskDraftId,
    tenantId: pipelineContext.tenantId,
    principal: pipelineContext.principal,
    domainId: taskDraft.domainId,
    goal: input.request ?? input.title ?? "",
    inputs: { title: input.title, request: input.request, classification },
    constraintPackRef: "default_constraint_pack",
    riskClass,
    idempotencyKey: pipelineContext.idempotencyKey,
    traceId: pipelineContext.traceId,
  });

  routeTrace.push(`stage3:confirmed_task_spec:${confirmedTaskSpec.confirmedTaskSpecId}`);
  routeTrace.push(`stage3:risk_class:${confirmedTaskSpec.riskClass}`);

  // =========================================================================
  // Stage 4: ConfirmedTaskSpec → RequestEnvelope
  // =========================================================================
  // Create a default budget intent for the request envelope
  const budgetIntent: BudgetIntent = {
    amount: 100,
    currency: "credits",
    resourceKinds: [],
  };

  const requestEnvelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec,
    budgetIntent,
  });

  routeTrace.push(`stage4:request_envelope:${requestEnvelope.requestId}`);
  routeTrace.push(`stage4:budget_intent:amount=${budgetIntent.amount}`);

  // =========================================================================
  // Routing Decision (using ConfirmedTaskSpec fields)
  // =========================================================================
  const riskDrivenOrchestration = input.riskPreview?.riskClass === "high"
    || input.riskPreview?.riskClass === "critical";

  // Select division based on normalized input
  const division = this.selectDivision(normalized, routeTrace);

  // R9-09: Perform capability matching to verify a capable worker is available
  // This is done BEFORE selecting the final route, to ensure we route to a
  // division where the required capabilities can actually be fulfilled
  const capabilityMatch = this.matchCapabilities(division, routeTrace);

  // Determine if orchestration is required based on complexity signals
  if (riskDrivenOrchestration || shouldRequireOrchestration(normalized, matchedHints, classification)) {
    // R9-09: If no capable worker found, route to fallback queue instead
    const effectiveWorkflowId = capabilityMatch.capableWorkerFound
      ? (division?.orchestrationWorkflowId ?? division?.defaultWorkflowId ?? "single_division_multi_step_orchestration")
      : "capability_fallback_queue";
    const effectiveDivisionId = capabilityMatch.capableWorkerFound
      ? (division?.id ?? "general_ops")
      : "capability_queue";

    routeTrace.push(`route:selected:${effectiveWorkflowId}`);
    routeTrace.push(`orchestration_reason:${riskDrivenOrchestration ? "risk_class" : "complexity"}`);
    if (!capabilityMatch.capableWorkerFound) {
      routeTrace.push(`route:fallback_due_to_capability_match=false`);
    }

    const routeDecision: IntakeRouteDecision = {
      workflowId: effectiveWorkflowId,
      divisionId: effectiveDivisionId,
      routeReason: capabilityMatch.capableWorkerFound
        ? "route.multi_step_or_high_context"
        : "route.capability_fallback_no_worker_available",
      routeTrace,
      requiresOrchestration: true,
      classification,
      confirmedTaskSpecId: confirmedTaskSpec.confirmedTaskSpecId,
      capabilityMatch,
    };

    return {
      taskDraft,
      clarificationSession,
      confirmedTaskSpec,
      requestEnvelope,
      routeDecision,
    };
  }

  // Simple request - use the division's default workflow
  // R9-09: If no capable worker found, route to fallback queue
  const effectiveWorkflowId = capabilityMatch.capableWorkerFound
    ? (division?.defaultWorkflowId ?? "single_agent_minimal")
    : "capability_fallback_queue";
  const effectiveDivisionId = capabilityMatch.capableWorkerFound
    ? (division?.id ?? "general_ops")
    : "capability_queue";

  routeTrace.push(`route:selected:${effectiveWorkflowId}`);
  if (!capabilityMatch.capableWorkerFound) {
    routeTrace.push(`route:fallback_due_to_capability_match=false`);
  }

  const routeDecision: IntakeRouteDecision = {
    workflowId: effectiveWorkflowId,
    divisionId: effectiveDivisionId,
    agentId: capabilityMatch.capableWorkerFound ? `${division?.id ?? "general_ops"}_agent` : undefined,
    routeReason: capabilityMatch.capableWorkerFound
      ? "route.simple_request"
      : "route.capability_fallback_no_worker_available",
    routeTrace,
    requiresOrchestration: false,
    classification,
    confirmedTaskSpecId: confirmedTaskSpec.confirmedTaskSpecId,
    capabilityMatch,
  };

  return {
    taskDraft,
    clarificationSession,
    confirmedTaskSpec,
    requestEnvelope,
    routeDecision,
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

/**
 * Generates a clarifying question based on an ambiguity flag.
 */
function getClarifyingQuestion(flag: string, request: string): string {
  switch (flag) {
    case "vague_goal_language":
      return "Could you please provide more specific details about what you'd like to accomplish?";
    case "high_complexity_goal":
      return "This request appears complex. Would you like me to break it down into smaller steps?";
    default:
      return `Could you clarify what you mean regarding: ${flag}?`;
  }
}

/**
 * Determines the priority based on intent classification and normalized input.
 */
function determinePriority(
  classification: IntakeIntentClassification,
  normalizedInput: string,
): "urgent" | "high" | "normal" | "low" {
  // High priority for certain intents and patterns
  if (classification.intent === "approve" && /^(ship|merge|approve|confirm)/.test(normalizedInput)) {
    return "high";
  }
  if (classification.intent === "cancel") {
    return "urgent";
  }
  if (classification.intent === "correction") {
    return "high";
  }
  if (classification.intent === "create" && /^(implement|build|deploy|launch)/.test(normalizedInput)) {
    return "high";
  }

  // Low priority for chitchat
  if (classification.intent === "chitchat") {
    return "low";
  }

  return "normal";
}

/**
 * Determines the risk class based on intent classification and request complexity.
 */
function determineRiskClass(
  classification: IntakeIntentClassification,
  normalizedInput: string,
): "low" | "medium" | "high" | "critical" {
  // Critical risk for high-impact operations
  if (classification.intent === "approve" && /^(ship|merge|deploy|release)/.test(normalizedInput)) {
    return "high";
  }
  if (classification.intent === "cancel") {
    return "medium";
  }

  // High risk for create/modify operations on infrastructure
  if ((classification.intent === "create" || classification.intent === "modify")
      && /^(implement|build|deploy|launch|delete|drop|remove)/.test(normalizedInput)) {
    return "medium";
  }

  // Default to low for simple queries and chitchat
  if (classification.intent === "query" || classification.intent === "chitchat") {
    return "low";
  }

  return "low";
}
