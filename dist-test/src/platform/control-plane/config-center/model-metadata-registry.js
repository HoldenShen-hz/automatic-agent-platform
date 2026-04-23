import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PolicyDeniedError, ValidationError } from "../../contracts/errors.js";
import { checkSandboxPath } from "../iam/sandbox-policy.js";
/**
 * Resolves the path to the bundled model registry JSON file.
 * Searches multiple candidate locations to find the bundled file.
 * @returns Path to the bundled models.bundled.json file
 * @throws ValidationError if no bundled file is found
 */
function resolveBundledRegistryPath() {
    const startDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
        join(startDir, "../../../config/providers/models.bundled.json"),
        join(startDir, "../../../../config/providers/models.bundled.json"),
        join(startDir, "../../../../../config/providers/models.bundled.json"),
        join(process.cwd(), "config", "providers", "models.bundled.json"),
        join(process.cwd(), "..", "config", "providers", "models.bundled.json"),
    ];
    const bundledPath = candidates.find((candidate) => existsSync(candidate));
    if (bundledPath == null) {
        throw new ValidationError("config.model_registry_bundled_missing", "config.model_registry_bundled_missing");
    }
    return bundledPath;
}
/**
 * Type guard to check if a value is a plain object (not array, not null).
 */
function isStringRecord(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}
/**
 * Type guard to check if a value is an array of non-empty strings.
 */
function isNonEmptyStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}
/**
 * Validates pricing configuration and returns list of issue codes.
 * @param pricing - Raw pricing object to validate
 * @param path - Dot-notation path for error reporting
 * @returns Array of issue codes (empty if valid)
 */
function validatePricing(pricing, path) {
    const issues = [];
    if (!isStringRecord(pricing)) {
        issues.push(`config.invalid_pricing:${path}:not_an_object`);
        return issues;
    }
    if (typeof pricing.inputPer1kUsd !== "number" || pricing.inputPer1kUsd < 0) {
        issues.push(`config.invalid_pricing:${path}.inputPer1kUsd:must_be_non_negative_number`);
    }
    if (typeof pricing.outputPer1kUsd !== "number" || pricing.outputPer1kUsd < 0) {
        issues.push(`config.invalid_pricing:${path}.outputPer1kUsd:must_be_non_negative_number`);
    }
    return issues;
}
/**
 * Validates a provider entry and returns list of issue codes.
 * @param provider - Raw provider object to validate
 * @param providerName - Provider name for error reporting
 * @returns Array of issue codes (empty if valid)
 */
function validateProvider(provider, providerName) {
    const issues = [];
    if (!isStringRecord(provider)) {
        issues.push(`config.invalid_provider:${providerName}:not_an_object`);
        return issues;
    }
    if (typeof provider.status !== "string"
        || !["active", "degraded", "disabled", "deprecated"].includes(provider.status)) {
        issues.push(`config.invalid_provider:${providerName}.status:must_be_valid_status`);
    }
    if (!isNonEmptyStringArray(provider.authMethods)) {
        issues.push(`config.invalid_provider:${providerName}.authMethods:must_be_non_empty_string_array`);
    }
    return issues;
}
/**
 * Validates a model profile entry and returns list of issue codes.
 * @param profile - Raw profile object to validate
 * @param profileName - Profile name for error reporting
 * @returns Array of issue codes (empty if valid)
 */
function validateProfile(profile, profileName) {
    const issues = [];
    if (!isStringRecord(profile)) {
        issues.push(`config.invalid_profile:${profileName}:not_an_object`);
        return issues;
    }
    if (typeof profile.provider !== "string" || profile.provider.trim().length === 0) {
        issues.push(`config.invalid_profile:${profileName}.provider:must_be_non_empty_string`);
    }
    if (typeof profile.modelId !== "string" || profile.modelId.trim().length === 0) {
        issues.push(`config.invalid_profile:${profileName}.modelId:must_be_non_empty_string`);
    }
    if (typeof profile.tier !== "string"
        || !["reasoning", "coding", "balanced", "fast"].includes(profile.tier)) {
        issues.push(`config.invalid_profile:${profileName}.tier:must_be_valid_tier`);
    }
    if (!isNonEmptyStringArray(profile.capabilities)) {
        issues.push(`config.invalid_profile:${profileName}.capabilities:must_be_non_empty_string_array`);
    }
    if (typeof profile.contextWindowTokens !== "number" || profile.contextWindowTokens <= 0) {
        issues.push(`config.invalid_profile:${profileName}.contextWindowTokens:must_be_positive_number`);
    }
    if (typeof profile.maxOutputTokens !== "number" || profile.maxOutputTokens <= 0) {
        issues.push(`config.invalid_profile:${profileName}.maxOutputTokens:must_be_positive_number`);
    }
    issues.push(...validatePricing(profile.pricing, `${profileName}.pricing`));
    if (typeof profile.metadataSource !== "string"
        || !["bundled_snapshot", "local_override", "remote_refresh"].includes(profile.metadataSource)) {
        issues.push(`config.invalid_profile:${profileName}.metadataSource:must_be_valid_source`);
    }
    return issues;
}
/**
 * Parses and validates a raw JSON string into a ModelMetadataRegistry.
 * @param raw - Raw JSON string to parse
 * @param filePath - File path for error reporting
 * @returns Parsed and validated registry
 * @throws ValidationError if JSON is invalid or validation fails
 */
