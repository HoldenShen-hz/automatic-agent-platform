/**
 * HR Role Governance Service
 *
 * Manages the lifecycle of HR roles within divisions including gap analysis,
 * role proposal creation, validation, and registration. Provides governance
 * controls to ensure roles comply with division policies and security boundaries.
 *
 * Key concepts:
 * - Gap analysis identifies missing capabilities and suggests matching roles
 * - Role proposals must pass validation before being submitted for approval
 * - Commands require explicit scope boundaries to prevent unauthorized execution
 */

import { join } from "node:path";

import type { ApprovalRequest, ApprovalService } from "../../platform/five-plane-control-plane/approval-center/approval-service.js";
import { PolicyDeniedError, StorageError, ValidationError } from "../../platform/contracts/errors.js";
import type {
  DivisionRegistry,
  DivisionRoleDefinition,
  LoadedDivisionDefinition,
} from "../../domains/governance/division-loader.js";
import { getDefaultDivisionRegistry } from "../../domains/governance/division-loader.js";
import { inferPromotedToolNames, expandToolNames } from "../../platform/five-plane-execution/tool-gateway/index.js";

/** Reason codes for gap analysis triggers */
export type HrGapTriggerReason = "no_role_match" | "scope_exceeded";
/** Status of an HR role proposal approval */
export type HrProposalApprovalStatus = "approved";

/**
 * Request for gap analysis when a task cannot be dispatched.
 */
export interface HrGapAnalysisRequest {
  taskId: string;
  taskDescription: string;
  targetDivisionId: string;
  triggerReason: HrGapTriggerReason;
  requestedCapabilities: readonly string[];
  failedDispatchLog?: {
    attemptedDivisionId?: string;
    attemptedRoleId?: string;
    failureDetails: string;
  } | null;
}

/**
 * Result of gap analysis containing matched roles and missing capabilities.
 */
export interface HrGapAnalysisResult {
  taskId: string;
  targetDivisionId: string;
  triggerReason: HrGapTriggerReason;
  matchedRoleIds: readonly string[];
  missingCapabilities: readonly string[];
  divisionToolUnion: readonly string[];
  suggestedToolNames: readonly string[];
  recommendedModel: "coding" | "balanced";
}

/**
 * Schema shape for role input/output specifications.
 */
export interface HrRoleSchemaShape {
  required: readonly string[];
  optional?: readonly string[];
}

/**
 * A precondition that must be satisfied before a role can execute.
 */
export interface HrRolePrecondition {
  check: string;
  description: string;
}

/**
 * A suggested workflow step to attach to a role proposal.
 */
export interface HrWorkflowStepSuggestion {
  stepId: string;
  roleId: string;
  inputKeys?: readonly string[];
  outputKey: string;
  timeoutMs: number;
  maxAttempts: number;
  autoApply?: boolean;
}

/**
 * A suggestion for inserting a workflow step.
 */
export interface HrWorkflowSuggestion {
  insertAfterStepId: string;
  step: HrWorkflowStepSuggestion;
}

/**
 * A proposal for creating a new HR role within a division.
 */
export interface HrRoleProposal {
  divisionId: string;
  roleId: string;
  name: string;
  promptText: string;
  model: "reasoning" | "coding" | "balanced" | "fast";
  tools: readonly string[];
  maxInstances?: number | null;
  scope: {
    responsibilities: readonly string[];
    boundaries: readonly string[];
  };
  inputSchema: HrRoleSchemaShape;
  outputSchema: HrRoleSchemaShape;
  preconditions: readonly HrRolePrecondition[];
  workflowSuggestion?: HrWorkflowSuggestion | null;
}

/**
 * Result of validating a role proposal.
 */
export interface HrRoleProposalValidationResult {
  valid: boolean;
  errors: readonly string[];
  warnings: readonly string[];
  normalizedTools: readonly string[];
  declaredDivisionToolUnion: readonly string[];
}

/**
 * Request to submit a role proposal for approval.
 */
export interface SubmitHrRoleProposalRequest {
  gapAnalysisRequest: HrGapAnalysisRequest;
  proposal: HrRoleProposal;
  executionId?: string | null;
  sessionId?: string | null;
  sourceAgentId?: string;
}

/**
 * Result of submitting a role proposal.
 */
export interface SubmitHrRoleProposalResult {
  gapAnalysis: HrGapAnalysisResult;
  validation: HrRoleProposalValidationResult;
  approvalRequest: ApprovalRequest | null;
}

/**
 * Request to register an approved HR role.
 */
