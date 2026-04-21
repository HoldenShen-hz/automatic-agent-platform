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
export {};
