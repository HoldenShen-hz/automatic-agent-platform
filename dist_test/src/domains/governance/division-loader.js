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
import { checkSandboxPath, createWorkspaceWritePolicy, } from "../../platform/control-plane/iam/sandbox-policy.js";
import { ConfigGovernanceService } from "../../platform/control-plane/config-center/config-governance-service.js";
import { resolveConfigEnvironment } from "../../platform/control-plane/config-center/runtime-env.js";
import { parseWorkflowOutputSchema } from "../../platform/orchestration/oapeflir/workflow/output-schema.js";
import { WorkflowValidator } from "../../platform/orchestration/oapeflir/workflow/workflow-validator.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { SandboxError, ValidationError } from "../../platform/contracts/errors.js";
import { DEFAULT_DIVISIONS_ROOT, expectNonEmptyString, isPlainObject, parseLimitedYaml, toInteger, toObjectArray, toStringArray, throwDivisionSandboxError, throwDivisionValidationError, throwDivisionWorkflowError, } from "./division-loader-support.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
/**
 * Represents a single non-empty, non-comment line from a YAML source file.
 * Used during the minimal YAML parsing process.
 */
/**
 * Module-level cache for the default division registry.
 * Used to avoid repeated filesystem operations for the default loader.
 * Can be cleared for testing purposes.
 */
