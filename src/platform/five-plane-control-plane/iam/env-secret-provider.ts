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
import { ValidationError } from "../../contracts/errors.js";

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
  requireSecret(secretRef: string): Promise<SecretProviderMetadata & { value: string }>;
  refreshSecret?(secretRef: string): Promise<SecretProviderMetadata | null>;
  issueSecretLease?(secretRef: string): Promise<SecretProviderIssuedLease | null>;
}

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
export function maskSecretValue(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) {
    return "*".repeat(Math.max(4, normalized.length));
  }
  if (normalized.length <= 12) {
    return `${"*".repeat(Math.max(6, normalized.length - 2))}${normalized.slice(-2)}`;
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
export function validateSecretRef(secretRef: string): string {
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
export function deriveSecretScope(secretRef: string): string {
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
export function deriveSecretEnvName(secretRef: string): string {
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
export class EnvSecretProvider implements ManagedSecretProvider {
  public readonly providerKind: SecretProviderKind = "environment";
  private readonly env: NodeJS.ProcessEnv;

  public constructor(options: EnvSecretProviderOptions = {}) {
    this.env = options.env ?? process.env;
  }

  /**
   * Describes a secret without revealing its value.
   * Checks if the secret exists and returns metadata.
   *
   * @param secretRef - Secret reference to describe
   * @returns Metadata about the secret
   */
  public async describeSecret(secretRef: string): Promise<SecretProviderMetadata> {
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
  public async requireSecret(secretRef: string): Promise<SecretProviderMetadata & { value: string }> {
    const metadata = await this.describeSecret(secretRef);
    const rawValue = this.env[metadata.envName];
    const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : null;
    if (value == null) {
      throw new ValidationError(
        "secret.missing_value",
        "secret.missing_value",
        {
          source: "provider",
        },
      );
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
  public requireSecretSync(secretRef: string): string {
    const normalized = validateSecretRef(secretRef);
    const envName = deriveSecretEnvName(normalized);
    const rawValue = this.env[envName];
    const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : null;
    if (value == null) {
      throw new ValidationError("secret.missing_value", "secret.missing_value", {
        source: "provider",
      });
    }
    return value;
  }

  public async refreshSecret(secretRef: string): Promise<SecretProviderMetadata> {
    return this.describeSecret(secretRef);
  }
}
