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

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { PolicyDeniedError, SandboxError, ValidationError } from "../../contracts/errors.js";
import { checkSandboxPath, createWorkspaceWritePolicy } from "../../control-plane/iam/sandbox-policy.js";
import type {
  SkillLifecycle,
  SkillMetadata,
  SkillRiskLevel,
  SkillGovernanceService,
  ValidateSkillResult,
} from "./skill-governance-service.js";
import { nowIso } from "../../contracts/types/ids.js";

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
 * Default resource directories when none specified.
 */
const DEFAULT_RESOURCE_DIRECTORIES: readonly SkillCreatorResourceDirectory[] = [];

/**
 * Valid resource directory types.
 */
const OPTIONAL_RESOURCE_DIRECTORIES: readonly SkillCreatorResourceDirectory[] = ["scripts", "references", "assets"];

/**
 * Required section headings in SKILL.md.
 */
const REQUIRED_SKILL_HEADINGS = [
  "Description",
  "When To Use",
  "Inputs",
  "Workflow",
  "Safety Notes",
] as const;

/**
 * Deduplicates and cleans a list of strings, removing empty and whitespace-only entries.
 */
function uniqueStrings(items: readonly string[] | undefined): string[] {
  return Array.from(new Set((items ?? []).map((item) => item.trim()).filter((item) => item.length > 0)));
}

/**
 * Deduplicates resource directory entries, filtering out invalid types.
 */
function uniqueResourceDirectories(
  items: readonly SkillCreatorResourceDirectory[] | undefined,
): SkillCreatorResourceDirectory[] {
  return Array.from(
    new Set((items ?? DEFAULT_RESOURCE_DIRECTORIES).filter((item) => OPTIONAL_RESOURCE_DIRECTORIES.includes(item))),
  );
}

/**
 * Ensures the parent directory of a path exists, creating it if necessary.
 */
function ensureParentDirectory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

/**
 * Writes text content to a file, creating parent directories as needed.
 */
function writeTextFile(path: string, content: string): void {
  ensureParentDirectory(path);
  writeFileSync(path, content, "utf8");
}

/**
 * Reads directory entries, excluding hidden files (., ..).
 */
function readNonHiddenEntries(path: string): string[] {
  return readdirSync(path).filter((entry) => entry !== "." && entry !== "..");
}

/**
 * Creates a regex pattern for matching a markdown heading.
 */
function toHeadingPattern(heading: string): RegExp {
  return new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}$`, "m");
}

/**
 * Converts a skill name into a URL-safe slug.
 * The slug must be lowercase kebab-case starting with a letter.
 *
 * @param name - The human-readable skill name
 * @returns The normalized slug
 * @throws ValidationError if the name cannot be slugified
 */
export function slugifySkillName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (!normalized) {
    throw new ValidationError("skill_creator.invalid_name", "skill_creator.invalid_name", {
      source: "tool",
    });
  }
  if (!/^[a-z][a-z0-9-]*$/.test(normalized)) {
    throw new ValidationError("skill_creator.invalid_slug", "skill_creator.invalid_slug", {
      source: "tool",
      details: { normalized },
    });
  }
  return normalized;
}

/**
 * Generates the SKILL.md markdown content for a skill.
 * This is the primary documentation file that describes the skill's purpose,
 * when to use it, its inputs, workflow, and safety considerations.
 */
function renderSkillMarkdown(input: {
  skillSlug: string;
  name: string;
  description: string;
  requiredTools: readonly string[];
  applicableRoles: readonly string[];
}): string {
  const toolLines = input.requiredTools.length > 0
    ? input.requiredTools.map((tool) => `- \`${tool}\``).join("\n")
    : "- No required tools declared yet. Add them before activating the skill.";
  const roleLines = input.applicableRoles.length > 0
    ? input.applicableRoles.map((role) => `- \`${role}\``).join("\n")
    : "- Add applicable roles before broad rollout.";

  return [
    `# ${input.name}`,
    "",
    `- \`name\`: \`${input.skillSlug}\``,
    `- \`description\`: ${input.description}`,
    "",
    "## Description",
    "",
    input.description,
    "",
    "## When To Use",
    "",
    "- Use this skill when the task clearly matches the skill's declared domain.",
    "- Prefer this skill when the required tools and applicable roles below are a direct fit.",
    "",
    "## Inputs",
    "",
    "- A task description with enough context to decide whether the skill applies.",
    "- Any required files, references, or structured parameters needed by the workflow.",
    "",
    "## Workflow",
    "",
    "1. Read the request and confirm the skill applies.",
    "2. Load any local references, scripts, or assets declared by the skill.",
    "3. Execute only the required tools and keep outputs scoped to the task.",
    "4. Return a concise result and note any follow-up work or risks.",
    "",
    "## Required Tools",
    "",
    toolLines,
    "",
    "## Applicable Roles",
    "",
    roleLines,
    "",
    "## Safety Notes",
    "",
    "- Do not exceed the declared tool and permission surface.",
    "- Do not embed secrets, private endpoints, or environment-specific credentials in this skill.",
    "- If the skill relies on scripts or references, verify they stay inside the allowed skill root.",
    "",
  ].join("\n");
}

