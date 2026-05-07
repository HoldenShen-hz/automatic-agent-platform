/**
 * Division Loader
 *
 * Loads and validates division definitions from the filesystem.
 * Divisions are organizational units that define:
 * - Roles (agents with specific capabilities and prompts)
 * - Workflows (sequences of steps executed by roles)
 * - Triggers (patterns that route requests to divisions)
 *
 * All file operations are sandboxed to prevent directory traversal attacks.
 * The loader performs comprehensive validation including workflow linting
 * and cross-reference checks between divisions, roles, and workflows.
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/division_definition_contract.md | Division Definition Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
  type SandboxPolicy,
} from "../../platform/control-plane/iam/sandbox-policy.js";
import { ConfigGovernanceService } from "../../platform/control-plane/config-center/config-governance-service.js";
import { resolveConfigEnvironment } from "../../platform/control-plane/config-center/runtime-env.js";
import type { MinimalWorkflowDefinition, MinimalWorkflowStep } from "../../platform/orchestration/oapeflir/workflow/minimal-workflow.js";
import { parseWorkflowOutputSchema } from "../../platform/orchestration/oapeflir/workflow/output-schema.js";
import { WorkflowValidator } from "../../platform/orchestration/oapeflir/workflow/workflow-validator.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { SandboxError, ValidationError } from "../../platform/contracts/errors.js";
import {
  DEFAULT_DIVISIONS_ROOT,
  expectNonEmptyString,
  isPlainObject,
  parseLimitedYaml,
  toInteger,
  toObjectArray,
  toStringArray,
  throwDivisionSandboxError,
  throwDivisionValidationError,
  throwDivisionWorkflowError,
  type RawDivisionConfig,
  type RawDivisionRoleConfig,
  type RawWorkflowConfig,
  type RawWorkflowStepConfig,
} from "./division-loader-support.js";

const logger = new StructuredLogger({ retentionLimit: 100 });


/**
 * Definition of a role within a division.
 * Roles represent distinct agent capabilities with associated prompts and tools.
 */
export interface DivisionRoleDefinition {
  /** Unique identifier for this role within the division */
  id: string;
  /** Human-readable display name for this role */
  name: string;
  /** Absolute filesystem path to the role's prompt template file */
  promptPath: string;
  /** Loaded content of the prompt template file */
  promptText: string;
  /** Model identifier to use for this role (e.g., "balanced", "precision") */
  model: string;
  /** List of tool identifiers available to this role */
  tools: string[];
  /** Maximum concurrent instances of this role (null for unlimited) */
  maxInstances: number | null;
}

/**
 * A fully loaded and validated division definition.
 * This represents a complete division including all its roles and workflows.
 */
export interface LoadedDivisionDefinition {
  /** Unique identifier for this division */
  id: string;
  /** Version string for the division definition schema */
  version: string;
  /** Human-readable name for this division */
  name: string;
  /** Detailed description of the division's purpose */
  description: string;
  /** Priority value for request routing (higher = more priority) */
  priority: number;
  /** Trigger patterns that route requests to this division */
  triggers: string[];
  /** ID of the default workflow for this division */
  defaultWorkflowId: string;
  /** ID of the orchestration workflow (if any) for this division */
  orchestrationWorkflowId: string | null;
  /** All roles defined in this division */
  roles: DivisionRoleDefinition[];
  /** All workflows defined in this division */
  workflows: MinimalWorkflowDefinition[];
  /** Absolute filesystem path to the division's root directory */
  rootPath: string;
  /** R19-15: Resource quotas for this division */
  quotas?: readonly DivisionResourceQuota[];
  // §37: DomainDescriptor structured hierarchy
  /** Domain descriptor containing core domain information */
  domainDescriptor?: DomainDescriptor;
  /** Risk profile for this domain */
  riskProfile?: DomainRiskProfile;
  /** Evaluation specification for this domain */
  evalSpec?: DomainEvalSpec;
}

/**
 * §37: DomainDescriptor - Core domain information per vertical business domain.
 */
export interface DomainDescriptor {
  /** Unique domain identifier */
  domainId: string;
  /** Owner organization node ID */
  ownerOrgNodeId: string;
  /** Primary entities this domain operates on */
  primaryEntities: string[];
  /** Recipe archetype for this domain */
  recipeArchetype: string;
  /** Lifecycle state */
  lifecycleState: DomainLifecycleState;
}

/**
 * §37: DomainRiskProfile - Risk classification for this domain.
 */
export interface DomainRiskProfile {
  /** Profile identifier */
  profileId: string;
  /** Associated domain ID */
  domainId: string;
  /** Risk classification level */
  riskLevel: DomainRiskLevel;
  /** Whether this domain is advisory only */
  advisoryOnly: boolean;
  /** Whether human accountability is required */
  humanAccountable: boolean;
  /** Whether only deterministic hot path is allowed */
  deterministicHotPathOnly: boolean;
  /** Regulatory classification */
  regulatoryClass: string;
}

/**
 * §37: DomainEvalSpec - Evaluation specifications for this domain.
 */
export interface DomainEvalSpec {
  /** Domain identifier */
  domainId: string;
  /** Evaluation baselines */
  evalBaselines: string[];
  /** Critical cases requiring special handling */
  criticalCases: string[];
  /** Acceptance thresholds for metrics */
  acceptanceThresholds: Record<string, number>;
  /** Adversarial scenarios to test */
  adversarialScenarios: string[];
}