export interface RegisterApprovedHrRoleRequest {
  proposal: HrRoleProposal;
  approvalStatus: HrProposalApprovalStatus;
}

/** Tool names that are forbidden in HR roles for security reasons */
const FORBIDDEN_HR_TOOL_NAMES = new Set(["spawn_agent", "send_message"]);
/** Tool names related to command execution that require special scope boundaries */
const COMMAND_RELATED_TOOL_NAMES = new Set(["bash", "command_exec"]);

/**
 * Normalizes text by trimming whitespace and converting to lowercase.
 */
function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Deduplicates and normalizes a list of strings.
 */
function uniqueNormalizedStrings(values: readonly string[]): string[] {
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(normalized)];
}

/**
 * Retrieves a division from the registry by ID, throwing if not found.
 */
function readDivision(registry: DivisionRegistry, divisionId: string): LoadedDivisionDefinition {
  const division = registry.divisions.get(divisionId);
  if (division == null) {
    throw new StorageError(`hr.division_missing:${divisionId}`, `hr.division_missing:${divisionId}`, {
      statusCode: 404,
      retryable: false,
      details: { divisionId },
    });
  }
  return division;
}

/**
 * Tokenizes a capability string into searchable tokens.
 * Removes special characters and splits on whitespace, filtering short tokens.
 */
