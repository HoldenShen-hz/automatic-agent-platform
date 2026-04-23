/**
 * Tool Recommend Service
 *
 * Provides intelligent tool filtering and promotion when the number of available tools is large.
 * When tools are few (below threshold), all are exposed. When tools are many, recall + promote
 * is used to surface the most relevant subset.
 *
 * Recall: Scores each tool against the task context and selects top candidates
 * Promote: Boosts specific tools (e.g., high-risk tools that are explicitly needed)
 */
import { type ToolExecutionMetadata } from "./tool-metadata.js";
export interface ToolRecommendRequest {
    /** Natural language description of the task or user request */
    taskContext: string;
    /** List of tool names to consider */
    toolNames: readonly string[];
    /** Optional list of tool names to always promote (e.g., explicitly requested tools) */
    promoteToolNames?: readonly string[];
    /** Maximum tools to expose when not using recall filtering; default 20 */
    fullExposureThreshold?: number;
    /** Maximum tools to return from recall when filtering; default 15 */
    recallLimit?: number;
    /** Optional function to compute relevance score between task context and tool */
    computeRelevanceScore?: (taskContext: string, tool: ToolExecutionMetadata) => number;
}
export interface ToolRecommendation {
    toolName: string;
    toolMetadata: ToolExecutionMetadata;
    relevanceScore: number;
    wasPromoted: boolean;
}
export interface ToolRecommendResult {
    /** Tools to expose to the user/agent */
    recommendedTools: ToolRecommendation[];
    /** Whether filtering was applied (true if tool count exceeded threshold) */
    wasFiltered: boolean;
    /** Total tools considered */
    totalToolsConsidered: number;
    /** Maximum relevance score observed */
    maxRelevanceScore: number;
}
export interface ExpandedToolNames {
    resolvedToolNames: readonly string[];
    unresolvedToolNames: readonly string[];
    corrections: readonly ToolNameCorrection[];
}
export interface ToolNameCorrection {
    inputToolName: string;
    matchedCandidate: string;
    resolvedToolNames: readonly string[];
    strategy: "normalized_exact" | "fuzzy_unique";
}
export interface ToolRecommendExposureResult {
    visibleTools: ToolRecommendation[];
    deferredTools: ToolRecommendation[];
    wasFiltered: boolean;
    totalToolsConsidered: number;
    maxRelevanceScore: number;
    resolvedToolNames: readonly string[];
    unresolvedToolNames: readonly string[];
    corrections: readonly ToolNameCorrection[];
}
/**
 * Expands tool name aliases into concrete runtime tool names
 * @param toolNames - Array of tool names or aliases to expand
 * @returns ExpandedToolNames with resolvedToolNames and unresolvedToolNames
 */
export declare function expandToolNames(toolNames: readonly string[]): ExpandedToolNames;
/**
 * Infers which tools should be promoted based on task context keywords
 * @param taskContext - Natural language description of the task
 * @param toolNames - Available tool names to consider for promotion
 * @returns Array of tool names that should be promoted
 */
export declare function inferPromotedToolNames(taskContext: string, toolNames: readonly string[]): string[];
/**
 * Extracts keywords from task context for matching
 */
export declare function extractKeywords(context: string): string[];
/**
 * Default relevance scoring function
 */
export declare function defaultRelevanceScore(taskContext: string, tool: ToolExecutionMetadata): number;
export declare class ToolRecommendService {
    private readonly fullExposureThreshold;
    private readonly recallLimit;
    constructor(fullExposureThreshold?: number, recallLimit?: number);
    /**
     * Recommends tools based on task context, applying recall filtering when tool count exceeds threshold
     */
    recommend(request: ToolRecommendRequest): ToolRecommendResult;
    recommendExposure(request: ToolRecommendRequest): ToolRecommendExposureResult;
    /**
     * Gets the recall score for a specific tool (for audit purposes)
     */
    getRecallScore(taskContext: string, toolName: string): number;
}
/**
 * Manager for tool recommend services per session
 */
export declare class ToolRecommendManager {
    private services;
    /**
     * Gets or creates a recommend service for a session
     */
    getService(sessionId: string, threshold?: number, recallLimit?: number): ToolRecommendService;
    /**
     * Clears all cached services
     */
    clearAll(): void;
}
