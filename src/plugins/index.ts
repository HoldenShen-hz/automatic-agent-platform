export type {
  DomainPlannerPlugin,
  DomainPresenterPlugin,
  DomainRetrieverPlugin,
  DomainValidatorPlugin,
  ExternalAdapterPlugin,
  PluginLifecycleContext,
  PluginLifecycleState,
  PluginManifest,
  PluginSandboxPolicy,
  PluginSpiType,
} from "../domains/registry/plugin-spi.js";
export {
  PluginLifecycleStateSchema,
  PluginManifestSchema,
  PluginSandboxPolicySchema,
  PluginSpiTypeSchema,
} from "../domains/registry/plugin-spi.js";
export { PluginSpiRegistry } from "../domains/registry/plugin-spi-registry.js";
// R8-24 FIX: Export built-in plugin manifest functions
export {
  createBuiltinPlugin,
  createBuiltinPluginWithManifest,
  listBuiltinPluginIds,
  getBuiltinPluginManifest,
  listBuiltinPluginManifests,
} from "./builtin-plugin-registry.js";
export * from "./adapters/index.js";
export * from "./planners/index.js";
export * from "./presenters/index.js";
export * from "./retrievers/index.js";
export * from "./validators/index.js";
