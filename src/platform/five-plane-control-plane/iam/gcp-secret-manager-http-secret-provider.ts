/**
 * GCP Secret Manager HTTP Secret Provider
 *
 * Retrieves secrets from GCP Secret Manager using native HTTP.
 * No GCP SDK dependencies - uses built-in fetch with OAuth2.
 *
 * ## Purpose
 *
 * Allows retrieval of secrets from GCP Secret Manager for
 * GCP-native deployments.
 *
 * ## Configuration
 *
 * - AA_GCP_PROJECT_ID: GCP project ID
 * - AA_GCP_TOKEN: OAuth2 access token (optional, uses metadata service if not set)
 * - AA_GCP_TOKEN_FETCH_URL: Token fetch URL (defaults to GCE metadata service)
 * - AA_GCP_TIMEOUT_MS: Request timeout (default: 5000)
 *
 * ## Secret Reference Format
 *
 * References like "secret://my-secret" or "secret://my-secret/versions/latest"
 * map directly to GCP Secret Manager secret names.
 *
 * @see https://cloud.google.com/secret-manager/docs
 */

import {
  maskSecretValue,
  type SecretProviderIssuedLease,
  type SecretProviderMetadata,
  type ManagedSecretProvider,
} from "./env-secret-provider.js";
import { ProviderError, ValidationError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const gcpLogger = new StructuredLogger({ retentionLimit: 50 });
const GCP_SAFE_RESOURCE_SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * Configuration options for GCP Secret Manager provider.
 */
export interface GcpSecretManagerHttpProviderOptions {
  /** Environment to read config from */
  env?: NodeJS.ProcessEnv;
}

/**
 * Response from GCP OAuth2 token endpoint.
 */
interface GcpTokenResponse {
  access_token: string;
  expires_in: number;
}

/**
 * Response from GCP Secret Manager access endpoint.
 */
interface GcpSecretVersionPayload {
  name: string;
  payload: { data: string };
}

/**
 * GCP Secret Manager HTTP Secret Provider
 *
 * Retrieves secrets from GCP Secret Manager using native HTTP.
 * Supports both explicit OAuth2 tokens and GCP metadata service.
 */
export class GcpSecretManagerHttpSecretProvider implements ManagedSecretProvider {
  readonly providerKind = "secret_manager" as const;
  private readonly env: NodeJS.ProcessEnv;
  private readonly projectId: string | null;
  private readonly timeoutMs: number;
  private readonly tokenFetchUrl: string;
  private _cachedToken: string | null = null;
  private _tokenExpiry: number = 0;

  public constructor(options: GcpSecretManagerHttpProviderOptions = {}) {
    this.env = options.env ?? process.env;
    this.projectId = this.env["AA_GCP_PROJECT_ID"] ?? null;
    this.timeoutMs = parseInt(this.env["AA_GCP_TIMEOUT_MS"] ?? "5000", 10);
    this.tokenFetchUrl =
      this.env["AA_GCP_TOKEN_FETCH_URL"] ??
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
  }

  public isConfigured(): boolean {
    return this.projectId != null && this.projectId.trim().length > 0;
  }

  public async refreshSecret(secretRef: string): Promise<SecretProviderMetadata> {
    this._cachedToken = null;
    this._tokenExpiry = 0;
    return this.describeSecret(secretRef);
  }

  /**
   * Performs a fetch with timeout.
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
   * Gets an OAuth2 access token.
   * Uses cached token if valid, explicit token if provided,
   * otherwise fetches from GCP metadata service.
   *
   * @returns Valid OAuth2 token
   */
  private async getToken(): Promise<string> {
    // Use cached token if still valid
    if (this._cachedToken && Date.now() < this._tokenExpiry) {
      return this._cachedToken;
    }

    // Use explicit token if provided
    const explicitToken = this.env["AA_GCP_TOKEN"];
    if (explicitToken) {
      this._cachedToken = explicitToken;
      this._tokenExpiry = Date.now() + 3600_000; // Assume 1 hour
      return this._cachedToken;
    }

    // Fetch from GCP metadata service (GCE/Cloud Run)
    const resp = await this.fetchWithTimeout(this.tokenFetchUrl, {
      headers: { "Metadata-Flavor": "Google" },
    });
    if (!resp.ok) {
      throw new ProviderError("gcp.token_fetch_failed:cannot obtain GCP access token", "gcp.token_fetch_failed:cannot obtain GCP access token", {
        details: { status: resp.status },
      });
    }
    const tokenData = (await resp.json()) as GcpTokenResponse;
    this._cachedToken = tokenData.access_token;
    this._tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000; // Buffer 60s
    return this._cachedToken;
  }

  /**
   * Checks if the provider is available.
   *
   * @returns true if project ID is set and token can be obtained
   */
  public async isAvailable(): Promise<boolean> {
    if (!this.projectId) return false;
    try { await this.getToken(); return true; }
    catch (err) {
      gcpLogger.log({ level: "warn", message: "GCP Secret Manager availability check failed", data: { error: err instanceof Error ? err.message : String(err) } });
      return false;
    }
  }

  /**
   * Describes a secret without accessing its value.
   *
   * @param secretRef - Secret reference
   * @returns Metadata about the secret
   */
  public async describeSecret(secretRef: string): Promise<SecretProviderMetadata> {
    return {
      secretRef,
      envName: "AA_GCP_PROJECT_ID",
      scope: "gcp",
      source: "secret_manager",
      resolved: false,
      maskedValue: null,
    };
  }

  /**
   * Parses a secret reference into GCP secret name components.
   *
   * @param secretRef - Secret reference like "secret://my-secret" or "secret://my-secret/versions/latest"
   * @returns Object with project, secret, and version
   */
  private extractSecretName(secretRef: string): { project: string; secret: string; version: string } {
    const normalized = secretRef.replace(/^secret:\/\//, "").replace(/^\/+/, "");
    const parts = normalized.split("/").filter((part) => part.length > 0);
    if (parts.length !== 1 && !(parts.length === 3 && parts[1] === "versions")) {
      throw new ValidationError(`gcp.invalid_secret_ref:${secretRef}`, `gcp.invalid_secret_ref:${secretRef}`, {
        source: "provider",
        details: { secretRef },
      });
    }
    const project = this.requireSafeSegment(this.projectId ?? "", "project", secretRef);
    const secret = this.requireSafeSegment(parts[0] ?? "", "secret", secretRef);
    const version = this.requireSafeSegment(parts[2] ?? "latest", "version", secretRef);
    return { project, secret, version };
  }

  private requireSafeSegment(value: string, field: "project" | "secret" | "version", secretRef: string): string {
    if (!GCP_SAFE_RESOURCE_SEGMENT.test(value)) {
      throw new ValidationError(`gcp.invalid_${field}:${secretRef}`, `gcp.invalid_${field}:${secretRef}`, {
        source: "provider",
        details: { secretRef, field },
      });
    }
    return value;
  }

  /**
   * Retrieves a secret value from GCP Secret Manager.
   *
   * @param secretRef - Secret reference
   * @returns The secret value
   * @throws ValidationError if project not configured or secret not found
   * @throws ProviderError for GCP API errors
   */
  public async requireSecret(secretRef: string): Promise<SecretProviderMetadata & { value: string }> {
    if (!this.projectId) {
      throw new ValidationError(`gcp.config_missing:AA_GCP_PROJECT_ID:${secretRef}`, `gcp.config_missing:AA_GCP_PROJECT_ID:${secretRef}`, {
        source: "provider",
        details: { secretRef },
      });
    }
    const { project, secret, version } = this.extractSecretName(secretRef);
    const token = await this.getToken();

    // Call GCP Secret Manager API
    const url = `https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${secret}/versions/${version}:access`;
    const resp = await this.fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!resp.ok) {
      if (resp.status === 404) {
        throw new ValidationError(`gcp.secret_not_found:${secretRef}`, `gcp.secret_not_found:${secretRef}`, {
          source: "provider",
          details: { secretRef },
        });
      }
      throw new ProviderError(`gcp.request_failed:${secretRef}:${resp.status}`, `gcp.request_failed:${secretRef}:${resp.status}`, {
        details: { secretRef, status: resp.status },
        retryable: resp.status >= 500,
      });
    }

    const data = (await resp.json()) as GcpSecretVersionPayload;
    const secretValue = data.payload?.data;
    if (!secretValue) {
      throw new ProviderError(`gcp.access_failed:${secretRef}`, `gcp.access_failed:${secretRef}`, {
        details: { secretRef },
        retryable: false,
      });
    }

    // Decode base64-encoded secret value
    const decoded = Buffer.from(secretValue, "base64").toString("utf8");
    return {
      secretRef,
      envName: `projects/${project}/secrets/${secret}`,
      scope: "gcp",
      source: "secret_manager",
      resolved: true,
      maskedValue: maskSecretValue(decoded),
      value: decoded,
    };
  }

  /**
   * GCP Secret Manager doesn't have native lease support in this implementation.
   *
   * @returns null (not supported)
   */
  public async issueSecretLease(_secretRef: string): Promise<SecretProviderIssuedLease | null> {
    return null;
  }
}
