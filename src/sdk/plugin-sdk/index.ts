import { ValidationError } from "../../platform/contracts/errors.js";

export interface PluginCapability {
  name: string;
  description: string;
  scopes: string[];
}

export interface PluginManifest {
  pluginId: string;
  version: string;
  owner: string;
  runtime: "local" | "sandboxed";
  entrypoint: string;
  capabilities: PluginCapability[];
}

export function validatePluginManifest(manifest: PluginManifest): PluginManifest {
  if (manifest.pluginId.trim().length === 0) {
    throw new ValidationError("plugin_sdk.invalid_plugin_id", "Plugin manifest requires a non-empty pluginId.");
  }
  if (manifest.entrypoint.trim().length === 0) {
    throw new ValidationError("plugin_sdk.invalid_entrypoint", "Plugin manifest requires a non-empty entrypoint.");
  }
  if (manifest.capabilities.length === 0) {
    throw new ValidationError("plugin_sdk.empty_capabilities", "Plugin manifest must declare at least one capability.");
  }
  return {
    ...manifest,
    pluginId: manifest.pluginId.trim(),
    version: manifest.version.trim(),
    owner: manifest.owner.trim(),
    entrypoint: manifest.entrypoint.trim(),
    capabilities: manifest.capabilities.map((capability) => ({
      ...capability,
      name: capability.name.trim(),
      description: capability.description.trim(),
      scopes: [...new Set(capability.scopes.map((scope) => scope.trim()).filter((scope) => scope.length > 0))],
    })),
  };
}
