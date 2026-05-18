/**
 * External Secret Provider
 *
 * Reads secrets from external configuration sources (JSON files or inline JSON)
 * when primary providers (Vault, KMS, GCP) are not available.
 *
 * ## Purpose
 *
 * This provider serves as a fallback when:
 * - Vault/KMS/GCP are not configured in the deployment
 * - Development/testing without cloud provider access
 * - Migration path from file-based secrets to cloud providers
 *
 * ## Configuration
 *
 * Secrets are loaded from environment variables containing JSON:
 *
 * For Vault:
 *   AA_VAULT_SECRETS_JSON={"mykey":"value"} OR AA_VAULT_SECRETS_FILE=/path/to/secrets.json
 *
 * For KMS:
 *   AA_KMS_SECRETS_JSON={"mykey":"value"} OR AA_KMS_SECRETS_FILE=/path/to/secrets.json
 *
 * For GCP Secret Manager:
 *   AA_SECRET_MANAGER_SECRETS_JSON={"mykey":"value"} OR AA_SECRET_MANAGER_SECRETS_FILE=/path/to/secrets.json
 *
 * ## Secret Reference Format
 *
 * References like "secret://mykey" look up "mykey" in the JSON object.
 * References like "secret://folder/mykey" look up "folder.mykey" in the JSON object.
 *
 * @see EnvSecretProvider for the interface this implements
 */

import { closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

import { ProviderError, ValidationError } from "../../contracts/errors.js";
import type { SecretProviderKind } from "../../contracts/types/domain.js";
import {
  deriveSecretEnvName,
  deriveSecretScope,
  maskSecretValue,
  type ManagedSecretProvider,
  type SecretProviderIssuedLease,
  type SecretProviderMetadata,
  type SecretProviderValue,
  validateSecretRef,
} from "./env-secret-provider.js";

/**
 * Provider kinds supported by ExternalSecretProvider.
 * Excludes "environment" since that's handled by EnvSecretProvider directly.
 */
type ExternalSecretProviderKind = Exclude<SecretProviderKind, "environment">;

/**
 * Configuration options for ExternalSecretProvider.
 */
interface ExternalSecretProviderOptions {
  providerKind: ExternalSecretProviderKind;
  env?: NodeJS.ProcessEnv;
}

/**
 * Structure of an entry in the external secrets JSON.
 * Can be a simple string value or an object with locator and optional lease.
 */
interface ExternalSecretEntryObject {
  value?: unknown;
  locator?: unknown;
  issued_lease?: unknown;
}

/**
 * Normalized lease information from external configuration.
 */
interface NormalizedExternalIssuedLease {
  value: string;
  locator: string;
  leaseId: string | null;
  expiresAt: string;
  renewable: boolean;
  issuedBy: string | null;
}

/**
 * Returns the environment variable prefix for a provider kind.
 */
function providerEnvPrefix(providerKind: ExternalSecretProviderKind): string {
  switch (providerKind) {
    case "vault":
      return "AA_VAULT";
    case "kms":
      return "AA_KMS";
    case "secret_manager":
      return "AA_SECRET_MANAGER";
  }
}

/**
 * Returns the environment variable name for inline JSON secrets.
 */
function inlineSecretsEnvName(providerKind: ExternalSecretProviderKind): string {
  return `${providerEnvPrefix(providerKind)}_SECRETS_JSON`;
}

/**
 * Returns the environment variable name for secrets file path.
 */
function fileSecretsEnvName(providerKind: ExternalSecretProviderKind): string {
  return `${providerEnvPrefix(providerKind)}_SECRETS_FILE`;
}

/**
 * Validates that a file path does not contain path traversal sequences.
 *
 * @param filePath - The file path to validate
 * @param code - Error code for validation failure
 * @throws ProviderError if path contains .. traversal
 */
function validateFilePath(filePath: string, code: string): void {
  if (filePath.includes("\0")) {
    throw new ProviderError(code, code, {
      details: { filePath },
      retryable: false,
    });
  }
  const segments = filePath.split(/[\\/]+/).filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === "..")) {
    throw new ProviderError(code, code, {
      details: { filePath },
      retryable: false,
    });
  }
}

