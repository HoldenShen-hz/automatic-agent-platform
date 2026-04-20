/**
 * Skill Creator CLI
 *
 * This module provides a command-line interface for creating new skills with
 * scaffolding, metadata, and optional registry registration. It also supports
 * validating skill structure without full creation.
 *
 * Environment Variables:
 *   - AA_SKILL_CREATOR_ACTION: Action to perform - "create" or "validate" (required)
 *   - AA_SKILL_REGISTER: Whether to register the skill in the registry
 *   - AA_SKILL_ROOT: Root directory of the skill to create
 *   - AA_SKILL_NAME: Name of the skill
 *   - AA_SKILL_DESCRIPTION: Description of the skill
 *   - AA_SKILL_VERSION: Version string
 *   - AA_SKILL_AUTHOR: Author identifier
 *   - AA_SKILL_REQUIRED_TOOLS_JSON: JSON array of required tool names
 *   - AA_SKILL_REQUIRED_PERMISSIONS_JSON: JSON array of required permissions
 *   - AA_SKILL_TAGS_JSON: JSON array of tags
 *   - AA_SKILL_APPLICABLE_ROLES_JSON: JSON array of applicable roles
 *   - AA_SKILL_RESOURCE_DIRS_JSON: JSON array of resource directory configurations
 *   - AA_SKILL_INCLUDE_OPENAI_AGENT: Whether to include OpenAI agent
 *   - AA_SKILL_OVERWRITE: Whether to allow overwriting existing skills
 *   - AA_SKILL_CACHEABLE: Whether the skill is cacheable
 *   - AA_SKILL_CACHE_TTL_SECONDS: Cache TTL in seconds
 *   - AA_SKILL_RISK_LEVEL: Risk level (low, medium, high)
 *   - AA_SKILL_LIFECYCLE: Lifecycle state (experimental, beta, stable, deprecated)
 *   - AA_SKILL_PATH: Path to skill for validation
 *
 * Actions:
 *   - create: Scaffold a new skill with metadata and optional registry registration
 *   - validate: Verify skill structure without full creation
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for skill architecture
 * @see {@link docs_zh/contracts/skill_registry_contract.md} for skill contracts
 */

import { withCliStorage } from "./authoritative-storage.js";
import { loadSkillCreatorCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { SkillCreatorService, type SkillCreatorResourceDirectory } from "../../platform/execution/tool-executor/skill-creator-service.js";
import { SkillGovernanceService, type SkillLifecycle, type SkillRiskLevel } from "../../platform/execution/tool-executor/skill-governance-service.js";

/**
 * Main entry point for the skill creator CLI.
 *
 * Supports "create" action to scaffold and register a new skill, and "validate" action
 * to verify skill structure without full creation.
 */
function main(): void {
  const envConfig = loadSkillCreatorCliEnv();

  const run = (creator: SkillCreatorService) => {
    switch (envConfig.action) {
      case "create": {
        if (envConfig.skillRoot == null || envConfig.name == null || envConfig.description == null) {
          throw new ValidationError("missing_env:skill_creator_create", "missing_env:skill_creator_create");
        }
        const createRequest = {
          skillRoot: envConfig.skillRoot,
          name: envConfig.name,
          description: envConfig.description,
          registerInRegistry: envConfig.registerInRegistry,
        } as {
          skillRoot: string;
          name: string;
          description: string;
          registerInRegistry: boolean;
          version?: string;
          author?: string;
          requiredTools?: string[];
          requiredPermissions?: string[];
          tags?: string[];
          applicableRoles?: string[];
          resourceDirectories?: SkillCreatorResourceDirectory[];
          includeOpenAiAgent?: boolean;
          overwriteAllowed?: boolean;
          cacheable?: boolean;
          cacheTtlSeconds?: number;
          riskLevel?: SkillRiskLevel;
          lifecycle?: SkillLifecycle;
        };

        // Parse all optional parameters from environment
        if (envConfig.version) createRequest.version = envConfig.version;
        if (envConfig.author) createRequest.author = envConfig.author;
        if (envConfig.requiredTools) createRequest.requiredTools = envConfig.requiredTools;
        if (envConfig.requiredPermissions) createRequest.requiredPermissions = envConfig.requiredPermissions;
        if (envConfig.tags) createRequest.tags = envConfig.tags;
        if (envConfig.applicableRoles) createRequest.applicableRoles = envConfig.applicableRoles;
        if (envConfig.resourceDirectories) {
          createRequest.resourceDirectories = envConfig.resourceDirectories as unknown as SkillCreatorResourceDirectory[];
        }
        if (envConfig.includeOpenAiAgent != null) createRequest.includeOpenAiAgent = envConfig.includeOpenAiAgent;
        if (envConfig.overwriteAllowed != null) createRequest.overwriteAllowed = envConfig.overwriteAllowed;
        if (envConfig.cacheable != null) createRequest.cacheable = envConfig.cacheable;
        if (envConfig.cacheTtlSeconds != null) createRequest.cacheTtlSeconds = envConfig.cacheTtlSeconds;
        if (envConfig.riskLevel) createRequest.riskLevel = envConfig.riskLevel as SkillRiskLevel;
        if (envConfig.lifecycle) createRequest.lifecycle = envConfig.lifecycle as SkillLifecycle;

        return creator.createSkill(createRequest);
      }
      case "validate":
        if (envConfig.skillPath == null) {
          throw new ValidationError("missing_env:AA_SKILL_PATH", "missing_env:AA_SKILL_PATH");
        }
        return creator.validateSkillScaffold({
          skillPath: envConfig.skillPath,
        });
      default:
        throw new ValidationError(`unknown_skill_creator_action:${envConfig.action}`, `unknown_skill_creator_action:${envConfig.action}`);
    }
  };

  const output = envConfig.registerInRegistry
    ? withCliStorage((storage) => run(new SkillCreatorService({
      governance: new SkillGovernanceService(storage.store),
    })))
    : run(new SkillCreatorService());

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
