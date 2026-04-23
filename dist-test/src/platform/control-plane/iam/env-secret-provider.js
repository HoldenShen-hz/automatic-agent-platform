/**
 * Environment Variable Secret Provider
 *
 * Provides secret values from environment variables using a standardized
 * secret reference format (secret://scope/key).
 *
 * ## Secret Reference Format
 *
 * Secrets are referenced using URLs like: `secret://my-service/api-key`
 *
 * This reference maps to an environment variable name derived from the scope:
 * `AA_SECRET_MY_SERVICE_API_KEY`
 *
 * ## Why This Provider Exists
 *
 * Many deployment scenarios use environment variables for secrets injection:
 * - Kubernetes secrets mounted as env vars
 * - Docker secrets
 * - Cloud-native secret management (AWS Secrets Manager, GCP Secret Manager)
 *   that can inject into environment variables
 *
 * This provider provides a consistent interface for all of these.
 *
 * @see ManagedSecretProvider for the interface this implements
 */
import { ValidationError } from "../../contracts/errors.js";
/**
 * Pattern for validating secret reference format.
 * Format: secret:// followed by scope/key path
 */
const SECRET_REF_PATTERN = /^secret:\/\/([a-z0-9._/-]+)$/i;
/**
 * Masks a secret value for safe logging.
 * Shows first few characters and last 4, masks the rest.
 *
 * @param value - The secret value to mask
 * @returns Masked string safe for logging
 */
export function maskSecretValue(value) {
    const normalized = value.trim();
    if (normalized.length <= 4) {
        return "*".repeat(Math.max(4, normalized.length));
    }
    return `${"*".repeat(Math.min(8, normalized.length - 4))}${normalized.slice(-4)}`;
}
/**
 * Validates a secret reference format.
 *
 * @param secretRef - The secret reference to validate
 * @returns The normalized reference
 * @throws ValidationError if format is invalid
 */
export function validateSecretRef(secretRef) {
    const normalized = secretRef.trim();
    if (!SECRET_REF_PATTERN.test(normalized)) {
        throw new ValidationError(`secret.invalid_ref:${secretRef}`, `secret.invalid_ref:${secretRef}`, {
            source: "provider",
            details: { secretRef },
        });
    }
    return normalized;
}
/**
 * Extracts the scope portion from a secret reference.
 * The scope is the path portion without the final key.
 *
 * @param secretRef - The secret reference
 * @returns The scope string
 */
export function deriveSecretScope(secretRef) {
    const normalized = validateSecretRef(secretRef);
    const matched = normalized.match(SECRET_REF_PATTERN);
    return matched?.[1] ?? "";
}
/**
 * Derives the environment variable name from a secret reference.
 * Transforms "secret://my-service/api-key" to "AA_SECRET_MY_SERVICE_API_KEY"
 *
 * @param secretRef - The secret reference
 * @returns The environment variable name
 */
export function deriveSecretEnvName(secretRef) {
    const scope = deriveSecretScope(secretRef);
    return `AA_SECRET_${scope
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase()}`;
}
/**
 * Environment Variable Secret Provider
 *
 * Retrieves secrets from environment variables using a standardized
 * secret reference format.
 */
export class EnvSecretProvider {
    providerKind = "environment";
    env;
    constructor(options = {}) {
        this.env = options.env ?? process.env;
    }
    /**
     * Describes a secret without revealing its value.
     * Checks if the secret exists and returns metadata.
     *
     * @param secretRef - Secret reference to describe
     * @returns Metadata about the secret
     */
    async describeSecret(secretRef) {
        const normalized = validateSecretRef(secretRef);
        const envName = deriveSecretEnvName(normalized);
        const rawValue = this.env[envName];
        const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : null;
        return {
            secretRef: normalized,
            envName,
            scope: deriveSecretScope(normalized),
            source: this.providerKind,
            resolved: value != null,
            maskedValue: value == null ? null : maskSecretValue(value),
        };
    }
    /**
     * Retrieves the actual secret value from the environment.
     *
     * @param secretRef - Secret reference to retrieve
     * @returns Metadata with the secret value
     * @throws ValidationError if the secret is not found
     */
    async requireSecret(secretRef) {
        const metadata = await this.describeSecret(secretRef);
        const rawValue = this.env[metadata.envName];
        const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : null;
        if (value == null) {
            throw new ValidationError(`secret.missing_value:${metadata.secretRef}:${metadata.envName}`, `secret.missing_value:${metadata.secretRef}:${metadata.envName}`, {
                source: "provider",
                details: { secretRef: metadata.secretRef, envName: metadata.envName },
            });
        }
        return {
            ...metadata,
            resolved: true,
            maskedValue: maskSecretValue(value),
            value,
        };
    }
    /**
     * Synchronous version of requireSecret for use in contexts that require synchronous resolution.
     * This method directly reads from the environment without async operations.
     */
    requireSecretSync(secretRef) {
        const normalized = validateSecretRef(secretRef);
        const envName = deriveSecretEnvName(normalized);
        const rawValue = this.env[envName];
        const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : null;
        if (value == null) {
            throw new ValidationError(`secret.missing_value:${normalized}:${envName}`, `secret.missing_value:${normalized}:${envName}`, {
                source: "provider",
                details: { secretRef: normalized, envName },
            });
        }
        return value;
    }
    async refreshSecret(secretRef) {
        return this.describeSecret(secretRef);
    }
}
//# sourceMappingURL=env-secret-provider.js.map