/**
 * Default denied roots that should never be accessed.
 */
const DEFAULT_DENIED_ROOTS = ["/etc", "/proc", "/sys"] as const;

/**
 * Verifies a file path is safe to access using sandbox-style checks:
 * - No path traversal sequences (..)
 * - Not within denied roots (/etc, /proc, /sys)
 * - No symlinks in the path that could escape allowed boundaries
 *
 * @param filePath - The file path to verify
 * @param code - Error code for validation failure
 * @throws ProviderError if path fails any security check
 */
function verifySecurePath(filePath: string, code: string): void {
  // First do basic path traversal check
  validateFilePath(filePath, code);

  const resolvedPath = resolve(filePath);

  // Check if path is within any denied root
  for (const deniedRoot of DEFAULT_DENIED_ROOTS) {
    const deniedResolved = resolve(deniedRoot);
    if (resolvedPath === deniedResolved || resolvedPath.startsWith(`${deniedResolved}${sep}`)) {
      throw new ProviderError(code, code, {
        details: { filePath, reason: "path_within_denied_root", deniedRoot },
        retryable: false,
      });
    }
  }

  // Check for symlinks in the path that could escape boundaries
  // This detects if any parent directory is a symlink
  const pathSegments = (resolvedPath.split(sep).filter(Boolean) as string[]);
  let current = "";
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    if (segment == null) {
      continue;
    }
    current = resolve(current, segment);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new ProviderError(code, code, {
          details: { filePath, reason: "symlink_in_path", symlinkPath: current },
          retryable: false,
        });
      }
    } catch (error) {
      // lstatSync fails if path doesn't exist yet (for newly created paths)
      // In this case we can't verify, but we already resolved the path
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode && errorCode !== "ENOENT") {
        throw error;
      }
    }
  }
}

function securelyReadSecretsFile(filePath: string, code: string): string {
  verifySecurePath(filePath, code);
  let fd: number | null = null;
  try {
    const realPath = realpathSync(filePath);
    verifySecurePath(realPath, code);
    const expectedStat = statSync(realPath);
    fd = openSync(realPath, "r");
    const openedStat = fstatSync(fd);
    if (openedStat.dev !== expectedStat.dev || openedStat.ino !== expectedStat.ino) {
      throw new ProviderError(code, code, {
        details: { filePath, reason: "file_changed_during_open" },
        retryable: false,
      });
    }
    return readFileSync(fd, "utf8");
  } catch (error) {
    if (error instanceof ProviderError || error instanceof ValidationError) {
      throw error;
    }
    throw new ProviderError(code, code, {
      details: { filePath },
      retryable: false,
    });
  } finally {
    if (fd != null) {
      closeSync(fd);
    }
  }
}

/**
 * Validates that a value is a plain object record.
 *
 * @param value - Value to validate
 * @param code - Error code for validation failure
 * @returns The validated record
 * @throws ValidationError if not a valid object
 */
function normalizeRecord(value: unknown, code: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(code, code, {
      source: "provider",
    });
  }
  return value as Record<string, unknown>;
}

/**
 * Normalizes an external secret entry to a consistent format.
 * Handles both string values and object entries.
 *
 * @param rawEntry - The raw entry from JSON
 * @param fallbackLocator - Locator to use if not specified in entry
 * @returns Normalized entry with value and locator
 */
function normalizeEntry(rawEntry: unknown, fallbackLocator: string): { value: string | null; locator: string } {
  if (typeof rawEntry === "string") {
    const normalizedValue = rawEntry.trim();
    return {
      value: normalizedValue.length > 0 ? normalizedValue : null,
      locator: fallbackLocator,
    };
  }

  const entry = normalizeRecord(rawEntry, `secret.provider_config_invalid_entry:${fallbackLocator}`);
  const rawValue = entry.value;
  const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : null;
  const rawLocator = entry.locator;
  const locator =
    typeof rawLocator === "string" && rawLocator.trim().length > 0
      ? rawLocator.trim()
      : fallbackLocator;
  return {
    value,
    locator,
  };
}