function tokenizeCapability(value: string): string[] {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

/**
 * Builds a searchable text corpus from a role definition.
 */
function buildRoleSearchCorpus(role: DivisionRoleDefinition): string {
  return normalizeText(
    [
      role.id,
      role.name,
      role.promptText,
      role.tools.join(" "),
    ].join(" "),
  );
}

/**
 * Scores how well a role matches a capability based on token overlap.
 */
function scoreRoleAgainstCapability(role: DivisionRoleDefinition, capability: string): number {
  const corpus = buildRoleSearchCorpus(role);
  const tokens = tokenizeCapability(capability);
  if (tokens.length === 0) {
    return 0;
  }

  let score = 0;
  for (const token of tokens) {
    if (corpus.includes(token)) {
      score += 1;
    }
  }
  return score;
}

/**
 * Builds the union of all tools available across all roles in a division.
 */
function buildDivisionToolUnion(division: LoadedDivisionDefinition): string[] {
  const union = new Set<string>();
  for (const role of division.roles) {
    const expanded = expandToolNames(role.tools);
    for (const toolName of expanded.resolvedToolNames) {
      union.add(toolName);
    }
  }
  return [...union].sort((left, right) => left.localeCompare(right));
}

/**
 * Checks if the boundaries indicate command execution restrictions.
 */
function hasCommandRestriction(boundaries: readonly string[]): boolean {
  const normalized = boundaries.map((entry) => normalizeText(entry));
  return normalized.some(
    (entry) =>
      (entry.includes("bash") || entry.includes("command") || entry.includes("shell") || entry.includes("terminal")) &&
      (entry.includes("limit") ||
        entry.includes("restrict") ||
        entry.includes("only") ||
        entry.includes("禁止") ||
        entry.includes("限制") ||
        entry.includes("仅")),
  );
}

/**
 * Builds the path for a generated prompt file for a role.
 */
function buildSuggestedPromptPath(division: LoadedDivisionDefinition, roleId: string): string {
  return join(division.rootPath, "roles", `${roleId}.generated.prompt.md`);
}

/**
 * Validates a schema shape for required fields and duplicate checking.
 */
function validateSchemaShape(
  shape: HrRoleSchemaShape,
  prefix: string,
  errors: string[],
): void {
  const required = uniqueNormalizedStrings(shape.required);
  if (required.length === 0) {
    errors.push(`${prefix}.required_missing`);
  }

  const optional = uniqueNormalizedStrings(shape.optional ?? []);
  const duplicated = optional.find((entry) => required.includes(entry));
  if (duplicated) {
    errors.push(`${prefix}.duplicate_field:${duplicated}`);
  }
}

/**
 * Service for governing HR role lifecycle including gap analysis,
 * proposal submission, validation, and registration.
 */
export class HrRoleGovernanceService {
  public constructor(
    private readonly divisionRegistry: DivisionRegistry | null = getDefaultDivisionRegistry(),
    private readonly approvalService: ApprovalService | null = null,
  ) {}

  /**
   * Analyzes a task to identify capability gaps and suggest matching roles.
   *
   * Scores all roles in the division against requested capabilities to find
   * the best matches and identify any missing capabilities.
   */
  public analyzeGap(request: HrGapAnalysisRequest): HrGapAnalysisResult {
    if (this.divisionRegistry == null) {
      throw new StorageError("division.registry_unavailable", "division.registry_unavailable", {
        statusCode: 503,
        retryable: false,
      });
    }

    const division = readDivision(this.divisionRegistry, request.targetDivisionId);
    const requestedCapabilities = uniqueNormalizedStrings(request.requestedCapabilities);
    const roleScores = new Map<string, number>();
    const missingCapabilities: string[] = [];

    for (const capability of requestedCapabilities) {
      let bestRoleId: string | null = null;
      let bestScore = 0;
      for (const role of division.roles) {
        const score = scoreRoleAgainstCapability(role, capability);
        if (score > bestScore) {
          bestRoleId = role.id;
          bestScore = score;
        }
      }

      if (bestRoleId == null || bestScore === 0) {
        missingCapabilities.push(capability);
        continue;
      }

      roleScores.set(bestRoleId, (roleScores.get(bestRoleId) ?? 0) + bestScore);
    }

    const matchedRoleIds = [...roleScores.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([roleId]) => roleId);
    const divisionToolUnion = buildDivisionToolUnion(division);
    const suggestedToolNames = inferPromotedToolNames(
      `${request.taskDescription}\n${requestedCapabilities.join("\n")}`,
      divisionToolUnion,
    );
    const recommendedModel =
      suggestedToolNames.some((toolName) => toolName !== "read" && toolName !== "question")
        ? "coding"
        : "balanced";

    return {
      taskId: request.taskId,
      targetDivisionId: request.targetDivisionId,
      triggerReason: request.triggerReason,
      matchedRoleIds,
      missingCapabilities,
      divisionToolUnion,
      suggestedToolNames,
      recommendedModel,
    };
  }

  /**
   * Validates a role proposal for compliance with division policies.
   *
   * Checks include duplicate detection, required fields, tool permissions,
   * command boundary requirements, and workflow consistency.
   */
  public validateProposal(proposal: HrRoleProposal): HrRoleProposalValidationResult {
    if (this.divisionRegistry == null) {
      throw new StorageError("division.registry_unavailable", "division.registry_unavailable", {
        statusCode: 503,
        retryable: false,
      });
    }

    const division = readDivision(this.divisionRegistry, proposal.divisionId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (division.roles.some((role) => role.id === proposal.roleId)) {
      errors.push(`hr.role_duplicate:${proposal.divisionId}:${proposal.roleId}`);
    }

    if (proposal.name.trim().length === 0) {
      errors.push("hr.role_name_missing");
    }
    if (proposal.promptText.trim().length === 0) {
      errors.push("hr.prompt_missing");
    }
    if (uniqueNormalizedStrings(proposal.scope.responsibilities).length === 0) {
      errors.push("hr.scope_responsibilities_missing");
    }
    if (uniqueNormalizedStrings(proposal.scope.boundaries).length === 0) {
      errors.push("hr.scope_boundaries_missing");
    }
    if (proposal.preconditions.length === 0) {
      errors.push("hr.preconditions_missing");
    }

    for (const precondition of proposal.preconditions) {
      if (precondition.check.trim().length === 0 || precondition.description.trim().length === 0) {
        errors.push("hr.precondition_invalid");
        break;
      }
    }

    validateSchemaShape(proposal.inputSchema, "hr.input_schema", errors);
    validateSchemaShape(proposal.outputSchema, "hr.output_schema", errors);

    const divisionToolUnion = buildDivisionToolUnion(division);
    const expandedProposalTools = expandToolNames(proposal.tools);
    if (expandedProposalTools.resolvedToolNames.length === 0) {
      errors.push("hr.tools_missing");
    }
    for (const unresolvedToolName of expandedProposalTools.unresolvedToolNames) {
      errors.push(`hr.tool_unknown:${proposal.divisionId}:${proposal.roleId}:${unresolvedToolName}`);
    }

    for (const toolName of uniqueNormalizedStrings(proposal.tools)) {
      if (FORBIDDEN_HR_TOOL_NAMES.has(toolName)) {
        errors.push(`hr.tool_forbidden:${proposal.divisionId}:${proposal.roleId}:${toolName}`);
      }
    }

    for (const toolName of expandedProposalTools.resolvedToolNames) {
      if (!divisionToolUnion.includes(toolName)) {
        errors.push(`hr.tool_outside_division_subset:${proposal.divisionId}:${proposal.roleId}:${toolName}`);
      }
    }

    if (
      expandedProposalTools.resolvedToolNames.some((toolName) => COMMAND_RELATED_TOOL_NAMES.has(toolName)) &&
      !hasCommandRestriction(proposal.scope.boundaries)
    ) {
      errors.push(`hr.command_boundary_missing:${proposal.divisionId}:${proposal.roleId}`);
    }

    if (proposal.workflowSuggestion != null) {
      if (proposal.workflowSuggestion.step.autoApply === true) {
        errors.push(`hr.workflow_auto_apply_denied:${proposal.divisionId}:${proposal.roleId}`);
      }
      if (proposal.workflowSuggestion.step.roleId !== proposal.roleId) {
        errors.push(`hr.workflow_role_mismatch:${proposal.divisionId}:${proposal.roleId}`);
      }
    }

    if (proposal.maxInstances != null && (!Number.isInteger(proposal.maxInstances) || proposal.maxInstances <= 0)) {
      errors.push("hr.max_instances_invalid");
    }

    if (expandedProposalTools.resolvedToolNames.every((toolName) => toolName === "read" || toolName === "question")) {
      warnings.push("hr.read_only_role");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalizedTools: [...expandedProposalTools.resolvedToolNames],
      declaredDivisionToolUnion: divisionToolUnion,
    };
  }

  /**
   * Submits a role proposal for approval after validation.
   *
   * Creates an approval request if validation passes and an approval service is configured.
   */
  public submitProposal(request: SubmitHrRoleProposalRequest): SubmitHrRoleProposalResult {
    const gapAnalysis = this.analyzeGap(request.gapAnalysisRequest);
    const validation = this.validateProposal(request.proposal);

    if (!validation.valid || this.approvalService == null) {
      return {
        gapAnalysis,
        validation,
        approvalRequest: null,
      };
    }

    const approvalRequest = this.approvalService.createRequest({
      taskId: request.gapAnalysisRequest.taskId,
      executionId: request.executionId ?? null,
      sourceAgentId: request.sourceAgentId ?? "agent_hr",
      reason: `hr.role_creation:${request.proposal.divisionId}:${request.proposal.roleId}`,
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {
        sessionId: request.sessionId ?? null,
        proposalType: "hr_role_creation",
        proposal: request.proposal,
        gapAnalysis,
      },
      timeoutPolicy: "remain_pending",
    });

    return {
      gapAnalysis,
      validation,
      approvalRequest,
    };
  }

  /**
   * Registers an approved HR role into the division registry.
   *
   * Requires the proposal to have been approved through the approval workflow.
   */
  public registerApprovedRole(request: RegisterApprovedHrRoleRequest): DivisionRegistry {
    if (this.divisionRegistry == null) {
      throw new StorageError("division.registry_unavailable", "division.registry_unavailable", {
        statusCode: 503,
        retryable: false,
      });
    }
    if (request.approvalStatus !== "approved") {
      throw new PolicyDeniedError("hr.role_registration_requires_approval", "hr.role_registration_requires_approval", {
        retryable: false,
        details: { approvalStatus: request.approvalStatus },
      });
    }

    const validation = this.validateProposal(request.proposal);
    if (!validation.valid) {
      throw new ValidationError(
        `hr.role_proposal_invalid:${request.proposal.divisionId}:${request.proposal.roleId}`,
        `hr.role_proposal_invalid:${request.proposal.divisionId}:${request.proposal.roleId}`,
        {
          retryable: false,
          details: {
            divisionId: request.proposal.divisionId,
            roleId: request.proposal.roleId,
            errors: validation.errors,
          },
        },
      );
    }

    const division = readDivision(this.divisionRegistry, request.proposal.divisionId);
    const registeredRole: DivisionRoleDefinition = {
      id: request.proposal.roleId,
      name: request.proposal.name,
      promptPath: buildSuggestedPromptPath(division, request.proposal.roleId),
      promptText: request.proposal.promptText,
      model: request.proposal.model,
      tools: [...uniqueNormalizedStrings(request.proposal.tools)],
      maxInstances: request.proposal.maxInstances ?? 1,
    };

    const nextDivision: LoadedDivisionDefinition = {
      ...division,
      roles: [...division.roles, registeredRole],
    };
    const nextDivisions = new Map(this.divisionRegistry.divisions);
    nextDivisions.set(nextDivision.id, nextDivision);

    return {
      divisions: nextDivisions,
      workflows: new Map(this.divisionRegistry.workflows),
    };
  }
}