type DomainLifecycleState = "draft" | "validating" | "testing" | "certified" | "registered" | "canary" | "active" | "deprecated" | "retired" | "archived" | "updating" | "validated";

type DomainRiskLevel = "low" | "medium" | "high" | "critical";

/**
 * Registry containing all loaded divisions and their associated workflows.
 * This is the primary output of the division loading process.
 */
export interface DivisionRegistry {
  /** Map of division ID to loaded division definition */
  divisions: ReadonlyMap<string, LoadedDivisionDefinition>;
  /** Map of workflow ID to loaded workflow definition (across all divisions) */
  workflows: ReadonlyMap<string, MinimalWorkflowDefinition>;
}

/**
 * R19-15: Resource quota constraints for a division.
 */
export interface DivisionResourceQuota {
  /** Quota ID */
  readonly quotaId: string;
  /** Division this quota applies to */
  readonly divisionId: string;
  /** Type of resource being quota'd */
  readonly resourceType: "cpu" | "memory" | "concurrent_tasks" | "storage" | "api_calls";
  /** Maximum allowed value */
  readonly maxValue: number;
  /** Current usage (tracked by runtime) */
  readonly currentUsage: number;
  /** Warning threshold (percentage) */
  readonly warningThreshold: number;
}

/**
 * R19-15: Result of resource quota resolution.
 */
export interface ResourceQuotaResolutionResult {
  readonly resolved: boolean;
  readonly quotas: readonly DivisionResourceQuota[];
  readonly violations: readonly string[];
}

/**
 * Configuration options for the DivisionLoader.
 */
export interface DivisionLoaderOptions {
  /** Root directory containing division subdirectories (defaults to ./divisions) */
  divisionsRoot?: string;
  /** Sandbox policy controlling file system access */
  sandboxPolicy?: SandboxPolicy;
  /** Enables workflows whose steps execute across multiple divisions. Defaults to false. */
  allowCrossDivisionDag?: boolean;
  /** Enable resource quota validation. Defaults to true. */
  enableResourceQuotaValidation?: boolean;
}

export interface ConfiguredDivisionRegistryOptions extends DivisionLoaderOptions {
  /** Root directory containing layered config files (defaults to ./config) */
  configRoot?: string;
  /** Configuration environment to resolve (defaults to dev / AA_CONFIG_ENV) */
  environment?: string;
}

/**
 * Represents a single non-empty, non-comment line from a YAML source file.
 * Used during the minimal YAML parsing process.
 */
/**
 * Module-level cache for the default division registry.
 * Used to avoid repeated filesystem operations for the default loader.
 * Can be cleared for testing purposes.
 */
let defaultRegistryCache: DivisionRegistry | null | undefined;

/**
 * Loads and validates division definitions from the filesystem.
 *
 * The loader performs several important functions:
 * - Discovers division directories within a root path
 * - Parses and validates YAML configuration files
 * - Loads role prompt templates from external files
 * - Validates cross-references between divisions, roles, and workflows
 * - Lints workflows using the WorkflowValidator
 *
 * All file system access is governed by sandbox policies to prevent
 * directory traversal attacks and unauthorized file access.
 */
export class DivisionLoader {
  private readonly divisionsRoot: string;
  private readonly sandboxPolicy: SandboxPolicy;
  private readonly allowCrossDivisionDag: boolean;
  private readonly enableResourceQuotaValidation: boolean;

  /**
   * Creates a new division loader instance.
   *
   * @param options - Configuration options including divisions root and sandbox policy
   */
  public constructor(options: DivisionLoaderOptions = {}) {
    this.divisionsRoot = options.divisionsRoot ?? DEFAULT_DIVISIONS_ROOT;
    // Default policy should encompass the resolved divisions root, even when running from dist/.
    this.sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(resolve(this.divisionsRoot, ".."));
    this.allowCrossDivisionDag = options.allowCrossDivisionDag ?? false;
    this.enableResourceQuotaValidation = options.enableResourceQuotaValidation ?? true;
  }

  /**
   * R19-15: Resolves resource quotas for a division.
   *
   * This method validates and resolves resource quotas based on:
   * - Division's defined quotas
   * - Role requirements
   * - Workflow step requirements
   * - Global limits from platform configuration
   */
  public resolveResourceQuotas(division: LoadedDivisionDefinition): ResourceQuotaResolutionResult {
    const violations: string[] = [];

    // Default quotas that apply to all divisions
    const defaultQuotas: readonly DivisionResourceQuota[] = [
      {
        quotaId: `quota_${division.id}_concurrent_tasks`,
        divisionId: division.id,
        resourceType: "concurrent_tasks",
        maxValue: 100,
        currentUsage: 0,
        warningThreshold: 80,
      },
      {
        quotaId: `quota_${division.id}_storage`,
        divisionId: division.id,
        resourceType: "storage",
        maxValue: 10 * 1024 * 1024 * 1024, // 10 GB
        currentUsage: 0,
        warningThreshold: 80,
      },
    ];

    // Calculate quotas based on role requirements
    const roleBasedQuotas = this.calculateRoleResourceQuotas(division);

    // Calculate quotas based on workflow requirements
    const workflowBasedQuotas = this.calculateWorkflowResourceQuotas(division);

    // Combine all quotas, with division-specific quotas taking precedence
    const allQuotas = this.mergeQuotas([...defaultQuotas, ...roleBasedQuotas, ...workflowBasedQuotas, ...(division.quotas ?? [])]);

    // Validate quotas don't exceed platform limits
    const validatedQuotas = this.validateQuotaLimits(allQuotas, violations);

    return {
      resolved: violations.length === 0,
      quotas: validatedQuotas,
      violations,
    };
  }