/**
 * Normalizes an issued lease entry from external configuration.
 *
 * @param rawLease - The raw lease object
 * @param fallbackLocator - Locator to use if not specified
 * @returns Normalized lease information
 * @throws ValidationError if lease format is invalid
 */
function normalizeIssuedLease(rawLease: unknown, fallbackLocator: string): NormalizedExternalIssuedLease {
  const entry = normalizeRecord(rawLease, `secret.provider_config_invalid_entry:${fallbackLocator}`);
  const rawValue = entry.value;
  const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : null;
  if (value == null) {
    throw new ValidationError(`secret.provider_config_invalid_entry:${fallbackLocator}`, `secret.provider_config_invalid_entry:${fallbackLocator}`, {
      source: "provider",
    });
  }
  const rawLocator = entry.locator;
  const locator =
    typeof rawLocator === "string" && rawLocator.trim().length > 0
      ? rawLocator.trim()
      : fallbackLocator;
  const rawLeaseId = entry.lease_id;
  const leaseId = typeof rawLeaseId === "string" && rawLeaseId.trim().length > 0 ? rawLeaseId.trim() : null;
  const rawExpiresAt = entry.expires_at;
  const expiresAt = typeof rawExpiresAt === "string" && rawExpiresAt.trim().length > 0 ? rawExpiresAt.trim() : null;
  if (expiresAt == null || Number.isNaN(Date.parse(expiresAt))) {
    throw new ValidationError(`secret.provider_config_invalid_entry:${fallbackLocator}`, `secret.provider_config_invalid_entry:${fallbackLocator}`, {
      source: "provider",
    });
  }
  const renewable = entry.renewable === true;
  const rawIssuedBy = entry.issued_by;
  const issuedBy = typeof rawIssuedBy === "string" && rawIssuedBy.trim().length > 0 ? rawIssuedBy.trim() : null;
  return {
    value,
    locator,
    leaseId,
    expiresAt,
    renewable,
    issuedBy,
  };
}

/**
 * Normalizes a secret reference alias to a canonical format.
 * Handles both "secret://" prefixed and bare references.
 *
 * @param key - The key from the JSON object
 * @returns Canonical secret reference
 */
function normalizeSecretRefAlias(key: string): string {
  const normalized = key.trim();
  if (normalized.startsWith("secret://")) {
    return validateSecretRef(normalized);
  }
  return validateSecretRef(`secret://${normalized.replace(/^\/+/, "")}`);
}

/**
 * External Secret Provider
 *
 * Retrieves secrets from JSON configuration in environment variables
 * or JSON files. Used as fallback when primary providers are unavailable.
 */
export class ExternalSecretProvider {
  private readonly env: NodeJS.ProcessEnv;
  public readonly providerKind: ExternalSecretProviderKind;
  private cachedSource:
    | {
        cacheKey: string;
        sourceName: string;
        filePath: string | null;
        entries: Record<string, unknown>;
      }
    | null = null;

  public constructor(options: ExternalSecretProviderOptions) {
    this.env = options.env ?? process.env;
    this.providerKind = options.providerKind;
  }

