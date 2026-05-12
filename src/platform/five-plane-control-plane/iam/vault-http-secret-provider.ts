/**
 * Vault HTTP API Secret Provider
 *
 * Implements HashiCorp Vault KV v2 integration using native HTTP.
 * No external SDK dependencies - uses built-in fetch API.
 *
 * ## Purpose
 *
 * Allows the secret management system to retrieve secrets from
 * HashiCorp Vault instead of environment variables or static files.
 *
 * ## Configuration
 *
 * Configure via environment variables:
 * - AA_VAULT_ADDR: Vault server address (e.g., https://vault.internal:8200)
 * - AA_VAULT_TOKEN: Static token auth (takes precedence over AppRole)
 * - AA_VAULT_APPROLE_ROLE: AppRole role name for authentication
 * - AA_VAULT_APPROLE_SECRET: AppRole secret_id
 * - AA_VAULT_MOUNT: KV v2 mount point (default: secret)
 * - AA_VAULT_TIMEOUT_MS: Request timeout in ms (default: 5000)
 *
 * ## Secret Reference Format
 *
 * References like "secret://mykey" map to:
 *   KV v2 mount point: {mount}/data/{path}
 *
 * @see https://www.vaultproject.io/docs/secrets/kv/kv-v2
 */

import {
  maskSecretValue,
  type SecretProviderIssuedLease,
  type SecretProviderMetadata,
} from "./env-secret-provider.js";
import type { ManagedSecretProvider } from "./secret-management-support.js";
import { ProviderError, ValidationError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const vaultLogger = new StructuredLogger({ retentionLimit: 50 });

/**
 * Configuration options for Vault HTTP provider.
 */
export interface VaultHttpProviderOptions {
  /** Environment to read config from (defaults to process.env) */
  env?: NodeJS.ProcessEnv;
}

/**
 * Response from Vault login endpoint.
 */
interface VaultLoginResponse {
  auth?: {
    client_token: string;
    lease_duration: number;
    renewable: boolean;
  };
}

/**
 * Response from Vault KV read endpoint.
 */
interface VaultKvReadResponse {
  data?: {
    data: Record<string, string>;
    metadata: {
      created_time: string;
      destroyed: boolean;
      version: number;
    };
  };
}

/**
 * Vault HTTP Secret Provider
 *
 * Retrieves secrets from HashiCorp Vault KV v2 using native HTTP.
 * Supports both token and AppRole authentication methods.
 */
export class VaultHttpSecretProvider implements ManagedSecretProvider {
  readonly providerKind = "vault" as const;
  private readonly env: NodeJS.ProcessEnv;
  private readonly mount: string;
  private readonly timeoutMs: number;
  private _cachedToken: string | null = null;
  private _tokenExpiry: number = 0;

  public constructor(options: VaultHttpProviderOptions = {}) {
    this.env = options.env ?? process.env;
    this.mount = this.env["AA_VAULT_MOUNT"] ?? "secret";
    this.timeoutMs = parseInt(this.env["AA_VAULT_TIMEOUT_MS"] ?? "5000", 10);
  }

  public isConfigured(): boolean {
    return typeof this.env["AA_VAULT_ADDR"] === "string" && this.env["AA_VAULT_ADDR"]!.trim().length > 0;
  }

  /**
   * Returns the Vault server address, throwing if not configured.
   */
  private get addr(): string {
    const addr = this.env["AA_VAULT_ADDR"] ?? "";
    if (!addr) {
      throw new ValidationError("vault.config_missing:AA_VAULT_ADDR", "vault.config_missing:AA_VAULT_ADDR", {
        source: "provider",
      });
    }
    return addr.replace(/\/$/, "");
  }

  /**
   * R12-19: Checks if cached token is still valid.
   * Returns true only if token exists and has not expired (with 30s buffer).
   */
  private isTokenCacheValid(): boolean {
    return this._cachedToken !== null && Date.now() < this._tokenExpiry - 30_000;
  }

  /**
   * Performs a fetch with a timeout.
   * Aborts the request if it takes too long.
   *
   * @param url - URL to fetch
   * @param init - Fetch options
   * @returns Response object
   */
  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal, ...init });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Gets an authentication token for Vault.
   * Uses cached token if still valid, otherwise authenticates via
   * AppRole or static token.
   *
   * @returns Valid Vault token
   * @throws ValidationError if no valid auth method is configured
   */
  /**
   * R12-19: Static token TTL in seconds.
   * Configurable via AA_VAULT_STATIC_TOKEN_TTL_SEC environment variable.
   * Default is 3600 seconds (1 hour).
   */
  private get staticTokenTtlSec(): number {
    const envVal = this.env["AA_VAULT_STATIC_TOKEN_TTL_SEC"];
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.min(parsed, 86400); // Cap at 24 hours for security
      }
    }
    return 3600;
  }

  private async getToken(): Promise<string> {
    // R12-19: Use explicit cache validity check with expiry
    if (this.isTokenCacheValid()) {
      return this._cachedToken!;
    }

    // Try AppRole authentication first
    const approleRole = this.env["AA_VAULT_APPROLE_ROLE"];
    const approleSecret = this.env["AA_VAULT_APPROLE_SECRET"];
    if (approleRole && approleSecret) {
      const loginResp = await this.fetchWithTimeout(`${this.addr}/v1/auth/approle/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_name: approleRole, secret_id: approleSecret }),
      });
      if (loginResp.ok) {
        const loginData = (await loginResp.json()) as VaultLoginResponse;
        if (loginData.auth?.client_token) {
          this._cachedToken = loginData.auth.client_token;
          this._tokenExpiry = Date.now() + (loginData.auth.lease_duration ?? 3600) * 1000;
          return this._cachedToken;
        }
      }
    }

    // Fall back to static token
    const staticToken = this.env["AA_VAULT_TOKEN"];
    if (!staticToken) {
      throw new ValidationError(
        "vault.auth_required:set AA_VAULT_TOKEN or AA_VAULT_APPROLE_ROLE + AA_VAULT_APPROLE_SECRET",
        "vault.auth_required:set AA_VAULT_TOKEN or AA_VAULT_APPROLE_ROLE + AA_VAULT_APPROLE_SECRET",
        {
          source: "provider",
        },
      );
    }
    this._cachedToken = staticToken;
    // R12-19: Use configurable TTL instead of hardcoded 3600 seconds
    this._tokenExpiry = Date.now() + this.staticTokenTtlSec * 1000;
    return this._cachedToken;
  }

  /**
   * Performs an authenticated Vault API request.
   *
   * @param path - Vault API path (e.g., "secret/data/mykey")
   * @returns Response from Vault
   */
  private async vaultGet(path: string): Promise<Response> {
    const token = await this.getToken();
    return this.fetchWithTimeout(`${this.addr}/v1/${path}`, {
      headers: { "X-Vault-Token": token },
    });
  }

  /**
   * Extracts the Vault path from a secret reference.
   * Maps "secret://mykey" to the KV v2 data path.
   *
   * @param secretRef - The secret reference
   * @returns Vault KV v2 path
   * @throws ValidationError if path contains path traversal
   */
  private extractSecretPath(secretRef: string): string {
    // R33-12: Validate secretRef does not contain path traversal before extracting path
    if (secretRef.includes("..")) {
      throw new ValidationError(`vault.path_traversal:${secretRef}`, `vault.path_traversal:${secretRef}`, {
        source: "provider",
        details: { secretRef, reason: "path_traversal_detected" },
      });
    }

    const parts = secretRef.replace(/^secret:\/\//, "").split("/");
    if (parts.length === 0) {
      throw new ValidationError(`vault.invalid_ref:${secretRef}`, `vault.invalid_ref:${secretRef}`, {
        source: "provider",
        details: { secretRef },
      });
    }
    const mountPart = parts[0] === this.mount ? parts[0] : this.mount;
    const pathParts = parts[0] === this.mount ? parts.slice(1) : parts;
    const key = pathParts[pathParts.length - 1] ?? "";
    const path = pathParts.slice(0, -1).join("/");
    return `${mountPart}/data/${path}`;
  }

  /**
   * Extracts the secret key name from a reference.
   *
   * @param secretRef - The secret reference
   * @returns The key name
   */
  private extractSecretKey(secretRef: string): string {
    const parts = secretRef.replace(/^secret:\/\//, "").split("/");
    return parts[parts.length - 1] ?? "";
  }

  /**
   * R12-24: Check if Vault is available and configured.
   * Only sends a token if one is actually configured - never sends dummy token.
   *
   * @returns true if Vault address is set and responds
   */
  public async isAvailable(): Promise<boolean> {
    if (!this.env["AA_VAULT_ADDR"]) return false;
    try {
      // R12-24: Only send token header if we have an actual token configured
      const headers: Record<string, string> = {};
      const token = this.env["AA_VAULT_TOKEN"];
      if (token && token.trim().length > 0) {
        headers["X-Vault-Token"] = token;
      }
      const resp = await this.fetchWithTimeout(`${this.addr}/v1/sys/health`, { headers });
      return resp.ok;
    } catch (err) {
      vaultLogger.log({ level: "warn", message: "Vault health check failed", data: { error: err instanceof Error ? err.message : String(err) } });
      return false;
    }
  }

  /**
   * Describes a secret without retrieving its value.
   *
   * @param secretRef - Secret reference
   * @returns Metadata about the secret
   */
  public async describeSecret(secretRef: string): Promise<SecretProviderMetadata> {
    if (!this.env["AA_VAULT_ADDR"]) {
      return {
        secretRef,
        envName: "AA_VAULT_ADDR",
        scope: secretRef.replace(/^secret:\/\//, "").split("/")[0] ?? "",
        source: "vault",
        resolved: false,
        maskedValue: null,
      };
    }
    return {
      secretRef,
      envName: "AA_VAULT_ADDR",
      scope: secretRef.replace(/^secret:\/\//, "").split("/")[0] ?? "",
      source: "vault",
      resolved: false,
      maskedValue: null,
    };
  }

  public async refreshSecret(secretRef: string): Promise<SecretProviderMetadata> {
    this._cachedToken = null;
    this._tokenExpiry = 0;
    return this.describeSecret(secretRef);
  }

  /**
   * Retrieves the secret value from Vault.
   *
   * @param secretRef - Secret reference
   * @returns Metadata with secret value
   * @throws ValidationError if secret not found or key missing
   * @throws ProviderError for Vault API errors
   */
  public async requireSecret(secretRef: string): Promise<SecretProviderMetadata & { value: string }> {
    if (!this.env["AA_VAULT_ADDR"]) {
      throw new ValidationError(`vault.config_missing:${secretRef}`, `vault.config_missing:${secretRef}`, {
        source: "provider",
        details: { secretRef },
      });
    }
    const vaultPath = this.extractSecretPath(secretRef);
    const key = this.extractSecretKey(secretRef);

    const resp = await this.vaultGet(vaultPath);
    if (!resp.ok) {
      if (resp.status === 404) {
        throw new ValidationError(`vault.secret_not_found:${secretRef}`, `vault.secret_not_found:${secretRef}`, {
          source: "provider",
          details: { secretRef, vaultPath },
        });
      }
      throw new ProviderError(`vault.request_failed:${secretRef}:${resp.status}`, `vault.request_failed:${secretRef}:${resp.status}`, {
        details: { secretRef, vaultPath, status: resp.status },
        retryable: resp.status >= 500,
      });
    }

    const data = (await resp.json()) as VaultKvReadResponse;
    const secretValue = data.data?.data?.[key];
    if (secretValue == null) {
      throw new ValidationError(`vault.key_not_found:${secretRef}:${key}`, `vault.key_not_found:${secretRef}:${key}`, {
        source: "provider",
        details: { secretRef, key },
      });
    }

    return {
      secretRef,
      envName: `${this.addr}/v1/${vaultPath}`,
      scope: secretRef.replace(/^secret:\/\//, "").split("/")[0] ?? "",
      source: "vault",
      resolved: true,
      maskedValue: maskSecretValue(secretValue),
      value: secretValue,
    };
  }

  /**
   * Vault KV v2 doesn't support native dynamic leases.
   * This method always returns null.
   *
   * @returns null (not supported)
   */
  public async issueSecretLease(_secretRef: string): Promise<SecretProviderIssuedLease | null> {
    // Vault KV v2 doesn't issue native dynamic leases
    return null;
  }
}
