import { type SandboxPolicy } from "../iam/sandbox-policy.js";
/**
 * Metadata for a model provider including status and supported authentication methods.
 */
export interface ModelProviderMetadata {
    status: "active" | "degraded" | "disabled" | "deprecated";
    authMethods: string[];
}
/**
 * Metadata for a specific model profile including tier, capabilities, and pricing.
 */
export interface ModelProfileMetadata {
    provider: string;
    modelId: string;
    tier: "reasoning" | "coding" | "balanced" | "fast";
    capabilities: string[];
    contextWindowTokens: number;
    maxOutputTokens: number;
    pricing: {
        inputPer1kUsd: number;
        outputPer1kUsd: number;
    };
    metadataSource: "bundled_snapshot" | "local_override" | "remote_refresh";
}
/**
 * Complete model metadata registry containing provider and profile information.
 */
export interface ModelMetadataRegistry {
    version: string;
    providers: Record<string, ModelProviderMetadata>;
    profiles: Record<string, ModelProfileMetadata>;
}
/**
 * Default model metadata registry loaded from bundled configuration.
 * Used when no local override is provided.
 */
export declare const DEFAULT_MODEL_METADATA_REGISTRY: ModelMetadataRegistry;
/**
 * Loads model metadata registry with optional local override support.
 * Bundled registry provides defaults, local file (if exists) provides overrides.
 *
 * @param configRoot - Configuration root directory
 * @param sandboxPolicy - Sandbox policy for path validation
 * @returns Merged model metadata registry
 */
export declare function loadModelMetadataRegistry(configRoot: string, sandboxPolicy: SandboxPolicy): ModelMetadataRegistry;
