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
import {
  BUILT_IN_SKILL_TAXONOMY,
  CONFIDENCE_THRESHOLD,
  ORCHESTRATION_HINTS,
  classifyIntent,
  extractIntentWithConfidence,
  findMatchedTrigger,
  normalize,
  shouldRequireOrchestration,
  withOptionalConfirmedTaskSpecId,
} from "./intake-router-model.js";
import type {
  IntakeIntent,
  IntakeIntentClassification,
  IntakeRouteDecision,
  IntakeRouteInput,
  IntakeRouterOptions,
  LoadBalancedSelection,
  LoadBalancingStrategy,
  SkillTaxonomy,
  SkillTaxonomyEntry,
  SkillTaxonomyResult,
} from "./intake-router-model.js";
export type {
  IntakeContinuation,
  IntakeIntent,
  IntakeIntentClassification,
  IntakeRouteDecision,
  IntakeRouteInput,
  IntakeRouterOptions,
  LoadBalancingStrategy,
  SkillCategory,
  SkillTaxonomy,
  SkillTaxonomyEntry,
  SkillTaxonomyResult,
} from "./intake-router-model.js";

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
    if (input.tenantId != null && input.tenantId.length > 0) {
      routeTrace.push(`tenantId:${input.tenantId}`);
      routeTrace.push(`pipeline_context:tenantId=${input.tenantId}`);
    }
    if (input.traceId != null && input.traceId.length > 0) {
      routeTrace.push(`traceId:${input.traceId}`);
      routeTrace.push(`pipeline_context:traceId=${input.traceId}`);
    }
    if (input.principal?.principalId != null && input.principal.principalId.length > 0) {
      routeTrace.push(`principalId:${input.principal.principalId}`);
      routeTrace.push(`pipeline_context:principalId=${input.principal.principalId}`);
    }
    if (input.confirmedTaskSpecId != null && input.confirmedTaskSpecId.length > 0) {
      routeTrace.push(`confirmedTaskSpecId:${input.confirmedTaskSpecId}`);
    }
    if (input.riskPreview != null) {
      routeTrace.push(`risk_class:${input.riskPreview.riskClass}`);
      routeTrace.push(`riskClass:${input.riskPreview.riskClass}`);
      if ((input.riskPreview.reasons ?? []).length > 0) {
        routeTrace.push(`risk_reasons:${input.riskPreview.reasons!.join(",")}`);
      }
    }

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
    if (input.preferredIntent != null && input.preferredIntent.confidence >= CONFIDENCE_THRESHOLD) {
      finalClassification = {
        intent: input.preferredIntent.intent,
        continuation: classification.continuation,
        confidence: Number(Math.min(0.99, input.preferredIntent.confidence).toFixed(2)),
        matchedRules: classification.matchedRules,
      };
      routeTrace.push(`preferred_intent:${input.preferredIntent.intent}:${input.preferredIntent.confidence.toFixed(2)}`);
    }
    if (finalClassification === classification && classification.confidence < CONFIDENCE_THRESHOLD) {
      // Use LLM extraction for low-confidence classification
      const llmExtraction = extractIntentWithConfidence(normalized);
      routeTrace.push(`llm_extraction:attempted`);
      routeTrace.push(`llm_confidence:${llmExtraction.confidence.toFixed(2)}`);
      routeTrace.push(`ambiguity_flags:${llmExtraction.ambiguityFlags.join(",") || "none"}`);

      // Only use LLM extraction if it has higher confidence AND we have some rules/hints matched
      // When no rules or hints matched, LLM extraction's "confidence" is misleading - it only
      // indicates lack of ambiguity, not actual intent knowledge
      const hasSomeMatchedSignals = classification.matchedRules.length > 0 || matchedHints.length > 0;
      finalClassification = {
        ...finalClassification,
        ambiguityDetected: llmExtraction.ambiguityDetected,
        ambiguityFlags: llmExtraction.ambiguityFlags,
        suggestedClarifications: llmExtraction.suggestedClarifications,
      };
      if (llmExtraction.confidence > classification.confidence && hasSomeMatchedSignals) {
        finalClassification = {
          intent: classification.intent, // Keep keyword-based intent for safety
          continuation: classification.continuation,
          confidence: llmExtraction.confidence,
          matchedRules: classification.matchedRules,
          ambiguityDetected: llmExtraction.ambiguityDetected,
          ambiguityFlags: llmExtraction.ambiguityFlags,
          suggestedClarifications: llmExtraction.suggestedClarifications,
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
    if (shouldRequireOrchestration(normalized, matchedHints, finalClassification, input.riskPreview?.riskClass)) {
      // Use orchestration workflow (specific or fallback)
      const workflowId = division?.orchestrationWorkflowId ?? division?.defaultWorkflowId ?? "single_division_multi_step_orchestration";
      routeTrace.push(`route:selected:${workflowId}`);
      routeTrace.push(`capability_match:${capabilityMatchResult.matched ? "yes" : "no"}`);
      return materializePipelineContext(withOptionalConfirmedTaskSpecId({
        workflowId,
        divisionId: division?.id ?? "general_ops",
        routeReason: capabilityMatchResult.matched ? "route.capability_match" : "route.multi_step_or_high_context",
        routeTrace,
        requiresOrchestration: true,
        classification: finalClassification,
      }, input.confirmedTaskSpecId), input, normalized);
    }

    // Simple request - use the division's default workflow
    const workflowId = division?.defaultWorkflowId ?? "single_agent_minimal";
    routeTrace.push(`route:selected:${workflowId}`);
    routeTrace.push(`capability_match:${capabilityMatchResult.matched ? "yes" : "no"}`);
    return materializePipelineContext(withOptionalConfirmedTaskSpecId({
      workflowId,
      divisionId: division?.id ?? "general_ops",
      agentId: `${division?.id ?? "general_ops"}_agent`,
      routeReason: capabilityMatchResult.matched ? "route.capability_match" : "route.simple_request",
      routeTrace,
      requiresOrchestration: false,
      classification: finalClassification,
    }, input.confirmedTaskSpecId), input, normalized);
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
      case "capacity-aware":
        return this.capacityAwareSelect(candidates, routeTrace);
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
    const firstCandidate = candidates[0];
    if (firstCandidate == null) {
      throw new Error("intake_router.round_robin_requires_candidate");
    }
    // Group candidates by their primary skill category for round-robin tracking
    const skillCategory = this.categorizeForLoadBalancing(firstCandidate.division);
    const counterKey = `rr_${skillCategory}`;
    const currentCount = this.roundRobinCounters.get(counterKey) ?? 0;
    const selectedIndex = currentCount % candidates.length;
    const selectedCandidate = candidates[selectedIndex];
    if (selectedCandidate == null) {
      throw new Error("intake_router.round_robin_selection_missing");
    }

    this.roundRobinCounters.set(counterKey, currentCount + 1);
    routeTrace.push(`lb_round_robin:index=${selectedIndex}/${candidates.length}`);

    return selectedCandidate.division;
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
    const selected = sorted[0];
    if (selected == null) {
      throw new Error("intake_router.least_load_requires_candidate");
    }
    routeTrace.push(`lb_least_load:selected=${selected.division.id}`);
    return selected.division;
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
      const selected = candidates[index];
      if (selected == null) {
        throw new Error("intake_router.weighted_random_selection_missing");
      }
      routeTrace.push(`lb_weighted:random_index=${index}`);
      return selected.division;
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
    const firstCandidate = candidates[0];
    if (firstCandidate == null) {
      throw new Error("intake_router.weighted_requires_candidate");
    }
    routeTrace.push(`lb_weighted:fallback=${firstCandidate.division.id}`);
    return firstCandidate.division;
  }

  /**
   * Purely random selection among candidates.
   */
  private randomSelect(
    candidates: Array<{ division: LoadedDivisionDefinition; matchedTrigger: string }>,
    routeTrace: string[],
  ): LoadedDivisionDefinition {
    const index = Math.floor(Math.random() * candidates.length);
    const selected = candidates[index];
    if (selected == null) {
      throw new Error("intake_router.random_selection_missing");
    }
    routeTrace.push(`lb_random:index=${index}`);
    return selected.division;
  }

  /**
   * Capacity-aware selection distributes requests based on actual available capacity.
   * Capacity is calculated as the sum of maxInstances across all roles in a division.
   * Divisions with higher capacity (more concurrent instances) receive proportionally more requests.
   */
  private capacityAwareSelect(
    candidates: Array<{ division: LoadedDivisionDefinition; matchedTrigger: string }>,
    routeTrace: string[],
  ): LoadedDivisionDefinition {
    // Calculate total capacity as sum of maxInstances across all roles
    // null maxInstances means unlimited, treat as very high number
    const getCapacity = (division: LoadedDivisionDefinition): number => {
      return division.roles.reduce((sum, role) => {
        if (role.maxInstances == null) {
          // Unlimited capacity - use a large number
          return sum + 1000;
        }
        return sum + role.maxInstances;
      }, 0);
    };

    const capacities = candidates.map((c) => getCapacity(c.division));
    const totalCapacity = capacities.reduce((sum, cap) => sum + cap, 0);

    if (totalCapacity === 0) {
      // All capacities are zero or null - fall back to priority-based selection
      const sorted = [...candidates].sort((a, b) => b.division.priority - a.division.priority);
      const selected = sorted[0];
      if (selected == null) {
        throw new Error("intake_router.capacity_fallback_requires_candidate");
      }
      routeTrace.push(`lb_capacity_aware:fallback_priority=${selected.division.id}`);
      return selected.division;
    }

    // Weighted random selection based on capacity
    let random = Math.random() * totalCapacity;
    for (let i = 0; i < candidates.length; i++) {
      const capacity = capacities[i] ?? 0;
      random -= capacity;
      if (random <= 0) {
        const selected = candidates[i];
        if (selected == null) {
          throw new Error("intake_router.capacity_selection_missing");
        }
        routeTrace.push(`lb_capacity_aware:selected=${selected.division.id}:capacity=${capacity}`);
        return selected.division;
      }
    }

    // Fallback to first candidate
    const firstCandidate = candidates[0];
    if (firstCandidate == null) {
      throw new Error("intake_router.capacity_requires_candidate");
    }
    routeTrace.push(`lb_capacity_aware:fallback=${firstCandidate.division.id}`);
    return firstCandidate.division;
  }

  /**
   * Categorizes a division for load balancing tracking purposes.
   */
  private categorizeForLoadBalancing(division: LoadedDivisionDefinition): string {
    // Use the division's first role tool as a category hint if available
    const firstRole = division.roles[0];
    if (firstRole && firstRole.tools.length > 0) {
      return `skill_${firstRole.tools[0]}`;
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

function materializePipelineContext(
  decision: IntakeRouteDecision,
  input: IntakeRouteInput,
  normalized: string,
): IntakeRouteDecision {
  const seed = stableIdSeed(input);
  const taskDraft = {
    taskDraftId: `draft:${seed}`,
    ...(input.title != null ? { title: input.title } : {}),
    request: input.request,
    ...(input.tenantId != null ? { tenantId: input.tenantId } : {}),
    ...(input.principal != null ? { principal: input.principal } : {}),
  };
  const confirmedTaskSpec = {
    confirmedTaskSpecId: input.confirmedTaskSpecId ?? `ctspec:${seed}`,
    taskDraftId: taskDraft.taskDraftId,
    ...(input.tenantId != null ? { tenantId: input.tenantId } : {}),
    ...(input.traceId != null ? { traceId: input.traceId } : {}),
    ...(input.idempotencyKey != null ? { idempotencyKey: input.idempotencyKey } : {}),
  };
  const requestEnvelope = {
    requestEnvelopeId: `request:${seed}`,
    confirmedTaskSpecId: confirmedTaskSpec.confirmedTaskSpecId,
    ...(input.tenantId != null ? { tenantId: input.tenantId } : {}),
    ...(input.traceId != null ? { traceId: input.traceId } : {}),
    ...(input.idempotencyKey != null ? { idempotencyKey: input.idempotencyKey } : {}),
  };
  decision.confirmedTaskSpecId = confirmedTaskSpec.confirmedTaskSpecId;
  decision.taskDraft = taskDraft;
  decision.confirmedTaskSpec = confirmedTaskSpec;
  decision.requestEnvelope = requestEnvelope;
  if (isAmbiguousRequest(normalized, decision.classification)) {
    decision.clarificationSession = {
      clarificationSessionId: `clarification:${seed}`,
      taskDraftId: taskDraft.taskDraftId,
      questions: decision.classification.suggestedClarifications ?? ["Please clarify the intended workflow change."],
    };
  }
  decision.routeDecision = decision;
  return decision;
}

function stableIdSeed(input: IntakeRouteInput): string {
  const raw = [
    input.tenantId ?? "tenant",
    input.traceId ?? "trace",
    input.idempotencyKey ?? "idem",
    input.title ?? "",
    input.request,
  ].join(":");
  let hash = 0;
  for (const char of raw) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16);
}

function isAmbiguousRequest(normalized: string, classification: IntakeIntentClassification): boolean {
  return classification.ambiguityDetected === true || /\b(maybe|perhaps|rough|unclear)\b/.test(normalized);
}
