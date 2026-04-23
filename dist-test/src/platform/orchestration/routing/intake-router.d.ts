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
import type { DivisionRegistry } from "../../../domains/governance/division-loader.js";
/** Intent types for request classification */
export type IntakeIntent = "query" | "create" | "modify" | "approve" | "cancel" | "clarify" | "chitchat" | "correction";
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
 * The result of routing an intake request, containing the selected workflow
 * and division along with metadata about how the decision was made.
 */
export interface IntakeRouteDecision {
    /** ID of the workflow to execute for this request */
    workflowId: string;
    /** ID of the division that will handle this request */
    divisionId: string;
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
    title: string;
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
 * Routes incoming requests to appropriate divisions and workflows.
 *
 * The router analyzes request content to determine:
 * 1. Whether orchestration is needed (based on keyword hints and request length)
 * 2. Which division should handle the request (based on trigger matching)
 * 3. Which specific workflow to execute
 *
 * Routing is deterministic and produces a trace of decisions for debugging.
 */
export declare class IntakeRouter {
    private readonly divisionRegistry;
    /**
     * Creates a new intake router instance.
     *
     * @param options - Configuration options including an optional division registry
     */
    constructor(options?: IntakeRouterOptions);
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
    route(input: IntakeRouteInput): IntakeRouteDecision;
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
    private selectDivision;
}
