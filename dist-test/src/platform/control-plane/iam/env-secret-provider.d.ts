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
import type { SecretProviderKind } from "../../contracts/types/domain.js";
/**
 * Metadata about a secret from the provider's perspective.
 */
export interface SecretProviderMetadata {
    /** The secret reference (e.g., "secret://mykey") */
    secretRef: string;
    /** The environment variable name this maps to */
    envName: string;
    /** The scope portion of the reference */
    scope: string;
    /** Source type for this provider */
    source: "environment" | "vault" | "kms" | "secret_manager";
    /** Whether the secret value was found in the environment */
    resolved: boolean;
    /** Masked version of the value for safe logging */
    maskedValue: string | null;
}
/**
 * Secret provider metadata plus the actual value.
 */
export interface SecretProviderValue extends SecretProviderMetadata {
    /** The actual secret value */
    value: string;
}
/**
 * A time-limited lease for a secret.
 * Some providers support dynamic secrets with automatic expiration.
 */
export interface SecretProviderIssuedLease extends SecretProviderValue {
    /** Provider-specific lease identifier */
    leaseId: string | null;
    /** When the lease expires (ISO timestamp) */
    expiresAt: string;
    /** Whether the lease can be renewed */
    renewable: boolean;
    /** Entity that issued this lease */
    issuedBy: string | null;
}
/**
 * Configuration options for the environment secret provider.
 */
export interface EnvSecretProviderOptions {
    /** The environment to read from (defaults to process.env) */
    env?: NodeJS.ProcessEnv;
}
/**
 * Interface for secret providers used by SecretManagementService.
 * All providers (env, vault, kms, gcp) implement this interface.
 */
export interface ManagedSecretProvider {
    readonly providerKind: SecretProviderKind;
    describeSecret(secretRef: string): Promise<SecretProviderMetadata>;
    requireSecret(secretRef: string): Promise<SecretProviderMetadata & {
        value: string;
    }>;
    refreshSecret?(secretRef: string): Promise<SecretProviderMetadata | null>;
    issueSecretLease?(secretRef: string): Promise<SecretProviderIssuedLease | null>;
}
/**
 * Masks a secret value for safe logging.
 * Shows first few characters and last 4, masks the rest.
 *
 * @param value - The secret value to mask
 * @returns Masked string safe for logging
 */
export declare function maskSecretValue(value: string): string;
/**
 * Validates a secret reference format.
 *
 * @param secretRef - The secret reference to validate
 * @returns The normalized reference
 * @throws ValidationError if format is invalid
 */
export declare function validateSecretRef(secretRef: string): string;
/**
 * Extracts the scope portion from a secret reference.
 * The scope is the path portion without the final key.
 *
 * @param secretRef - The secret reference
 * @returns The scope string
 */
export declare function deriveSecretScope(secretRef: string): string;
/**
 * Derives the environment variable name from a secret reference.
 * Transforms "secret://my-service/api-key" to "AA_SECRET_MY_SERVICE_API_KEY"
 *
 * @param secretRef - The secret reference
 * @returns The environment variable name
 */
export declare function deriveSecretEnvName(secretRef: string): string;
/**
 * Environment Variable Secret Provider
 *
 * Retrieves secrets from environment variables using a standardized
 * secret reference format.
 */
export declare class EnvSecretProvider implements ManagedSecretProvider {
    readonly providerKind: SecretProviderKind;
    private readonly env;
    constructor(options?: EnvSecretProviderOptions);
    /**
     * Describes a secret without revealing its value.
     * Checks if the secret exists and returns metadata.
     *
     * @param secretRef - Secret reference to describe
     * @returns Metadata about the secret
     */
    describeSecret(secretRef: string): Promise<SecretProviderMetadata>;
    /**
     * Retrieves the actual secret value from the environment.
     *
     * @param secretRef - Secret reference to retrieve
     * @returns Metadata with the secret value
     * @throws ValidationError if the secret is not found
     */
    requireSecret(secretRef: string): Promise<SecretProviderMetadata & {
        value: string;
    }>;
    /**
     * Synchronous version of requireSecret for use in contexts that require synchronous resolution.
     * This method directly reads from the environment without async operations.
     */
    requireSecretSync(secretRef: string): string;
    refreshSecret(secretRef: string): Promise<SecretProviderMetadata>;
}
