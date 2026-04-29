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
 * Simple token bucket rate limiter for preventing brute-force attacks.
 * R12-21: Secret resolution requires rate limiting to prevent enumeration.
 */
class SecretResolutionRateLimiter {
  private readonly buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private readonly maxTokens: number;
  private readonly refillRateMs: number;

  constructor(maxRequestsPerWindow: number = 100, windowMs: number = 60_000) {
    this.maxTokens = maxRequestsPerWindow;
    this.refillRateMs = windowMs;
  }

  /**
   * Check and consume a token for the given key.
   * @returns true if request is allowed, false if rate limited
   */
  public tryConsume(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxTokens - 1, lastRefill: now };
      this.buckets.set(key, bucket);
      return true;
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed >= this.refillRateMs) {
      bucket.tokens = this.maxTokens - 1;
      bucket.lastRefill = now;
      return true;
    }

    // Add tokens based on elapsed time (1 token per refillRateMs/maxTokens)
    const tokensToAdd = Math.floor((elapsed / this.refillRateMs) * this.maxTokens);
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) {
      return false;
    }

    bucket.tokens--;
    return true;
  }

  /** Reset rate limit for a key */
  public reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Reset all rate limits */
  public resetAll(): void {
    this.buckets.clear();
  }
}

// Global rate limiter for secret resolution - 100 requests per minute per caller
const SECRET_RESOLUTION_RATE_LIMITER = new SecretResolutionRateLimiter(100, 60_000);

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
  private async getToken(): Promise<string> {
    // Use cached token if still valid (with 30s buffer)
    if (this._cachedToken && Date.now() < this._tokenExpiry - 30_000) {
      return this._cachedToken;
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
    // R12-19 fix: Static tokens have no defined lease duration and may be revoked at any time.
    // Cache with a short TTL (30s) to balance performance against revocation risk.
    // AppRole tokens are preferred as they have proper lease_duration from Vault.
    this._cachedToken = staticToken;
    this._tokenExpiry = Date.now() + 30_000; // 30 seconds max cache for static tokens
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
   */
  private extractSecretPath(secretRef: string): string {
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
   * Checks if Vault is available and configured.
   *
   * @returns true if Vault address is set and responds
   */
  public async isAvailable(): Promise<boolean> {
    if (!this.env["AA_VAULT_ADDR"]) return false;
    try {
      // R12-24 fix: Don't send X-Vault-Token header for health check
      // - Sending "dummy" token leaks intent to Vault audit logs and may trigger lockout
      // - The sys/health endpoint returns proper status without authentication
      // - Vault returns 200 (initialized, unsealed), 429 (sealed), 472 (data recovery), 501 (not initialized)
      const resp = await this.fetchWithTimeout(`${this.addr}/v1/sys/health`, {
        // No X-Vault-Token header - unauthenticated health check
      });
      // Accept 200 (healthy), 429 (sealed but responding), 472 (recovery mode) as "available"
      return resp.status === 200 || resp.status === 429 || resp.status === 472;
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

    // R12-21: Rate limit secret resolution to prevent brute-force enumeration
    const rateLimitKey = `secret:${secretRef}`;
    if (!SECRET_RESOLUTION_RATE_LIMITER.tryConsume(rateLimitKey)) {
      throw new ProviderError("vault.rate_limited", "vault.rate_limited:too many secret resolution requests", {
        details: { secretRef },
        retryable: true,
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