/**
 * Generates the OpenAI agent YAML configuration for a skill.
 * This defines how the skill integrates with OpenAI's agent framework.
 */
function renderOpenAiAgentYaml(input: {
  skillSlug: string;
  description: string;
  requiredTools: readonly string[];
}): string {
  const toolBlock = input.requiredTools.length > 0
    ? input.requiredTools.map((tool) => `  - ${tool}`).join("\n")
    : "  []";
  return [
    `name: ${input.skillSlug}`,
    `description: ${JSON.stringify(input.description)}`,
    "required_tools:",
    toolBlock,
    "",
  ].join("\n");
}

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
export class SkillCreatorService {
  /**
   * Creates a new SkillCreatorService.
   *
   * @param options - Configuration options
   * @param options.governance - Optional governance service for skill registration
   * @param options.now - Optional time provider for timestamps (defaults to nowIso)
   */
  public constructor(
    private readonly options: {
      governance?: SkillGovernanceService | null;
      now?: () => string;
    } = {},
  ) {}

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
  public createSkill(request: CreateSkillRequest): SkillCreatorResult {
    const skillRoot = this.prepareSkillRoot(request.skillRoot);
    const skillSlug = slugifySkillName(request.name);
    const skillPath = join(skillRoot, skillSlug);
    const requiredTools = uniqueStrings(request.requiredTools);
    const requiredPermissions = uniqueStrings(request.requiredPermissions);
    const tags = uniqueStrings(request.tags);
    const applicableRoles = uniqueStrings(request.applicableRoles);
    const resourceDirectories = uniqueResourceDirectories(request.resourceDirectories);
    const version = request.version ?? "1.0.0";
    const author = request.author?.trim() || "automatic-agent-platform";
    const riskLevel = request.riskLevel ?? "low";
    const lifecycle = request.lifecycle ?? "draft";
    const cacheable = request.cacheable ?? false;
    const cacheTtlSeconds = request.cacheTtlSeconds ?? 3600;
    const includeOpenAiAgent = request.includeOpenAiAgent ?? true;

    // Validate the skill definition before creating any files
    const validation = this.validateSkillDefinition({
      skillId: skillSlug,
      version,
      name: request.name,
      description: request.description,
      requiredTools,
      cacheable,
      cacheTtlSeconds,
    });
    if (!validation.valid) {
      throw new ValidationError(
        `skill_creator.validation_failed:${validation.errors.join(";")}`,
        `skill_creator.validation_failed:${validation.errors.join(";")}`,
        {
          source: "tool",
          details: { errors: validation.errors },
        },
      );
    }

    // Verify the target path is within allowed sandbox boundaries
    this.assertTargetPathAllowed(skillRoot, skillPath);
    const createdDirectories: string[] = [];
    const createdFiles: string[] = [];

    // Handle existing skill directory
    if (existsSync(skillPath)) {
      const stat = lstatSync(skillPath);
      if (stat.isSymbolicLink()) {
        throw new PolicyDeniedError("skill_creator.target_symlink_denied", "skill_creator.target_symlink_denied", {
          details: { skillPath },
        });
      }
      if (!stat.isDirectory()) {
        throw new ValidationError("skill_creator.target_not_directory", "skill_creator.target_not_directory", {
          source: "tool",
          details: { skillPath },
        });
      }
      const entries = readNonHiddenEntries(skillPath);
      if (entries.length > 0 && !(request.overwriteAllowed ?? false)) {
        throw new ValidationError("skill_creator.target_exists_not_empty", "skill_creator.target_exists_not_empty", {
          source: "tool",
          details: { skillPath, entryCount: entries.length },
        });
      }
    } else {
      // Create the skill root directory
      mkdirSync(skillPath, { recursive: true });
      createdDirectories.push(skillPath);
    }

    // Create SKILL.md - the primary skill documentation
    const skillMarkdownPath = join(skillPath, "SKILL.md");
    writeTextFile(
      skillMarkdownPath,
      renderSkillMarkdown({
        skillSlug,
        name: request.name,
        description: request.description,
        requiredTools,
        applicableRoles,
      }),
    );
    createdFiles.push(skillMarkdownPath);

    // Create optional resource directories
    for (const directory of resourceDirectories) {
      const fullPath = join(skillPath, directory);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
        createdDirectories.push(fullPath);
      }
    }

    // Create OpenAI agent configuration if requested
    if (includeOpenAiAgent) {
      const openAiAgentPath = join(skillPath, "agents", "openai.yaml");
      writeTextFile(
        openAiAgentPath,
        renderOpenAiAgentYaml({
          skillSlug,
          description: request.description,
          requiredTools,
        }),
      );
      createdFiles.push(openAiAgentPath);
    }

