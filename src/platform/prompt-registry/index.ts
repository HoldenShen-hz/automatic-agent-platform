/**
 * Prompt Registry Module
 *
 * Manages storage and retrieval of prompt bundles and templates.
 *
 * ## Overview
 *
 * This module wraps the prompt registry services located in `prompt-engine/registry/`
 * to provide a dedicated namespace per the platform architecture.
 *
 * ## Contents
 *
 * - HierarchicalRegistryService: Multi-level prompt bundle storage
 * - PromptVersionManager: Version control for prompt bundles
 *
 * @see {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/architecture/00-platform-architecture.md}
 */

// Re-export from prompt-engine/registry
export {
  HierarchicalRegistryService,
  type PromptBundle,
  type PromptBundleConstraints,
  type RegistryLevel,
} from "../prompt-engine/registry/hierarchical-registry-service.js";

export {
  PromptVersionManager,
  type VersionLineage,
  type SemanticVersion,
  type PromptVersionEntry,
} from "../prompt-engine/registry/prompt-version-manager.js";
