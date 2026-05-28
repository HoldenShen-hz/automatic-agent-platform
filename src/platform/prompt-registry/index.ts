/**
 * Prompt Registry Module
 *
 * Provides the canonical prompt registry namespace for higher-level callers.
 */

import {
  HierarchicalPromptRegistryService,
  type HierarchicalPromptRegistryConfig,
} from "../prompt-engine/registry/hierarchical-registry-service.js";
import {
  PromptVersionManager,
  type VersionLineage,
  type SemanticVersion,
  type VersionManagerConfig,
} from "../prompt-engine/registry/prompt-version-manager.js";

export type {
  HierarchicalPromptRegistryConfig,
  VersionLineage,
  SemanticVersion,
  VersionManagerConfig,
};

export interface PromptRegistryServices {
  readonly registry: HierarchicalPromptRegistryService;
  readonly versionManager: PromptVersionManager;
}

export interface PromptRegistryModuleConfig {
  readonly registry?: HierarchicalPromptRegistryConfig;
  readonly versionManager?: VersionManagerConfig;
}

export function createPromptRegistryServices(
  config: PromptRegistryModuleConfig = {},
): PromptRegistryServices {
  return {
    registry: new HierarchicalPromptRegistryService(config.registry),
    versionManager: new PromptVersionManager(config.versionManager),
  };
}

export {
  HierarchicalPromptRegistryService,
  PromptVersionManager,
};