  private calculateRoleResourceQuotas(division: LoadedDivisionDefinition): DivisionResourceQuota[] {
    const quotas: DivisionResourceQuota[] = [];
    const roleCount = division.roles.length;

    // Calculate concurrent task quota based on role count and maxInstances
    let maxConcurrentTasks = 0;
    for (const role of division.roles) {
      const instances = role.maxInstances ?? 1;
      maxConcurrentTasks += instances;
    }

    // Add a buffer for dynamic role spawning
    maxConcurrentTasks = Math.ceil(maxConcurrentTasks * 1.2);

    quotas.push({
      quotaId: `quota_${division.id}_role_concurrent_tasks`,
      divisionId: division.id,
      resourceType: "concurrent_tasks",
      maxValue: maxConcurrentTasks,
      currentUsage: 0,
      warningThreshold: 85,
    });

    return quotas;
  }

  private calculateWorkflowResourceQuotas(division: LoadedDivisionDefinition): DivisionResourceQuota[] {
    const quotas: DivisionResourceQuota[] = [];
    let totalTimeoutMs = 0;

    for (const workflow of division.workflows) {
      for (const step of workflow.steps) {
        totalTimeoutMs += step.timeoutMs > 0 ? step.timeoutMs : 300000; // default 5 min
      }
    }

    // Convert total workflow time to an approximate concurrent task requirement
    // Assume average workflow takes 1 minute and they can run in parallel
    const estimatedConcurrentWorkflows = Math.ceil(totalTimeoutMs / 60000);

    quotas.push({
      quotaId: `quota_${division.id}_workflow_concurrent`,
      divisionId: division.id,
      resourceType: "concurrent_tasks",
      maxValue: Math.max(estimatedConcurrentWorkflows, 10),
      currentUsage: 0,
      warningThreshold: 75,
    });

    return quotas;
  }

  private mergeQuotas(quotas: readonly DivisionResourceQuota[]): DivisionResourceQuota[] {
    const merged = new Map<string, DivisionResourceQuota>();

    for (const quota of quotas) {
      const key = `${quota.divisionId}:${quota.resourceType}`;
      const existing = merged.get(key);

      if (existing) {
        // Keep the higher maxValue (less restrictive)
        merged.set(key, {
          ...existing,
          maxValue: Math.max(existing.maxValue, quota.maxValue),
          warningThreshold: Math.min(existing.warningThreshold, quota.warningThreshold),
        });
      } else {
        merged.set(key, quota);
      }
    }

    return [...merged.values()];
  }

  private validateQuotaLimits(
    quotas: readonly DivisionResourceQuota[],
    violations: string[],
  ): DivisionResourceQuota[] {
    // Platform-level limits that should not be exceeded
    const PLATFORM_LIMITS: Record<string, number> = {
      cpu: 1000,
      memory: 1024 * 1024 * 1024 * 1024, // 1 TB
      concurrent_tasks: 10000,
      storage: 100 * 1024 * 1024 * 1024 * 1024, // 100 GB
      api_calls: 1000000,
    };

    const validated: DivisionResourceQuota[] = [];

    for (const quota of quotas) {
      const platformLimit = PLATFORM_LIMITS[quota.resourceType];
      if (platformLimit !== undefined && quota.maxValue > platformLimit) {
        violations.push(
          `division.quota_exceeds_platform_limit:${quota.divisionId}:${quota.resourceType}:${quota.maxValue}>${platformLimit}`,
        );
        // Cap at platform limit
        validated.push({
          ...quota,
          maxValue: platformLimit,
        });
      } else {
        validated.push(quota);
      }
    }

    return validated;
  }

  /**
   * Loads all divisions from the configured divisions root directory.
   *
   * This method:
   * 1. Validates the divisions root against the sandbox policy
   * 2. Iterates through all subdirectories looking for division definitions
   * 3. Loads and validates each division including its roles and workflows
   * 4. Checks for duplicate division and workflow IDs
   * 5. Returns a registry containing all loaded divisions and workflows
   *
   * @returns A complete registry of all divisions and their workflows
   * @throws Error if the root is denied by sandbox policy or doesn't exist
   */
  public loadAll(): DivisionRegistry {
    // Validate the divisions root directory against sandbox policy
    const rootCheck = checkSandboxPath(this.sandboxPolicy, this.divisionsRoot);
    if (!rootCheck.allowed) {
      throw new SandboxError(rootCheck.reasonCode ?? "division.root_denied", `${rootCheck.reasonCode ?? "division.root_denied"}: Divisions root access denied: ${this.divisionsRoot}`, {
        details: { path: this.divisionsRoot, reasonCode: rootCheck.reasonCode },
      });
    }

    // Verify the divisions root actually exists on disk
    if (!existsSync(rootCheck.normalizedPath)) {
      throw new ValidationError("division.root_missing", `division.root_missing: Divisions root does not exist: ${this.divisionsRoot}`, {
        details: { path: this.divisionsRoot },
      });
    }

    // Create a narrowed sandbox policy that only allows access within the divisions root
    const effectivePolicy: SandboxPolicy = {
      ...this.sandboxPolicy,
      allowedRoots: [rootCheck.normalizedPath],
    };

    const divisions = new Map<string, LoadedDivisionDefinition>();
    const workflows = new Map<string, MinimalWorkflowDefinition>();

    // Iterate through all entries in the divisions root directory
    for (const entry of readdirSync(rootCheck.normalizedPath, { withFileTypes: true })) {
      // Skip non-directory entries (only process division subdirectories)
      if (!entry.isDirectory()) {
        continue;
      }

      // Load and validate the division from its subdirectory
      const division = this.loadDivision(join(rootCheck.normalizedPath, entry.name), effectivePolicy);

      // Check for duplicate division IDs across all divisions
      if (divisions.has(division.id)) {
        throw new ValidationError("division.duplicate_id", `division.duplicate_id: Division ID is duplicated: ${division.id}`, {
          details: { divisionId: division.id },
        });
      }

      // Add all workflows from this division to the global workflow map
      // and check for duplicate workflow IDs
      for (const workflow of division.workflows) {
        if (workflows.has(workflow.workflowId)) {
          throw new ValidationError("workflow.duplicate_id", `workflow.duplicate_id: Workflow ID is duplicated: ${workflow.workflowId}`, {
            details: { workflowId: workflow.workflowId },
          });
        }
        workflows.set(workflow.workflowId, workflow);
      }

      divisions.set(division.id, division);
    }

    this.validateLoadedRegistry(divisions);

    return {
      divisions,
      workflows,
    };
  }

