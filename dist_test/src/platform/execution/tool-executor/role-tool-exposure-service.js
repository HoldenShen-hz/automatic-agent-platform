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
import { getDefaultDivisionRegistry } from "../../../domains/governance/division-loader.js";
import { ValidationError } from "../../contracts/errors.js";
import { ToolRecommendService, expandToolNames, inferPromotedToolNames, } from "./tool-recommend-service.js";
// Default thresholds for role-based tool exposure
const DEFAULT_ROLE_FULL_EXPOSURE_THRESHOLD = 4;
const DEFAULT_ROLE_RECALL_LIMIT = 4;
/**
 * Finds a role definition within a division registry.
 */
function findRole(registry, divisionId, roleId) {
    const division = registry.divisions.get(divisionId);
    if (division == null) {
        throw new ValidationError(`division.missing:${divisionId}`, `division.missing:${divisionId}`, {
            source: "tool",
            details: { divisionId },
        });
    }
    const role = division.roles.find((candidate) => candidate.id === roleId);
    if (role == null) {
        throw new ValidationError(`division.role_missing:${divisionId}:${roleId}`, `division.role_missing:${divisionId}:${roleId}`, {
            source: "tool",
            details: { divisionId, roleId },
        });
    }
    return role;
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
export class RoleToolExposureService {
    divisionRegistry;
    defaultFullExposureThreshold;
    defaultRecallLimit;
    constructor(divisionRegistry = getDefaultDivisionRegistry(), defaultFullExposureThreshold = DEFAULT_ROLE_FULL_EXPOSURE_THRESHOLD, defaultRecallLimit = DEFAULT_ROLE_RECALL_LIMIT) {
        this.divisionRegistry = divisionRegistry;
        this.defaultFullExposureThreshold = defaultFullExposureThreshold;
        this.defaultRecallLimit = defaultRecallLimit;
    }
    /**
     * Resolves the complete tool exposure for a role.
     */
    resolve(request) {
        if (this.divisionRegistry == null) {
            throw new ValidationError("division.registry_unavailable", "division.registry_unavailable", {
                source: "tool",
            });
        }
        const role = findRole(this.divisionRegistry, request.divisionId, request.roleId);
        // Expand tool name aliases and check for unknown tools
        const expandedDeclaredTools = expandToolNames(role.tools);
        if (expandedDeclaredTools.unresolvedToolNames.length > 0) {
            const unknownTool = expandedDeclaredTools.unresolvedToolNames[0];
            throw new ValidationError(`tool.role_declared_tool_unknown:${request.divisionId}:${request.roleId}:${unknownTool}`, `tool.role_declared_tool_unknown:${request.divisionId}:${request.roleId}:${unknownTool}`, {
                source: "tool",
                details: {
                    divisionId: request.divisionId,
                    roleId: request.roleId,
                    toolName: unknownTool,
                },
            });
        }
        // Infer which tools to promote based on task context keywords
        const inferredPromotedTools = inferPromotedToolNames(request.taskContext, role.tools);
        // Combine inferred and explicitly requested promotions
        const explicitPromotedTools = request.promoteToolNames ?? [];
        const promotedTools = [...new Set([...inferredPromotedTools, ...explicitPromotedTools])];
        // Create recommendation service with role-specific thresholds
        const recommendService = new ToolRecommendService(request.fullExposureThreshold ?? this.defaultFullExposureThreshold, request.recallLimit ?? this.defaultRecallLimit);
        // Get tool recommendations with filtering applied
        const recommendation = recommendService.recommendExposure({
            taskContext: request.taskContext,
            toolNames: role.tools,
            promoteToolNames: promotedTools,
        });
        return {
            divisionId: request.divisionId,
            roleId: request.roleId,
            declaredToolNames: [...role.tools],
            resolvedToolNames: [...recommendation.resolvedToolNames],
            unresolvedToolNames: [...recommendation.unresolvedToolNames],
            resolutionCorrections: [...recommendation.corrections],
            visibleToolNames: recommendation.visibleTools.map((tool) => tool.toolName),
            deferredToolNames: recommendation.deferredTools.map((tool) => tool.toolName),
            visibleTools: recommendation.visibleTools,
            deferredTools: recommendation.deferredTools,
            wasFiltered: recommendation.wasFiltered,
            rolePromptText: role.promptText,
            model: role.model,
        };
    }
}
//# sourceMappingURL=role-tool-exposure-service.js.map