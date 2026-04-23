/**
 * Skill Creator Service
 *
 * Provides skill scaffolding creation and validation within a sandboxed environment.
 * A "skill" is a reusable workflow package that encapsulates:
 * - Metadata (name, description, version, author)
 * - Required tools and permissions
 * - Role-based access control
 * - Resource directories (scripts, references, assets)
 *
 * The service creates a standardized skill structure on disk and optionally registers
 * the skill with a governance service for lifecycle management.
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/sandbox_contract.md}
 */
import type { SkillLifecycle, SkillRiskLevel, SkillGovernanceService, ValidateSkillResult } from "./skill-governance-service.js";
/**
 * Actions supported by the skill creator: create a new skill or validate an existing scaffold.
 */
export type SkillCreatorAction = "create" | "validate";
/**
 * Resource directory types that a skill may optionally include.
 */
export type SkillCreatorResourceDirectory = "scripts" | "references" | "assets";
/**
 * Request to create a new skill scaffold on disk.
 */
export interface CreateSkillRequest {
    /** Root directory where the skill will be created */
    skillRoot: string;
    /** Human-readable name for the skill */
    name: string;
    /** Description of what the skill does */
    description: string;
    /** Semantic version string (default: "1.0.0") */
    version?: string;
    /** Author identifier (default: "automatic-agent-platform") */
    author?: string;
    /** Tools required to execute this skill */
    requiredTools?: readonly string[];
    /** Permissions required by the skill */
    requiredPermissions?: readonly string[];
    /** Tags for categorization and discovery */
    tags?: readonly string[];
    /** Roles that are allowed to use this skill */
    applicableRoles?: readonly string[];
    /** Resource directories to create (scripts, references, assets) */
    resourceDirectories?: readonly SkillCreatorResourceDirectory[];
    /** Whether to generate OpenAI agent YAML (default: true) */
    includeOpenAiAgent?: boolean;
    /** Whether to register the skill in the governance registry */
    registerInRegistry?: boolean;
    /** Whether to overwrite an existing non-empty skill directory */
    overwriteAllowed?: boolean;
    /** Risk level classification (default: "low") */
    riskLevel?: SkillRiskLevel;
    /** Lifecycle stage (default: "draft") */
    lifecycle?: SkillLifecycle;
    /** Whether skill results can be cached */
    cacheable?: boolean;
    /** Cache time-to-live in seconds (default: 3600) */
    cacheTtlSeconds?: number;
}
/**
 * Request to validate an existing skill scaffold without modifying it.
 */
export interface ValidateSkillScaffoldRequest {
    /** Path to the skill directory to validate */
    skillPath: string;
}
/**
 * Result of a skill creation operation.
 */
export interface SkillCreatorResult {
    /** Unique identifier for the created skill */
    skillId: string;
    /** URL-safe slug derived from the skill name */
    skillSlug: string;
    /** Root directory where skill was created */
    skillRoot: string;
    /** Full path to the skill directory */
    skillPath: string;
    /** Files created during scaffolding */
    createdFiles: readonly string[];
    /** Directories created during scaffolding */
    createdDirectories: readonly string[];
    /** Whether the skill was registered in the governance registry */
    registered: boolean;
    /** Warnings generated during creation */
    warnings: readonly string[];
    /** Validation result for the skill definition */
    validation: ValidateSkillResult;
}
/**
 * Result of validating a skill scaffold on disk.
 */
export interface SkillScaffoldValidationResult {
    /** Whether the scaffold is valid */
    valid: boolean;
    /** Extracted skill ID if determinable */
    skillId: string | null;
    /** Path that was validated */
    skillPath: string;
    /** Errors preventing the skill from being valid */
    errors: readonly string[];
    /** Warnings about the skill structure */
    warnings: readonly string[];
    /** Required SKILL.md sections that are missing */
    missingSections: readonly string[];
}
/**
 * Converts a skill name into a URL-safe slug.
 * The slug must be lowercase kebab-case starting with a letter.
 *
 * @param name - The human-readable skill name
 * @returns The normalized slug
 * @throws ValidationError if the name cannot be slugified
 */
export declare function slugifySkillName(name: string): string;
/**
 * SkillCreatorService handles the creation and validation of skill scaffolds.
 *
 * A skill scaffold is a directory structure containing:
 * - SKILL.md: Primary documentation describing the skill
 * - agents/openai.yaml: OpenAI agent configuration (optional)
 * - scripts/: Directory for executable scripts (optional)
 * - references/: Documentation and reference materials (optional)
 * - assets/: Static assets needed by the skill (optional)
 *
 * The service validates all paths against sandbox policy before creating
 * files to ensure skills can only be created in allowed workspace areas.
 */
export declare class SkillCreatorService {
    private readonly options;
    /**
     * Creates a new SkillCreatorService.
     *
     * @param options - Configuration options
     * @param options.governance - Optional governance service for skill registration
     * @param options.now - Optional time provider for timestamps (defaults to nowIso)
     */
    constructor(options?: {
        governance?: SkillGovernanceService | null;
        now?: () => string;
    });
    /**
     * Creates a new skill scaffold on disk.
     *
     * This method:
     * 1. Validates the skill name and generates a slug
     * 2. Checks sandbox policy to ensure the target path is allowed
     * 3. Creates the skill directory structure
     * 4. Writes SKILL.md with the skill description
     * 5. Optionally creates resource directories and OpenAI agent config
     * 6. Optionally registers the skill with the governance service
     *
     * @param request - The skill creation request
     * @returns Result containing created files, directories, and registration status
     */
    createSkill(request: CreateSkillRequest): SkillCreatorResult;
    /**
     * Validates an existing skill scaffold on disk.
     *
     * Checks for:
     * - Existence of required SKILL.md file
     * - Presence of all required markdown sections
     * - Existence of agents/openai.yaml (warning only)
     *
     * @param request - Validation request with path to check
     * @returns Validation result with errors, warnings, and missing sections
     */
    validateSkillScaffold(request: ValidateSkillScaffoldRequest): SkillScaffoldValidationResult;
    /**
     * Normalizes and ensures the skill root directory exists.
     */
    private prepareSkillRoot;
    /**
     * Validates that the target skill path is within allowed sandbox boundaries.
     * This prevents creating skills outside the designated workspace.
     */
    private assertTargetPathAllowed;
    /**
     * Validates a skill definition's structure and metadata.
     * Delegates to governance service if available, otherwise performs basic validation.
     */
    private validateSkillDefinition;
}