  /**
   * Loads and validates a single division from its root directory.
   *
   * This method:
   * 1. Parses the division.yaml configuration file
   * 2. Loads all role definitions and their prompt templates
   * 3. Loads all workflow definitions from the workflows subdirectory
   * 4. Validates cross-references between configurations
   * 5. Lints all workflows using the WorkflowValidator
   *
   * @param divisionRoot - Absolute path to the division's root directory
   * @param policy - Sandbox policy to use for file access within the division
   * @returns The fully loaded and validated division definition
   */
  private loadDivision(divisionRoot: string, policy: SandboxPolicy): LoadedDivisionDefinition {
    // Parse the main division configuration file
    const divisionConfigPath = join(divisionRoot, "division.yaml");
    const divisionConfig = this.parseDivisionConfig(
      this.readSandboxedFile(policy, divisionConfigPath),
      divisionConfigPath,
    );

    // Load all roles defined in this division
    const roles = this.loadRoles(divisionRoot, divisionConfig.roles ?? [], policy);
    // Load all workflows defined in this division
    const workflows = this.loadWorkflows(divisionRoot, policy);

    // Ensure at least one role is defined
    if (roles.length === 0) {
      throwDivisionValidationError("division.roles_missing", { divisionId: divisionConfig.id });
    }

    // Ensure at least one workflow is defined
    if (workflows.length === 0) {
      throwDivisionValidationError("division.workflows_missing", { divisionId: divisionConfig.id });
    }

    // Validate that the default workflow exists
    const workflowIds = new Set(workflows.map((workflow) => workflow.workflowId));
    if (!workflowIds.has(divisionConfig.default_workflow)) {
      throwDivisionValidationError("division.default_workflow_missing", {
        divisionId: divisionConfig.id,
        defaultWorkflowId: divisionConfig.default_workflow,
      });
    }

    // Parse the orchestration workflow ID if present
    const orchestrationWorkflowId =
      typeof divisionConfig.orchestration_workflow === "string"
        ? divisionConfig.orchestration_workflow.trim()
        : null;

    // Validate that the orchestration workflow exists if specified
    if (orchestrationWorkflowId && !workflowIds.has(orchestrationWorkflowId)) {
      throwDivisionValidationError("division.orchestration_workflow_missing", {
        divisionId: divisionConfig.id,
        orchestrationWorkflowId,
      });
    }

    // Validate each workflow's owning division and static structure.
    for (const workflow of workflows) {
      // Verify the workflow's division ID matches this division
      if (workflow.divisionId !== divisionConfig.id) {
        throwDivisionWorkflowError("workflow.division_mismatch", {
          workflowId: workflow.workflowId,
          workflowDivisionId: workflow.divisionId,
          divisionId: divisionConfig.id,
        });
      }

      // Lint the workflow for structural validity
      const issues = new WorkflowValidator().validate(workflow);
      const errors = issues.filter((issue) => issue.severity === "error");
      if (errors.length > 0) {
        const firstError = errors[0]!;
        throwDivisionWorkflowError("workflow.invalid", {
          workflowId: workflow.workflowId,
          reasonCode: firstError.code ?? "unknown",
        });
      }
    }

    // R19-15: Resolve and validate resource quotas for the division
    const provisionalDivision: LoadedDivisionDefinition = {
      id: divisionConfig.id,
      version: String(divisionConfig.version ?? "1"),
      name: divisionConfig.name,
      description:
        typeof divisionConfig.description === "string" ? divisionConfig.description : "",
      priority: toInteger(divisionConfig.priority, 100),
      triggers: toStringArray(divisionConfig.triggers),
      defaultWorkflowId: divisionConfig.default_workflow,
      orchestrationWorkflowId,
      roles,
      workflows,
      rootPath: divisionRoot,
    };

    let resolvedQuotas: readonly DivisionResourceQuota[] = [];
    if (this.enableResourceQuotaValidation) {
      const quotaResult = this.resolveResourceQuotas(provisionalDivision);
      resolvedQuotas = quotaResult.quotas;
      // Log violations but don't fail loading - quotas can be adjusted
      if (quotaResult.violations.length > 0) {
        logger.warn("division.quota_violations", {
          divisionId: divisionConfig.id,
          violations: quotaResult.violations,
        });
      }
    }

    // §37: Parse DomainDescriptor, DomainRiskProfile, and DomainEvalSpec from division config
    const domainDescriptor = this.parseDomainDescriptor(divisionConfig.domain_descriptor, divisionConfig.id);
    const riskProfile = this.parseRiskProfile(divisionConfig.risk_profile, divisionConfig.id);
    const evalSpec = this.parseEvalSpec(divisionConfig.eval_spec, divisionConfig.id);

    // Construct and return the fully loaded division definition
    return {
      id: divisionConfig.id,
      version: String(divisionConfig.version ?? "1"),
      name: divisionConfig.name,
      description:
        typeof divisionConfig.description === "string" ? divisionConfig.description : "",
      priority: toInteger(divisionConfig.priority, 100),
      triggers: toStringArray(divisionConfig.triggers),
      defaultWorkflowId: divisionConfig.default_workflow,
      orchestrationWorkflowId,
      roles,
      workflows,
      rootPath: divisionRoot,
      quotas: resolvedQuotas,
      domainDescriptor,
      riskProfile,
      evalSpec,
    };
  }