  /**
   * Describes a secret without revealing its value.
   * Checks if the secret exists in the configured source.
   *
   * @param secretRef - Secret reference to describe
   * @returns Metadata about the secret
   */
  public async describeSecret(secretRef: string): Promise<SecretProviderMetadata> {
    const normalized = validateSecretRef(secretRef);
    const configuredSource = this.readConfiguredSecrets();
    if (configuredSource == null) {
      return {
        secretRef: normalized,
        envName: deriveSecretEnvName(normalized),
        scope: deriveSecretScope(normalized),
        source: this.providerKind,
        resolved: false,
        maskedValue: null,
      };
    }

    const locatorFallback = configuredSource.filePath ?? configuredSource.sourceName;
    const normalizedEntries = new Map<string, { value: string | null; locator: string }>();
    for (const [key, rawEntry] of Object.entries(configuredSource.entries)) {
      normalizedEntries.set(
        normalizeSecretRefAlias(key),
        normalizeEntry(rawEntry, locatorFallback),
      );
    }

    const entry = normalizedEntries.get(normalized) ?? null;
    return {
      secretRef: normalized,
      envName: entry?.locator ?? locatorFallback,
      scope: deriveSecretScope(normalized),
      source: this.providerKind,
      resolved: entry?.value != null,
      maskedValue: entry?.value != null ? maskSecretValue(entry.value) : null,
    };
  }

  /**
   * Retrieves the actual secret value from the configured source.
   *
   * @param secretRef - Secret reference to retrieve
   * @returns Metadata with the secret value
   * @throws ValidationError if the secret is not found
   */
  public async requireSecret(secretRef: string): Promise<SecretProviderValue> {
    const metadata = await this.describeSecret(secretRef);
    const configuredSource = this.readConfiguredSecrets();
    if (configuredSource == null) {
      throw new ValidationError(`secret.missing_value:${metadata.secretRef}:${metadata.envName}`, `secret.missing_value:${metadata.secretRef}:${metadata.envName}`, {
        source: "provider",
      });
    }

    const locatorFallback = configuredSource.filePath ?? configuredSource.sourceName;
    for (const [key, rawEntry] of Object.entries(configuredSource.entries)) {
      if (normalizeSecretRefAlias(key) !== metadata.secretRef) {
        continue;
      }
      const entry = normalizeEntry(rawEntry, locatorFallback);
      if (entry.value == null) {
        break;
      }
      return {
        ...metadata,
        envName: entry.locator,
        resolved: true,
        maskedValue: maskSecretValue(entry.value),
        value: entry.value,
      };
    }

    throw new ValidationError(`secret.missing_value:${metadata.secretRef}:${metadata.envName}`, `secret.missing_value:${metadata.secretRef}:${metadata.envName}`, {
      source: "provider",
    });
  }

  /**
   * Issues a secret lease from external configuration.
   * Returns null if the secret has no lease configuration.
   *
   * @param secretRef - Secret reference
   * @returns Lease information or null
   */
  public async issueSecretLease(secretRef: string): Promise<SecretProviderIssuedLease | null> {
    const metadata = await this.describeSecret(secretRef);
    const configuredSource = this.readConfiguredSecrets();
    if (configuredSource == null) {
      return null;
    }

    const locatorFallback = configuredSource.filePath ?? configuredSource.sourceName;
    for (const [key, rawEntry] of Object.entries(configuredSource.entries)) {
      if (normalizeSecretRefAlias(key) !== metadata.secretRef) {
        continue;
      }
      const normalizedEntry = normalizeRecord(rawEntry, `secret.provider_config_invalid_entry:${locatorFallback}`);
      if (!Object.hasOwn(normalizedEntry, "issued_lease")) {
        return null;
      }
      const issuedLease = normalizeIssuedLease(normalizedEntry.issued_lease, locatorFallback);
      return {
        ...metadata,
        envName: issuedLease.locator,
        resolved: true,
        maskedValue: maskSecretValue(issuedLease.value),
        value: issuedLease.value,
        leaseId: issuedLease.leaseId,
        expiresAt: issuedLease.expiresAt,
        renewable: issuedLease.renewable,
        issuedBy: issuedLease.issuedBy,
      };
    }

    return null;
  }

  /**
   * Checks if a secrets source is configured.
   *
   * @returns true if inline JSON or secrets file is configured
   */
  public hasConfiguredSource(): boolean {
    return this.readConfiguredSecrets() != null;
  }

  public invalidateCache(): void {
    this.cachedSource = null;
  }

