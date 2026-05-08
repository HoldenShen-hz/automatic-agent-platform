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

import { getDefaultDivisionRegistry, type DivisionRegistry, type DivisionRoleDefinition } from "../../../domains/governance/division-loader.js";
import { ValidationError } from "../../contracts/errors.js";
import {
  ToolRecommendService,
  expandToolNames,
  inferPromotedToolNames,
  type ToolRecommendation,
  type ToolNameCorrection,
} from "./tool-recommend-service.js";

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

// Default thresholds for role-based tool exposure
const DEFAULT_ROLE_FULL_EXPOSURE_THRESHOLD = 4;
const DEFAULT_ROLE_RECALL_LIMIT = 4;

/**
 * Finds a role definition within a division registry.
 */
function findRole(
  registry: DivisionRegistry,
  divisionId: string,
  roleId: string,
): DivisionRoleDefinition {
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
  public constructor(
    private readonly divisionRegistry: DivisionRegistry | null = getDefaultDivisionRegistry(),
    private readonly defaultFullExposureThreshold: number = DEFAULT_ROLE_FULL_EXPOSURE_THRESHOLD,
    private readonly defaultRecallLimit: number = DEFAULT_ROLE_RECALL_LIMIT,
  ) {}

  /**
   * Resolves the complete tool exposure for a role.
   */
  public resolve(request: RoleToolExposureRequest): RoleToolExposureResult {
    if (this.divisionRegistry == null) {
      throw new ValidationError("division.registry_unavailable", "division.registry_unavailable", {
        source: "tool",
      });
    }

    const role = findRole(this.divisionRegistry, request.divisionId, request.roleId);

    // Expand tool name aliases and check for unknown tools
    const expandedDeclaredTools = expandToolNames(role.tools);
    if (expandedDeclaredTools.unresolvedToolNames.length > 0) {
      const unknownTool = expandedDeclaredTools.unresolvedToolNames[0]!;
      throw new ValidationError(
        `tool.role_declared_tool_unknown:${request.divisionId}:${request.roleId}:${unknownTool}`,
        `tool.role_declared_tool_unknown:${request.divisionId}:${request.roleId}:${unknownTool}`,
        {
          source: "tool",
          details: {
            divisionId: request.divisionId,
            roleId: request.roleId,
            toolName: unknownTool,
          },
        },
      );
    }

    // Infer which tools to promote based on task context keywords
    const inferredPromotedTools = inferPromotedToolNames(request.taskContext, role.tools);

    // Combine inferred and explicitly requested promotions
    const explicitPromotedTools = request.promoteToolNames ?? [];
    const promotedTools = [...new Set([...inferredPromotedTools, ...explicitPromotedTools])];

    // Create recommendation service with role-specific thresholds
    const recommendService = new ToolRecommendService(
      request.fullExposureThreshold ?? this.defaultFullExposureThreshold,
      request.recallLimit ?? this.defaultRecallLimit,
    );

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