  /**
   * Parses the domain_descriptor field from division.yaml into a DomainDescriptor.
   * §37: DomainDescriptor contains core domain information.
   */
  private parseDomainDescriptor(raw: unknown, divisionId: string): DomainDescriptor | undefined {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      return undefined;
    }
    const desc = raw as Record<string, unknown>;
    return {
      domainId: typeof desc.domainId === "string" ? desc.domainId : divisionId,
      ownerOrgNodeId: typeof desc.ownerOrgNodeId === "string" ? desc.ownerOrgNodeId : "",
      primaryEntities: toStringArray(desc.primaryEntities),
      recipeArchetype: typeof desc.recipeArchetype === "string" ? desc.recipeArchetype : "crud_heavy",
      lifecycleState: this.normalizeLifecycleState(desc.lifecycleState),
    };
  }

  /**
   * Parses the risk_profile field from division.yaml into a DomainRiskProfile.
   * §37: DomainRiskProfile contains risk classification information.
   */
  private parseRiskProfile(raw: unknown, divisionId: string): DomainRiskProfile | undefined {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      return undefined;
    }
    const profile = raw as Record<string, unknown>;
    return {
      profileId: typeof profile.profileId === "string" ? profile.profileId : `${divisionId}.risk`,
      domainId: typeof profile.domainId === "string" ? profile.domainId : divisionId,
      riskLevel: this.normalizeRiskLevel(profile.riskLevel),
      advisoryOnly: typeof profile.advisoryOnly === "boolean" ? profile.advisoryOnly : false,
      humanAccountable: typeof profile.humanAccountable === "boolean" ? profile.humanAccountable : false,
      deterministicHotPathOnly: typeof profile.deterministicHotPathOnly === "boolean" ? profile.deterministicHotPathOnly : false,
      regulatoryClass: typeof profile.regulatoryClass === "string" ? profile.regulatoryClass : "lightly_regulated",
    };
  }

  /**
   * Parses the eval_spec field from division.yaml into a DomainEvalSpec.
   * §37: DomainEvalSpec contains evaluation specifications.
   */
  private parseEvalSpec(raw: unknown, divisionId: string): DomainEvalSpec | undefined {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      return undefined;
    }
    const spec = raw as Record<string, unknown>;
    const acceptanceThresholds: Record<string, number> = {};
    if (spec.acceptanceThresholds != null && typeof spec.acceptanceThresholds === "object" && !Array.isArray(spec.acceptanceThresholds)) {
      const thresholds = spec.acceptanceThresholds as Record<string, unknown>;
      for (const [key, value] of Object.entries(thresholds)) {
        if (typeof value === "number") {
          acceptanceThresholds[key] = value;
        }
      }
    }
    return {
      domainId: typeof spec.domainId === "string" ? spec.domainId : divisionId,
      evalBaselines: toStringArray(spec.evalBaselines),
      criticalCases: toStringArray(spec.criticalCases),
      acceptanceThresholds,
      adversarialScenarios: toStringArray(spec.adversarialScenarios),
    };
  }

  private normalizeLifecycleState(value: unknown): DomainLifecycleState {
    const validStates: DomainLifecycleState[] = [
      "draft", "validating", "testing", "certified", "registered",
      "canary", "active", "deprecated", "retired", "archived", "updating", "validated",
    ];
    if (typeof value === "string" && validStates.includes(value as DomainLifecycleState)) {
      return value as DomainLifecycleState;
    }
    return "draft";
  }

  private normalizeRiskLevel(value: unknown): DomainRiskLevel {
    if (typeof value === "string" && ["low", "medium", "high", "critical"].includes(value)) {
      return value as DomainRiskLevel;
    }
    return "medium";
  }

  /**
   * Loads all role definitions for a division from the raw configuration.
   *
   * Each role definition includes:
   * - ID and name
   * - Prompt template loaded from an external file
   * - Model configuration
   * - Tools availability
   * - Instance limits
   *
   * @param divisionRoot - Absolute path to the division's root directory
   * @param rawRoles - Raw untyped roles array from YAML parsing
   * @param policy - Sandbox policy for file access
   * @returns Array of fully loaded role definitions
   */
  private loadRoles(
    divisionRoot: string,
    rawRoles: unknown,
    policy: SandboxPolicy,
  ): DivisionRoleDefinition[] {
    const roles = toObjectArray(rawRoles);
    const seenIds = new Set<string>();

    return roles.map((entry) => {
      const roleConfig = entry as unknown as RawDivisionRoleConfig;
      // Validate that role has an ID
      const roleId = expectNonEmptyString(roleConfig.id, "division.role_missing_id");

      // Check for duplicate role IDs within this division
      if (seenIds.has(roleId)) {
        throwDivisionValidationError("division.role_duplicate", { roleId });
      }
      seenIds.add(roleId);

      // Load the prompt template from the path specified in the role config
      const promptPath = join(
        divisionRoot,
        expectNonEmptyString(roleConfig.prompt, `division.role_prompt_missing:${roleId}`),
      );
      const promptText = this.readSandboxedFile(policy, promptPath);

      return {
        id: roleId,
        // Use provided name or fall back to role ID
        name:
          typeof roleConfig.name === "string" && roleConfig.name.trim().length > 0
            ? roleConfig.name.trim()
            : roleId,
        promptPath,
        promptText,
        // Use provided model or fall back to "balanced"
        model:
          typeof roleConfig.model === "string" && roleConfig.model.trim().length > 0
            ? roleConfig.model.trim()
            : "balanced",
        tools: toStringArray(roleConfig.tools),
        // Parse max_instances or null if not specified
        maxInstances:
          roleConfig.max_instances == null ? null : toInteger(roleConfig.max_instances, null),
      };
    });
  }

  /**
   * Loads all workflow definitions from a division's workflows subdirectory.
   *
   * Workflows are loaded from YAML files in alphabetical order.
   * If the workflows directory doesn't exist, returns an empty array.
   *
   * @param divisionRoot - Absolute path to the division's root directory
   * @param policy - Sandbox policy for file access
   * @returns Array of loaded workflow definitions
   */
  private loadWorkflows(divisionRoot: string, policy: SandboxPolicy): MinimalWorkflowDefinition[] {
    const workflowsRoot = join(divisionRoot, "workflows");
    const workflowsRootCheck = checkSandboxPath(policy, workflowsRoot);

    // Verify the workflows directory is allowed by sandbox policy
    if (!workflowsRootCheck.allowed) {
      throwDivisionSandboxError(workflowsRootCheck.reasonCode ?? "workflow.root_denied", {
        path: workflowsRoot,
      });
    }

    // Return empty array if the workflows directory doesn't exist
    if (!existsSync(workflowsRootCheck.normalizedPath)) {
      return [];
    }

    // Find all YAML files, sort alphabetically, and parse each workflow
    return readdirSync(workflowsRootCheck.normalizedPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
      // Sort for deterministic loading order
      .sort((left, right) => left.name.localeCompare(right.name))
      // Convert to full paths
      .map((entry) => join(workflowsRootCheck.normalizedPath, entry.name))
      // Parse and validate each workflow
      .map((filePath) =>
        this.parseWorkflowConfig(this.readSandboxedFile(policy, filePath), filePath, divisionRoot, policy),
      );
  }

  /**
   * Reads a file from disk, first validating it against the sandbox policy.
   *
   * @param policy - Sandbox policy controlling file access
   * @param filePath - Path to the file to read
   * @returns The file contents as a UTF-8 string
   * @throws Error if the file is denied by the sandbox policy
   */
  private readSandboxedFile(policy: SandboxPolicy, filePath: string): string {
    const fileCheck = checkSandboxPath(policy, filePath);
    if (!fileCheck.allowed) {
      throwDivisionSandboxError(fileCheck.reasonCode ?? "sandbox.file_denied", {
        path: filePath,
      });
    }

    return readFileSync(fileCheck.normalizedPath, "utf8");
  }

  /**
   * Parses a division.yaml configuration file.
   *
   * @param raw - Raw YAML string content
   * @param sourcePath - Path to the source file (for error messages)
   * @returns The parsed raw division configuration with validated types
   */
  private parseDivisionConfig(raw: string, sourcePath: string): RawDivisionConfig {
    const parsed = parseLimitedYaml(raw, sourcePath);
    if (!isPlainObject(parsed)) {
      throwDivisionValidationError("division.invalid_shape", { sourcePath });
    }

    // §37: Normalize domain_descriptor - support both singular (new) and plural (legacy) forms
    // If plural form exists (legacy), extract the first element for backward compatibility
    const domainDescriptor = parsed.domain_descriptor ?? this.extractFirstFromArray(parsed.domain_descriptors);
    const riskProfile = parsed.risk_profile ?? this.extractFirstFromArray(parsed.risk_profiles);
    const evalSpec = parsed.eval_spec ?? this.extractFirstFromArray(parsed.eval_specs);

    return {
      id: expectNonEmptyString(parsed.id, `division.id_missing:${sourcePath}`),
      version: parsed.version,
      name: expectNonEmptyString(parsed.name, `division.name_missing:${sourcePath}`),
      description: parsed.description,
      priority: parsed.priority,
      default_workflow: expectNonEmptyString(
        parsed.default_workflow,
        `division.default_workflow_missing:${sourcePath}`,
      ),
      orchestration_workflow: parsed.orchestration_workflow,
      triggers: parsed.triggers,
      roles: parsed.roles,
      // §37: DomainDescriptor structured hierarchy
      domain_descriptor: domainDescriptor,
      risk_profile: riskProfile,
      eval_spec: evalSpec,
    };
  }

  /**
   * Extracts the first element from an array if the value is an array.
   * Used for backward compatibility with legacy plural YAML keys.
   */
  private extractFirstFromArray(value: unknown): unknown {
    if (Array.isArray(value) && value.length > 0) {
      return value[0];
    }
    return undefined;
  }

  /**
   * Parses a workflow.yaml configuration file.
   *
   * @param raw - Raw YAML string content
   * @param sourcePath - Path to the source file (for error messages)
   * @returns The parsed workflow definition
   */
  private parseWorkflowConfig(
    raw: string,
    sourcePath: string,
    divisionRoot: string,
    policy: SandboxPolicy,
  ): MinimalWorkflowDefinition {
    const parsed = parseLimitedYaml(raw, sourcePath);
    if (!isPlainObject(parsed)) {
      throwDivisionValidationError("workflow.invalid_shape", { sourcePath });
    }

    const config = parsed as unknown as RawWorkflowConfig;
    return {
      workflowId: expectNonEmptyString(config.id, `workflow.id_missing:${sourcePath}`),
      divisionId: expectNonEmptyString(config.division_id, `workflow.division_id_missing:${sourcePath}`),
      steps: toObjectArray(config.steps).map((entry, index) =>
        this.toWorkflowStep(entry as unknown as RawWorkflowStepConfig, sourcePath, index, divisionRoot, policy),
      ),
    };
  }

  /**
   * Converts a raw workflow step configuration to a typed MinimalWorkflowStep.
   *
   * @param entry - Raw workflow step configuration
   * @param sourcePath - Path to the source file (for error messages)
   * @param index - Step index in the workflow (for error messages)
   * @returns The validated and typed workflow step definition
   */
  private toWorkflowStep(
    entry: RawWorkflowStepConfig,
    sourcePath: string,
    index: number,
    divisionRoot: string,
    policy: SandboxPolicy,
  ): MinimalWorkflowStep {
    return {
      stepId: expectNonEmptyString(entry.step_id, `workflow.step_id_missing:${sourcePath}:${index}`),
      divisionId:
        typeof entry.division_id === "string" && entry.division_id.trim().length > 0
          ? entry.division_id.trim()
          : null,
      roleId: expectNonEmptyString(entry.role_id, `workflow.role_id_missing:${sourcePath}:${index}`),
      inputKeys: toStringArray(entry.input_keys),
      outputKey: expectNonEmptyString(
        entry.output_key,
        `workflow.output_key_missing:${sourcePath}:${index}`,
      ),
      outputSchemaPath: this.resolveWorkflowOutputSchemaPath(
        entry.output_schema,
        sourcePath,
        index,
        divisionRoot,
        policy,
      ),
      timeoutMs: toInteger(entry.timeout_ms, NaN),
      maxAttempts: toInteger(entry.max_attempts, NaN),
      dependsOnStepIds: toStringArray(entry.depends_on),
    };
  }

  private resolveWorkflowOutputSchemaPath(
    schemaPath: unknown,
    sourcePath: string,
    index: number,
    divisionRoot: string,
    policy: SandboxPolicy,
  ): string {
    const relativeSchemaPath = expectNonEmptyString(
      schemaPath,
      `workflow.output_schema_missing:${sourcePath}:${index}`,
    );
    const divisionScopedPolicy: SandboxPolicy = {
      ...policy,
      allowedRoots: [divisionRoot],
    };
    const candidatePath = resolve(divisionRoot, relativeSchemaPath);

    if (!existsSync(candidatePath)) {
      throwDivisionValidationError("workflow.output_schema_missing", { sourcePath, index, candidatePath });
    }

    const schemaCheck = checkSandboxPath(divisionScopedPolicy, candidatePath);
    if (!schemaCheck.allowed) {
      throwDivisionSandboxError(schemaCheck.reasonCode ?? "workflow.output_schema_invalid", {
        sourcePath,
        index,
        candidatePath,
      });
    }

    parseWorkflowOutputSchema(
      this.readSandboxedFile(divisionScopedPolicy, schemaCheck.normalizedPath),
      schemaCheck.normalizedPath,
    );

    return schemaCheck.normalizedPath;
  }

  private validateLoadedRegistry(divisions: ReadonlyMap<string, LoadedDivisionDefinition>): void {
    for (const division of divisions.values()) {
      for (const workflow of division.workflows) {
        const stepIds = new Set(workflow.steps.map((step) => step.stepId));
        const referencedBy = new Set<string>();

        for (const step of workflow.steps) {
          const stepDivisionId = step.divisionId ?? workflow.divisionId;
          if (stepDivisionId !== workflow.divisionId && !this.allowCrossDivisionDag) {
            throwDivisionWorkflowError("workflow.cross_division_disabled", {
              workflowId: workflow.workflowId,
              stepId: step.stepId,
              stepDivisionId,
            });
          }

          const referencedDivision = divisions.get(stepDivisionId);
          if (!referencedDivision) {
            throwDivisionWorkflowError("workflow.step_division_missing", {
              workflowId: workflow.workflowId,
              stepId: step.stepId,
              stepDivisionId,
            });
          }

          if (!referencedDivision.roles.some((role) => role.id === step.roleId)) {
            throwDivisionWorkflowError("workflow.role_missing", {
              workflowId: workflow.workflowId,
              stepDivisionId,
              roleId: step.roleId,
            });
          }

          for (const dependencyStepId of step.dependsOnStepIds ?? []) {
            if (stepIds.has(dependencyStepId)) {
              referencedBy.add(dependencyStepId);
            }
          }
        }

        for (const step of workflow.steps) {
          const hasDependencies = (step.dependsOnStepIds?.length ?? 0) > 0;
          const isReferenced = referencedBy.has(step.stepId);
          if (!hasDependencies && !isReferenced && workflow.steps.length > 1) {
            throwDivisionWorkflowError("workflow.orphaned_step", {
              workflowId: workflow.workflowId,
              stepId: step.stepId,
            });
          }
        }

        if (workflow.steps.length <= 1) {
          continue;
        }

        const graph = new Map<string, Set<string>>();
        for (const step of workflow.steps) {
          graph.set(step.stepId, new Set<string>());
        }
        for (const step of workflow.steps) {
          for (const dependencyStepId of step.dependsOnStepIds ?? []) {
            if (!stepIds.has(dependencyStepId)) {
              continue;
            }
            graph.get(step.stepId)?.add(dependencyStepId);
            graph.get(dependencyStepId)?.add(step.stepId);
          }
        }

        const [firstStep] = workflow.steps;
        const queue = firstStep ? [firstStep.stepId] : [];
        const visited = new Set<string>();
        while (queue.length > 0) {
          const stepId = queue.shift();
          if (!stepId || visited.has(stepId)) {
            continue;
          }
          visited.add(stepId);
          for (const adjacentStepId of graph.get(stepId) ?? []) {
            if (!visited.has(adjacentStepId)) {
              queue.push(adjacentStepId);
            }
          }
        }

        const disconnectedStep = workflow.steps.find((step) => !visited.has(step.stepId));
        if (disconnectedStep) {
          throwDivisionWorkflowError("workflow.disconnected_step", {
            workflowId: workflow.workflowId,
            stepId: disconnectedStep.stepId,
          });
        }
      }
    }
  }
}