  /**
   * Reads and parses the configured secrets source.
   * Checks file path first, then inline JSON.
   *
   * @returns Parsed secrets or null if not configured
   */
  private readConfiguredSecrets(): {
    sourceName: string;
    filePath: string | null;
    entries: Record<string, unknown>;
  } | null {
    const fileEnv = fileSecretsEnvName(this.providerKind);
    const inlineEnv = inlineSecretsEnvName(this.providerKind);
    const filePath = this.env[fileEnv]?.trim() || "";

    // Check for secrets file first
    if (filePath.length > 0) {
      try {
        const normalizedPath = realpathSync(filePath);
        const fileStat = statSync(normalizedPath);
        const cacheKey = `${this.providerKind}:file:${normalizedPath}:${fileStat.mtimeMs}:${fileStat.size}`;
        if (this.cachedSource?.cacheKey === cacheKey) {
          return this.cachedSource;
        }
        const parsed = normalizeRecord(
          JSON.parse(securelyReadSecretsFile(filePath, `secret.provider_config_invalid:${this.providerKind}:${filePath}`)),
          `secret.provider_config_invalid:${this.providerKind}:${filePath}`,
        );
        this.cachedSource = {
          cacheKey,
          sourceName: fileEnv,
          filePath: normalizedPath,
          entries: parsed,
        };
        return {
          sourceName: fileEnv,
          filePath: normalizedPath,
          entries: parsed,
        };
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("secret.provider_config_invalid:")) {
          throw error;
        }
        throw new ProviderError(`secret.provider_config_invalid:${this.providerKind}:${filePath}`, `secret.provider_config_invalid:${this.providerKind}:${filePath}`, {
          details: { providerKind: this.providerKind, filePath },
          retryable: false,
        });
      }
    }

    // Check for inline JSON
    const inlineJson = this.env[inlineEnv]?.trim() || "";
    if (inlineJson.length > 0) {
      try {
        const cacheKey = `${this.providerKind}:inline:${inlineJson}`;
        if (this.cachedSource?.cacheKey === cacheKey) {
          return this.cachedSource;
        }
        const parsed = normalizeRecord(
          JSON.parse(inlineJson),
          `secret.provider_config_invalid:${this.providerKind}:${inlineEnv}`,
        );
        this.cachedSource = {
          cacheKey,
          sourceName: inlineEnv,
          filePath: null,
          entries: parsed,
        };
        return {
          sourceName: inlineEnv,
          filePath: null,
          entries: parsed,
        };
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("secret.provider_config_invalid:")) {
          throw error;
        }
        throw new ProviderError(`secret.provider_config_invalid:${this.providerKind}:${inlineEnv}`, `secret.provider_config_invalid:${this.providerKind}:${inlineEnv}`, {
          details: { providerKind: this.providerKind, envName: inlineEnv },
          retryable: false,
        });
      }
    }

    return null;
  }
}

/**
 * Async adapter that wraps ExternalSecretProvider to implement ManagedSecretProvider interface.
 * This allows ExternalSecretProvider to be used where async secret providers are expected.
 */
export class ExternalSecretProviderAdapter implements ManagedSecretProvider {
  public readonly providerKind: ExternalSecretProviderKind;

  public constructor(private readonly provider: ExternalSecretProvider) {
    this.providerKind = provider.providerKind;
  }

  public async describeSecret(secretRef: string): Promise<SecretProviderMetadata> {
    return this.provider.describeSecret(secretRef);
  }

  public async requireSecret(secretRef: string): Promise<SecretProviderMetadata & { value: string }> {
    return this.provider.requireSecret(secretRef);
  }

  public async refreshSecret(secretRef: string): Promise<SecretProviderMetadata> {
    this.provider.invalidateCache();
    return this.provider.describeSecret(secretRef);
  }

  public async issueSecretLease?(secretRef: string): Promise<SecretProviderIssuedLease | null> {
    return this.provider.issueSecretLease(secretRef);
  }

  public isConfigured(): boolean {
    return this.provider.hasConfiguredSource();
  }
}
