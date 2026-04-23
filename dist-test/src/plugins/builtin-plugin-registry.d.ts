import type { RegisteredPlugin } from "../domains/registry/plugin-spi.js";
export declare function createBuiltinPlugin(pluginId: string): RegisteredPlugin | null;
export declare function hasBuiltinPlugin(pluginId: string): boolean;
export declare function listBuiltinPluginIds(): string[];
