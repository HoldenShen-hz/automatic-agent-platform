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
import { type SandboxPolicy } from "../../platform/control-plane/iam/sandbox-policy.js";
import type { MinimalWorkflowDefinition } from "../../platform/orchestration/oapeflir/workflow/minimal-workflow.js";
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
    /** ID of the orchestration workflow (if any) for multi-step requests */
    orchestrationWorkflowId: string | null;
    /** All roles defined in this division */
    roles: DivisionRoleDefinition[];
    /** All workflows defined in this division */
    workflows: MinimalWorkflowDefinition[];
    /** Absolute filesystem path to the division's root directory */
    rootPath: string;
}
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
 * Configuration options for the DivisionLoader.
 */
export interface DivisionLoaderOptions {
    /** Root directory containing division subdirectories (defaults to ./divisions) */
    divisionsRoot?: string;
    /** Sandbox policy controlling file system access */
    sandboxPolicy?: SandboxPolicy;
    /** Enables workflows whose steps execute across multiple divisions. Defaults to false. */
    allowCrossDivisionDag?: boolean;
}
export interface ConfiguredDivisionRegistryOptions extends DivisionLoaderOptions {
    /** Root directory containing layered config files (defaults to ./config) */
    configRoot?: string;
    /** Configuration environment to resolve (defaults to dev / AA_CONFIG_ENV) */
    environment?: string;
}
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
export declare class DivisionLoader {
    private readonly divisionsRoot;
    private readonly sandboxPolicy;
    private readonly allowCrossDivisionDag;
    /**
     * Creates a new division loader instance.
     *
     * @param options - Configuration options including divisions root and sandbox policy
     */
    constructor(options?: DivisionLoaderOptions);
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
    loadAll(): DivisionRegistry;
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
    private loadDivision;
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
    private loadRoles;
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
    private loadWorkflows;
    /**
     * Reads a file from disk, first validating it against the sandbox policy.
     *
     * @param policy - Sandbox policy controlling file access
     * @param filePath - Path to the file to read
     * @returns The file contents as a UTF-8 string
     * @throws Error if the file is denied by the sandbox policy
     */
    private readSandboxedFile;
    /**
     * Parses a division.yaml configuration file.
     *
     * @param raw - Raw YAML string content
     * @param sourcePath - Path to the source file (for error messages)
     * @returns The parsed raw division configuration with validated types
     */
    private parseDivisionConfig;
    /**
     * Parses a workflow.yaml configuration file.
     *
     * @param raw - Raw YAML string content
     * @param sourcePath - Path to the source file (for error messages)
     * @returns The parsed workflow definition
     */
    private parseWorkflowConfig;
    /**
     * Converts a raw workflow step configuration to a typed MinimalWorkflowStep.
     *
     * @param entry - Raw workflow step configuration
     * @param sourcePath - Path to the source file (for error messages)
     * @param index - Step index in the workflow (for error messages)
     * @returns The validated and typed workflow step definition
     */
    private toWorkflowStep;
    private resolveWorkflowOutputSchemaPath;
    private validateLoadedRegistry;
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
export declare function getDefaultDivisionRegistry(): DivisionRegistry | null;
/**
 * Clears the default division registry cache.
 *
 * This function is intended for testing purposes only, where tests need
 * to reload divisions with different configurations. Using this in production
 * may cause performance issues due to repeated filesystem operations.
 */
export declare function clearDefaultDivisionRegistryCacheForTests(): void;
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
export declare function loadDivisionRegistry(options?: DivisionLoaderOptions): DivisionRegistry;
export declare function loadConfiguredDivisionRegistry(options?: ConfiguredDivisionRegistryOptions): DivisionRegistry;
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