function resolveConfiguredCrossDivisionDagFlag(options: ConfiguredDivisionRegistryOptions): boolean {
  if (options.allowCrossDivisionDag != null) {
    return options.allowCrossDivisionDag;
  }

  try {
    const bundle = new ConfigGovernanceService({
      ...(options.configRoot ? { configRoot: options.configRoot } : {}),
      ...(options.sandboxPolicy ? { sandboxPolicy: options.sandboxPolicy } : {}),
    }).loadBundle(resolveConfigEnvironment({
      environment: options.environment,
    }));
    const allowCrossDivisionDag = bundle.layers.workflows?.allowCrossDivisionDag;
    return typeof allowCrossDivisionDag === "boolean" ? allowCrossDivisionDag : false;
  } catch (err) {
    logger.debug("getAllowCrossDivisionDag failed", { error: err });
    return false;
  }
}

/**
 * Gets the default division registry, using a cached result if available.
 *
 * This function maintains a module-level cache to avoid repeated filesystem
 * operations. The cache is populated on first call and reused for subsequent
 * calls. This is useful for services that need to access divisions frequently.
 *
 * @returns The loaded division registry, or null if loading failed
 */
export function getDefaultDivisionRegistry(): DivisionRegistry | null {
  // Return cached result if available
  if (defaultRegistryCache !== undefined) {
    return defaultRegistryCache;
  }

  try {
    // Load all divisions using default settings
    defaultRegistryCache = loadConfiguredDivisionRegistry();
    return defaultRegistryCache;
  } catch (err) {
    logger.debug("getDefaultDivisionRegistry failed", { error: err });
    // Cache null to indicate loading failed (don't retry)
    defaultRegistryCache = null;
    return defaultRegistryCache;
  }
}