    // Optionally register the skill with the governance service
    let registered = false;
    const warnings = [...validation.warnings];
    if (request.registerInRegistry) {
      if (!this.options.governance) {
        warnings.push("registry registration skipped: governance unavailable");
      } else {
        const timestamp = (this.options.now ?? nowIso)();
        const metadata: SkillMetadata = {
          skillId: skillSlug,
          name: request.name,
          version,
          description: request.description,
          author,
          createdAt: timestamp,
          updatedAt: timestamp,
          lifecycle,
          riskLevel,
          tags,
          requiredTools,
          requiredPermissions,
          cacheable,
          cacheTtlSeconds,
          executionCount: 0,
          successRate: 0,
          avgDurationMs: 0,
        };
        registered = this.options.governance.registerSkill(metadata);
      }
    }

    return {
      skillId: skillSlug,
      skillSlug,
      skillRoot,
      skillPath,
      createdFiles,
      createdDirectories,
      registered,
      warnings,
      validation,
    };
  }

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
  public validateSkillScaffold(request: ValidateSkillScaffoldRequest): SkillScaffoldValidationResult {
    const skillPath = resolve(request.skillPath);
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingSections: string[] = [];
    const skillId = existsSync(skillPath) ? slugifySkillName(skillPath.split("/").at(-1) ?? "") : null;

    if (!existsSync(skillPath)) {
      return {
        valid: false,
        skillId,
        skillPath,
        errors: ["skill path does not exist"],
        warnings,
        missingSections,
      };
    }

    // Check for required SKILL.md file
    const skillMarkdownPath = join(skillPath, "SKILL.md");
    if (!existsSync(skillMarkdownPath)) {
      errors.push("missing SKILL.md");
    } else {
      const content = readFileSync(skillMarkdownPath, "utf8");
      for (const heading of REQUIRED_SKILL_HEADINGS) {
        if (!toHeadingPattern(heading).test(content)) {
          missingSections.push(heading);
        }
      }
      if (missingSections.length > 0) {
        errors.push(`missing required sections: ${missingSections.join(", ")}`);
      }
    }

    // Check for OpenAI agent config (warning only, not required)
    const openAiAgentPath = join(skillPath, "agents", "openai.yaml");
    if (!existsSync(openAiAgentPath)) {
      warnings.push("missing agents/openai.yaml");
    }

    return {
      valid: errors.length === 0,
      skillId,
      skillPath,
      errors,
      warnings,
      missingSections,
    };
  }

  /**
   * Normalizes and ensures the skill root directory exists.
   */
  private prepareSkillRoot(skillRoot: string): string {
    const normalizedRoot = resolve(skillRoot);
    mkdirSync(normalizedRoot, { recursive: true });
    return normalizedRoot;
  }

  /**
   * Validates that the target skill path is within allowed sandbox boundaries.
   * This prevents creating skills outside the designated workspace.
   */
  private assertTargetPathAllowed(skillRoot: string, skillPath: string): void {
    const policy = createWorkspaceWritePolicy(skillRoot);

    // Check the root directory is allowed
    const rootCheck = checkSandboxPath(policy, skillRoot);
    if (!rootCheck.allowed) {
      throw new SandboxError(rootCheck.reasonCode ?? "skill_creator.root_denied", rootCheck.reasonCode ?? "skill_creator.root_denied");
    }

    // Check the parent directory is allowed
    const parentPath = dirname(skillPath);
    const parentCheck = checkSandboxPath(policy, parentPath);
    if (!parentCheck.allowed) {
      throw new SandboxError(parentCheck.reasonCode ?? "skill_creator.parent_denied", parentCheck.reasonCode ?? "skill_creator.parent_denied");
    }

    // If skill path exists, verify it's accessible
    if (existsSync(skillPath)) {
      const check = checkSandboxPath(policy, skillPath);
      if (!check.allowed) {
        throw new SandboxError(check.reasonCode ?? "skill_creator.path_denied", check.reasonCode ?? "skill_creator.path_denied");
      }
      return;
    }

    // For new paths, verify the canonical path stays within the root
    const canonicalRoot = realpathSync(skillRoot);
    const canonicalParent = realpathSync(parentPath);
    const rel = relative(canonicalRoot, canonicalParent);
    if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) {
      throw new PolicyDeniedError("skill_creator.path_outside_root", "skill_creator.path_outside_root", {
        details: { skillRoot, skillPath },
      });
    }
  }

  /**
   * Validates a skill definition's structure and metadata.
   * Delegates to governance service if available, otherwise performs basic validation.
   */
  private validateSkillDefinition(request: {
    skillId: string;
    version: string;
    name: string;
    description: string;
    requiredTools: readonly string[];
    cacheable: boolean;
    cacheTtlSeconds: number;
  }): ValidateSkillResult {
    if (this.options.governance) {
      return this.options.governance.validateSkill(request);
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate skillId format (lowercase kebab-case)
    if (!/^[a-z][a-z0-9-]*$/.test(request.skillId)) {
      errors.push("skillId must be lowercase kebab-case and start with a letter");
    }

    // Validate semantic version format
    if (!/^\d+\.\d+\.\d+$/.test(request.version)) {
      errors.push("version must use semver");
    }

    // Warn about short descriptions
    if (request.description.trim().length < 10) {
      warnings.push("description should be at least 10 characters");
    }

    // Warn about missing tool declarations
    if (request.requiredTools.length === 0) {
      warnings.push("skill has no required tools declared");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
