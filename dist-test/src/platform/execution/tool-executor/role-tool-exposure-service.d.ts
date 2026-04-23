/**
 * Role Tool Exposure Service
 *
 * Determines which tools are visible to an agent based on its division and role.
 *
 * This service:
 * - Looks up the role definition from the division registry
 * - Resolves tool names (expanding aliases, finding corrections)
 * - Applies tool recommendation logic to filter/promote tools based on task context
 * - Returns the final set of visible tools along with metadata for rendering
 */
import { type DivisionRegistry } from "../../../domains/governance/division-loader.js";
import { type ToolRecommendation, type ToolNameCorrection } from "./tool-recommend-service.js";
/**
 * Request to resolve tool exposure for a role in a division.
 */
export interface RoleToolExposureRequest {
    /** Division containing the role */
    divisionId: string;
    /** Role to resolve tools for */
    roleId: string;
    /** Natural language context of the current task (for tool promotion) */
    taskContext: string;
    /** Explicitly requested tools to promote (bypass relevance scoring) */
    promoteToolNames?: readonly string[];
    /** Max tools before filtering kicks in (default varies by role) */
    fullExposureThreshold?: number;
    /** Max tools in the visible set when filtering (default varies by role) */
    recallLimit?: number;
}
/**
 * Result of resolving tool exposure for a role.
 */
export interface RoleToolExposureResult {
    /** Division ID from the request */
    divisionId: string;
    /** Role ID from the request */
    roleId: string;
    /** Raw tool names declared in the role definition */
    declaredToolNames: readonly string[];
    /** Tool names after alias expansion and resolution */
    resolvedToolNames: readonly string[];
    /** Tool names that could not be resolved to any known tool */
    unresolvedToolNames: readonly string[];
    /** Any name corrections that were applied (typo fixes, alias expansions) */
    resolutionCorrections: readonly ToolNameCorrection[];
    /** Final list of visible tool names after filtering */
    visibleToolNames: readonly string[];
    /** Tools that were filtered out (not visible but still callable) */
    deferredToolNames: readonly string[];
    /** Full recommendation objects for visible tools */
    visibleTools: readonly ToolRecommendation[];
    /** Full recommendation objects for deferred tools */
    deferredTools: readonly ToolRecommendation[];
    /** Whether filtering was applied (true if tool count exceeded threshold) */
    wasFiltered: boolean;
    /** The role's prompt text for agent configuration */
    rolePromptText: string;
    /** The model specified for this role */
    model: string;
}
/**
 * Resolves which tools a role should be able to see and use.
 *
 * This is the main entry point for tool exposure resolution.
 * It handles:
 * 1. Role lookup in the division registry
 * 2. Tool name resolution (aliases, corrections)
 * 3. Tool promotion based on task context
 * 4. Tool filtering via recall scoring
 */
export declare class RoleToolExposureService {
    private readonly divisionRegistry;
    private readonly defaultFullExposureThreshold;
    private readonly defaultRecallLimit;
    constructor(divisionRegistry?: DivisionRegistry | null, defaultFullExposureThreshold?: number, defaultRecallLimit?: number);
    /**
     * Resolves the complete tool exposure for a role.
     */
    resolve(request: RoleToolExposureRequest): RoleToolExposureResult;
}