let defaultRegistryCache;
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
    divisionsRoot;
    sandboxPolicy;
    allowCrossDivisionDag;
    /**
     * Creates a new division loader instance.
     *
     * @param options - Configuration options including divisions root and sandbox policy
     */
    constructor(options = {}) {
        this.divisionsRoot = options.divisionsRoot ?? DEFAULT_DIVISIONS_ROOT;
        // Default policy restricts access to the current working directory
        this.sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(process.cwd());
        this.allowCrossDivisionDag = options.allowCrossDivisionDag ?? false;
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
    loadAll() {
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
        const effectivePolicy = {
            ...this.sandboxPolicy,
            allowedRoots: [rootCheck.normalizedPath],
        };
        const divisions = new Map();
        const workflows = new Map();
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
    loadDivision(divisionRoot, policy) {
        // Parse the main division configuration file
        const divisionConfigPath = join(divisionRoot, "division.yaml");
        const divisionConfig = this.parseDivisionConfig(this.readSandboxedFile(policy, divisionConfigPath), divisionConfigPath);
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
        const orchestrationWorkflowId = typeof divisionConfig.orchestration_workflow === "string"
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
            const lintReport = new WorkflowValidator().validate(workflow);
            if (!lintReport.ok) {
                const firstError = lintReport.issues.find((issue) => issue.severity === "error");
                throwDivisionWorkflowError("workflow.invalid", {
                    workflowId: workflow.workflowId,
                    reasonCode: firstError?.code ?? "unknown",
                });
            }
        }
        // Construct and return the fully loaded division definition
        return {
            id: divisionConfig.id,
            version: String(divisionConfig.version ?? "1"),
            name: divisionConfig.name,
            description: typeof divisionConfig.description === "string" ? divisionConfig.description : "",
            priority: toInteger(divisionConfig.priority, 100),
            triggers: toStringArray(divisionConfig.triggers),
            defaultWorkflowId: divisionConfig.default_workflow,
            orchestrationWorkflowId,
            roles,
            workflows,
            rootPath: divisionRoot,
        };
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
    loadRoles(divisionRoot, rawRoles, policy) {
        const roles = toObjectArray(rawRoles);
        const seenIds = new Set();
        return roles.map((entry) => {
            const roleConfig = entry;
            // Validate that role has an ID
            const roleId = expectNonEmptyString(roleConfig.id, "division.role_missing_id");
            // Check for duplicate role IDs within this division
            if (seenIds.has(roleId)) {
                throwDivisionValidationError("division.role_duplicate", { roleId });
            }
            seenIds.add(roleId);
            // Load the prompt template from the path specified in the role config
            const promptPath = join(divisionRoot, expectNonEmptyString(roleConfig.prompt, `division.role_prompt_missing:${roleId}`));
            const promptText = this.readSandboxedFile(policy, promptPath);
            return {
                id: roleId,
                // Use provided name or fall back to role ID
                name: typeof roleConfig.name === "string" && roleConfig.name.trim().length > 0
                    ? roleConfig.name.trim()
                    : roleId,
                promptPath,
                promptText,
                // Use provided model or fall back to "balanced"
                model: typeof roleConfig.model === "string" && roleConfig.model.trim().length > 0
                    ? roleConfig.model.trim()
                    : "balanced",
                tools: toStringArray(roleConfig.tools),
                // Parse max_instances or null if not specified
                maxInstances: roleConfig.max_instances == null ? null : toInteger(roleConfig.max_instances, null),
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
    loadWorkflows(divisionRoot, policy) {
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
            .map((filePath) => this.parseWorkflowConfig(this.readSandboxedFile(policy, filePath), filePath, divisionRoot, policy));
    }
    /**
     * Reads a file from disk, first validating it against the sandbox policy.
     *
     * @param policy - Sandbox policy controlling file access
     * @param filePath - Path to the file to read
     * @returns The file contents as a UTF-8 string
     * @throws Error if the file is denied by the sandbox policy
     */
    readSandboxedFile(policy, filePath) {
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
    parseDivisionConfig(raw, sourcePath) {
        const parsed = parseLimitedYaml(raw, sourcePath);
        if (!isPlainObject(parsed)) {
            throwDivisionValidationError("division.invalid_shape", { sourcePath });
        }
        return {
            id: expectNonEmptyString(parsed.id, `division.id_missing:${sourcePath}`),
            version: parsed.version,
            name: expectNonEmptyString(parsed.name, `division.name_missing:${sourcePath}`),
            description: parsed.description,
            priority: parsed.priority,
            default_workflow: expectNonEmptyString(parsed.default_workflow, `division.default_workflow_missing:${sourcePath}`),
            orchestration_workflow: parsed.orchestration_workflow,
            triggers: parsed.triggers,
            roles: parsed.roles,
        };
    }
    /**
     * Parses a workflow.yaml configuration file.
     *
     * @param raw - Raw YAML string content
     * @param sourcePath - Path to the source file (for error messages)
     * @returns The parsed workflow definition
     */
    parseWorkflowConfig(raw, sourcePath, divisionRoot, policy) {
        const parsed = parseLimitedYaml(raw, sourcePath);
        if (!isPlainObject(parsed)) {
            throwDivisionValidationError("workflow.invalid_shape", { sourcePath });
        }
        const config = parsed;
        return {
            workflowId: expectNonEmptyString(config.id, `workflow.id_missing:${sourcePath}`),
            divisionId: expectNonEmptyString(config.division_id, `workflow.division_id_missing:${sourcePath}`),
            steps: toObjectArray(config.steps).map((entry, index) => this.toWorkflowStep(entry, sourcePath, index, divisionRoot, policy)),
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
    toWorkflowStep(entry, sourcePath, index, divisionRoot, policy) {
        return {
            stepId: expectNonEmptyString(entry.step_id, `workflow.step_id_missing:${sourcePath}:${index}`),
            divisionId: typeof entry.division_id === "string" && entry.division_id.trim().length > 0
                ? entry.division_id.trim()
                : null,
            roleId: expectNonEmptyString(entry.role_id, `workflow.role_id_missing:${sourcePath}:${index}`),
            inputKeys: toStringArray(entry.input_keys),
            outputKey: expectNonEmptyString(entry.output_key, `workflow.output_key_missing:${sourcePath}:${index}`),
            outputSchemaPath: this.resolveWorkflowOutputSchemaPath(entry.output_schema, sourcePath, index, divisionRoot, policy),
            timeoutMs: toInteger(entry.timeout_ms, NaN),
            maxAttempts: toInteger(entry.max_attempts, NaN),
            dependsOnStepIds: toStringArray(entry.depends_on),
        };
    }
    resolveWorkflowOutputSchemaPath(schemaPath, sourcePath, index, divisionRoot, policy) {
        const relativeSchemaPath = expectNonEmptyString(schemaPath, `workflow.output_schema_missing:${sourcePath}:${index}`);
        const divisionScopedPolicy = {
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
        parseWorkflowOutputSchema(this.readSandboxedFile(divisionScopedPolicy, schemaCheck.normalizedPath), schemaCheck.normalizedPath);
        return schemaCheck.normalizedPath;
    }
    validateLoadedRegistry(divisions) {
        for (const division of divisions.values()) {
            for (const workflow of division.workflows) {
                const stepIds = new Set(workflow.steps.map((step) => step.stepId));
                const referencedBy = new Set();
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
                const graph = new Map();
                for (const step of workflow.steps) {
                    graph.set(step.stepId, new Set());
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
                const visited = new Set();
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
function resolveConfiguredCrossDivisionDagFlag(options) {
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
    }
    catch (err) {
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
export function getDefaultDivisionRegistry() {
    // Return cached result if available
    if (defaultRegistryCache !== undefined) {
        return defaultRegistryCache;
    }
    try {
        // Load all divisions using default settings
        defaultRegistryCache = loadConfiguredDivisionRegistry();
        return defaultRegistryCache;
    }
    catch (err) {
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
export function clearDefaultDivisionRegistryCacheForTests() {
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
export function loadDivisionRegistry(options = {}) {
    return new DivisionLoader(options).loadAll();
}
export function loadConfiguredDivisionRegistry(options = {}) {
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
//# sourceMappingURL=division-loader.js.map