function parseRegistry(raw, filePath) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        throw new ValidationError(`config.invalid_json:${filePath}:${error instanceof Error ? error.message : String(error)}`, `config.invalid_json:${filePath}:${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isStringRecord(parsed)
        || typeof parsed.version !== "string"
        || !isStringRecord(parsed.providers)
        || !isStringRecord(parsed.profiles)) {
        throw new ValidationError(`config.invalid_shape:${filePath}`, `config.invalid_shape:${filePath}`);
    }
    const issues = [];
    for (const [providerName, provider] of Object.entries(parsed.providers)) {
        issues.push(...validateProvider(provider, providerName));
    }
    for (const [profileName, profile] of Object.entries(parsed.profiles)) {
        issues.push(...validateProfile(profile, profileName));
    }
    for (const [profileName, profile] of Object.entries(parsed.profiles)) {
        if (isStringRecord(profile) && typeof profile.provider === "string" && parsed.providers[profile.provider] == null) {
            issues.push(`config.invalid_profile:${profileName}.provider:unknown_provider:${profile.provider}`);
        }
    }
    if (issues.length > 0) {
        throw new ValidationError(`config.invalid_registry:${filePath}:${issues.join(";")}`, `config.invalid_registry:${filePath}:${issues.join(";")}`);
    }
    return parsed;
}
/**
 * Loads the bundled model registry from the filesystem.
 * @returns Parsed bundled registry
 */
function loadBundledRegistry() {
    const bundledPath = resolveBundledRegistryPath();
    return parseRegistry(readFileSync(bundledPath, "utf8"), bundledPath);
}
/**
 * Merges two registries with override taking precedence over bundled.
 * Used to combine bundled defaults with local overrides.
 * @param bundled - Base bundled registry
 * @param override - Override registry that takes precedence
 * @returns Merged registry with validation
 */
function mergeRegistries(bundled, override) {
    const merged = {
        version: override.version,
        providers: {
            ...bundled.providers,
            ...override.providers,
        },
        profiles: {
            ...bundled.profiles,
            ...override.profiles,
        },
    };
    parseRegistry(JSON.stringify(merged), "merged:model_metadata_registry");
    return merged;
}
/**
 * Default model metadata registry loaded from bundled configuration.
 * Used when no local override is provided.
 */
export const DEFAULT_MODEL_METADATA_REGISTRY = loadBundledRegistry();
/**
 * Loads model metadata registry with optional local override support.
 * Bundled registry provides defaults, local file (if exists) provides overrides.
 *
 * @param configRoot - Configuration root directory
 * @param sandboxPolicy - Sandbox policy for path validation
 * @returns Merged model metadata registry
 */
export function loadModelMetadataRegistry(configRoot, sandboxPolicy) {
    const bundled = loadBundledRegistry();
    const registryPath = join(configRoot, "providers", "models.json");
    if (!existsSync(registryPath)) {
        return bundled;
    }
    const check = checkSandboxPath(sandboxPolicy, registryPath);
    if (!check.allowed) {
        throw new PolicyDeniedError(check.reasonCode ?? "config.model_registry_denied", check.reasonCode ?? "config.model_registry_denied");
    }
    const override = parseRegistry(readFileSync(check.normalizedPath, "utf8"), registryPath);
    return mergeRegistries(bundled, override);
}
//# sourceMappingURL=model-metadata-registry.js.map