/**
 * Clears the default division registry cache.
 *
 * This function is intended for testing purposes only, where tests need
 * to reload divisions with different configurations. Using this in production
 * may cause performance issues due to repeated filesystem operations.
 */
export function clearDefaultDivisionRegistryCacheForTests(): void {
  defaultRegistryCache = undefined;
}

/**
 * Creates a new division loader and loads all divisions from the filesystem.
 *
 * This is a convenience function that creates a DivisionLoader with optional
 * custom configuration and immediately loads all divisions. Use this when you
 * need to load divisions with non-default options (custom root path, sandbox
 * policy, etc.).
 *
 * @param options - Configuration options for the loader
 * @returns A complete registry of all divisions and their workflows
 */
export function loadDivisionRegistry(options: DivisionLoaderOptions = {}): DivisionRegistry {
  return new DivisionLoader(options).loadAll();
}

export function loadConfiguredDivisionRegistry(
  options: ConfiguredDivisionRegistryOptions = {},
): DivisionRegistry {
  const { ...loaderOptions } = options;
  return new DivisionLoader({
    ...loaderOptions,
    allowCrossDivisionDag: resolveConfiguredCrossDivisionDagFlag(options),
  }).loadAll();
}

/**
 * Tokenizes a YAML source string into parsed lines with indentation tracking.
 *
 * This preprocessor:
 * - Splits the raw text into lines
 * - Records original line numbers for error reporting
 * - Filters out empty lines and comments (lines starting with #)
 * - Calculates indentation level for each line
 *
 * @param raw - The raw YAML source string to tokenize
 * @returns Array of parsed lines with indent, text, and line number information
 */
