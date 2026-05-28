/**
 * AWS KMS HTTP Secret Provider
 *
 * Retrieves secrets encrypted with AWS KMS using native HTTP.
 * No AWS SDK dependencies - implements AWS Signature Version 4 manually.
 *
 * ## Purpose
 *
 * Allows retrieval of secrets that were encrypted with AWS KMS.
 * The encrypted ciphertext is stored in an environment variable, and
 * this provider decrypts it using the KMS API.
 *
 * ## Configuration
 *
 * - AA_AWS_KMS_KEY_ARN: KMS key ARN (e.g., arn:aws:kms:us-east-1:123456:key/xxx)
 * - AA_AWS_REGION: AWS region (e.g., us-east-1)
 * - AA_AWS_ACCESS_KEY_ID: AWS access key
 * - AA_AWS_SECRET_ACCESS_KEY: AWS secret access key
 * - AA_AWS_SESSION_TOKEN: Optional STS session token
 * - AA_AWS_KMS_ENDPOINT: Custom KMS endpoint
 * - AA_AWS_TIMEOUT_MS: Request timeout (default: 5000)
 *
 * ## Usage
 *
 * 1. Encrypt a secret using AWS KMS
 * 2. Store the base64-encoded ciphertext in an environment variable:
 *    AA_KMS_CIPHERTEXT_{KEY_ID}=base64(ciphertext)
 * 3. Reference the secret as "secret://kms/keyId"
 *
 * @see https://docs.aws.amazon.com/kms/latest/developerguide/
 */

import { createHmac, createHash } from "node:crypto";
import { ProviderError, ValidationError } from "../../contracts/errors.js";
import {
  maskSecretValue,
  type SecretProviderIssuedLease,
  type SecretProviderMetadata,
  type ManagedSecretProvider,
} from "./env-secret-provider.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const kmsLogger = new StructuredLogger({ retentionLimit: 50 });

function decodeStrictBase64(value: string, code: string, details: Record<string, unknown>): Buffer {
  const normalized = value.trim();
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
    throw new ProviderError(code, code, {
      details,
      retryable: false,
    });
  }
  const buffer = Buffer.from(normalized, "base64");
  if (buffer.length === 0 || buffer.toString("base64") !== normalized) {
    throw new ProviderError(code, code, {
      details,
      retryable: false,
    });
  }
  return buffer;
}

/**
 * Configuration options for AWS KMS provider.
 */
export interface AwsKmsHttpProviderOptions {
  /** Environment to read config from */
  env?: NodeJS.ProcessEnv;
}

/**
 * AWS credentials for authentication.
 */
interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}

/**
 * Computes HMAC-SHA256.
 */
function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * Computes SHA-256 hash.
 */
function sha256(data: string): Buffer {
  return createHash("sha256").update(data, "utf8").digest();
}

/**
 * Builds canonical headers string for AWS Signature V4.
 * Headers must be sorted alphabetically by lowercase name.
 */
function buildCanonicalHeaders(headers: Record<string, string>): string {
  return Object.keys(headers)
    .sort()
    .map((k) => `${k.toLowerCase()}:${(headers[k] ?? "").trim()}\n`)
    .join("");
}

/**
 * Builds signed headers list for AWS Signature V4.
 */
function signedHeaders(headers: Record<string, string>): string {
  return Object.keys(headers)
    .sort()
    .map((k) => k.toLowerCase())
    .join(";");
}

/**
 * Builds the canonical request string for AWS Signature V4.
 */
function buildCanonicalRequest(
  method: string,
  path: string,
  query: string,
  headers: Record<string, string>,
  payloadHash: string,
): string {
  return [
    method,
    path,
    query,
    buildCanonicalHeaders(headers),
    signedHeaders(headers),
    payloadHash,
  ].join("\n");
}

/**
 * Builds the string to sign for AWS Signature V4.
 */
function buildStringToSign(
  algorithm: string,
  dateTime: string,
  date: string,
  region: string,
  service: string,
  canonicalRequestHash: string,
): string {
  return [
    algorithm,
    dateTime,
    `${date}/${region}/${service}/aws4_request`,
    canonicalRequestHash,
  ].join("\n");
}

/**
 * Derives the signing key from AWS credentials.
 */
function deriveSigningKey(
  secretAccessKey: string,
  date: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

/**
 * Computes the AWS Signature V4.
 */
function getSignature(stringToSign: string, signingKey: Buffer): string {
  return hmacSha256(signingKey, stringToSign).toString("hex");
}

/**
 * Extracts AWS credentials from environment.
 *
 * @param env - Environment to read from
 * @returns Credentials or null if not configured
 */
function getCredentials(env: NodeJS.ProcessEnv): AwsCredentials | null {
  const accessKeyId = env["AA_AWS_ACCESS_KEY_ID"];
  const secretAccessKey = env["AA_AWS_SECRET_ACCESS_KEY"];
  const region = env["AA_AWS_REGION"] ?? "us-east-1";
  const sessionToken = env["AA_AWS_SESSION_TOKEN"];
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey, region, ...(sessionToken ? { sessionToken } : {}) };
}

/**
 * AWS KMS HTTP Secret Provider
 *
 * Decrypts secrets encrypted with AWS KMS.
 * Uses AWS Signature Version 4 for authentication.
 */
export class AwsKmsHttpSecretProvider implements ManagedSecretProvider {
  readonly providerKind = "kms" as const;
  private readonly env: NodeJS.ProcessEnv;
  private readonly timeoutMs: number;
  private readonly endpoint: string;

  public constructor(options: AwsKmsHttpProviderOptions = {}) {
    this.env = options.env ?? process.env;
    this.timeoutMs = parseInt(this.env["AA_AWS_TIMEOUT_MS"] ?? "5000", 10);
    const region = this.env["AA_AWS_REGION"] ?? "us-east-1";
    this.endpoint = this.env["AA_AWS_KMS_ENDPOINT"] ?? `https://kms.${region}.amazonaws.com`;
  }

  public isConfigured(): boolean {
    const accessKeyId = this.env["AA_AWS_ACCESS_KEY_ID"];
    const secretAccessKey = this.env["AA_AWS_SECRET_ACCESS_KEY"];
    return typeof accessKeyId === "string"
      && accessKeyId.trim().length > 0
      && typeof secretAccessKey === "string"
      && secretAccessKey.trim().length > 0;
  }

  public async refreshSecret(secretRef: string): Promise<SecretProviderMetadata> {
    return this.describeSecret(secretRef);
  }

  /**
   * Performs a fetch with timeout.
   */
  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    timer.unref?.();
    try {
      return await fetch(url, { signal: controller.signal, ...init });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Extracts the KMS key ID from a secret reference.
   */
  private extractKeyId(secretRef: string): string | null {
    const keyArn = this.env["AA_AWS_KMS_KEY_ARN"];
    const parts = secretRef.replace(/^secret:\/\//, "").split("/");
    if (parts[0] === "kms") return parts[parts.length - 1] as string | null ?? null;
    return (keyArn as string | null) ?? null;
  }

  /**
   * Makes an authenticated AWS KMS API request.
   * Implements full AWS Signature Version 4 signing.
   *
   * @param method - HTTP method
   * @param action - KMS API action name
   * @param payload - Request payload
   * @returns Parsed response data
   */
  private async awsRequest(
    method: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const credentials = getCredentials(this.env);
    if (!credentials) {
      throw new ValidationError(
        "kms.config_missing:set AA_AWS_ACCESS_KEY_ID and AA_AWS_SECRET_ACCESS_KEY",
        "kms.config_missing:set AA_AWS_ACCESS_KEY_ID and AA_AWS_SECRET_ACCESS_KEY",
        {
          source: "provider",
        },
      );
    }

    const host = new URL(this.endpoint).host;
    const path = "/";
    const query = `Action=${encodeURIComponent(action)}&Version=2014-11-01`;
    const payloadStr = JSON.stringify(payload);
    const payloadHash = sha256(payloadStr).toString("hex");
    const dateTime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = dateTime.slice(0, 8);

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/x-amz-json-1.0",
      "X-Amz-Target": `TrentService.${action}`,
      "X-Amz-Date": dateTime,
      Host: host,
    };
    if (credentials.sessionToken) {
      headers["X-Amz-Security-Token"] = credentials.sessionToken;
    }

    // Build and sign the request
    const canonicalReq = buildCanonicalRequest(method, path, query, headers, payloadHash);
    const stringToSign = buildStringToSign("AWS4-HMAC-SHA256", dateTime, date, credentials.region, "kms", sha256(canonicalReq).toString("hex"));
    const signingKey = deriveSigningKey(credentials.secretAccessKey, date, credentials.region, "kms");
    headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${date}/${credentials.region}/kms/aws4_request,SignedHeaders=${signedHeaders(headers)},Signature=${getSignature(stringToSign, signingKey)}`;

    // Make the request
    const resp = await this.fetchWithTimeout(`${this.endpoint}${path}?${query}`, { method, headers, body: payloadStr });
    const text = await resp.text();
    if (!resp.ok) {
      throw new ProviderError(`kms.request_failed:${action}:${resp.status}:${text}`, `kms.request_failed:${action}:${resp.status}:${text}`, {
        details: { action, status: resp.status },
        retryable: resp.status >= 500,
      });
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      kmsLogger.log({ level: "warn", message: "KMS response parse failed", data: { error: err instanceof Error ? err.message : String(err), responseText: text.slice(0, 200) } });
      throw new ProviderError(`kms.parse_failed:${text}`, `kms.parse_failed:${text}`, {
        details: { action },
        retryable: false,
      });
    }
  }

  /**
   * Checks if KMS provider is available.
   *
   * @returns true if credentials are configured and KMS responds
   */
  public async isAvailable(): Promise<boolean> {
    if (!this.env["AA_AWS_ACCESS_KEY_ID"]) return false;
    try { await this.awsRequest("POST", "ListKeys", { Limit: 1 }); return true; }
    catch (err) {
      kmsLogger.log({ level: "warn", message: "AWS KMS availability check failed", data: { error: err instanceof Error ? err.message : String(err) } });
      return false;
    }
  }

  /**
   * Describes a secret without decrypting it.
   *
   * @param secretRef - Secret reference
   * @returns Metadata about the secret
   */
  public async describeSecret(secretRef: string): Promise<SecretProviderMetadata> {
    return {
      secretRef,
      envName: this.env["AA_AWS_KMS_KEY_ARN"] ?? "AA_AWS_KMS_KEY_ARN",
      scope: "kms",
      source: "kms",
      resolved: false,
      maskedValue: null,
    };
  }

  /**
   * Decrypts a KMS-encrypted secret.
   * The ciphertext must be stored in an environment variable.
   *
   * @param secretRef - Secret reference
   * @returns Decrypted secret value
   * @throws ValidationError if key or ciphertext not configured
   */
  public async requireSecret(secretRef: string): Promise<SecretProviderMetadata & { value: string }> {
    const keyId = this.extractKeyId(secretRef);
    if (!keyId) {
      throw new ValidationError(`kms.key_required:${secretRef}`, `kms.key_required:${secretRef}`, {
        source: "provider",
        details: { secretRef },
      });
    }

    // Get ciphertext from environment variable
    const ciphertextEnvKey = `AA_KMS_CIPHERTEXT_${keyId.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
    const ciphertextRef = this.env[ciphertextEnvKey];
    if (!ciphertextRef) {
      throw new ValidationError(`kms.ciphertext_not_configured:${secretRef}`, `kms.ciphertext_not_configured:${secretRef}`, {
        source: "provider",
        details: { secretRef, ciphertextEnvKey },
      });
    }

    // Decrypt using KMS
    const ciphertextBlob = decodeStrictBase64(
      ciphertextRef,
      `kms.invalid_ciphertext:${secretRef}`,
      { secretRef, ciphertextEnvKey },
    );
    const result = await this.awsRequest("POST", "Decrypt", { CiphertextBlob: ciphertextBlob.toString("base64") });

    // Extract plaintext from response
    const plaintext = (result as Record<string, string | { B?: number[] }>).Plaintext;
    const plaintextStr = typeof plaintext === "string"
      ? Buffer.from(plaintext, "base64").toString("utf8")
      : plaintext?.B != null
        ? Buffer.from(plaintext.B).toString("utf8")
        : null;
    if (plaintextStr == null) {
      throw new ProviderError(`kms.decrypt_failed:${secretRef}`, `kms.decrypt_failed:${secretRef}`, {
        details: { secretRef },
      });
    }

    return {
      secretRef,
      envName: `arn:aws:kms:${this.env["AA_AWS_REGION"] ?? "us-east-1"}`,
      scope: "kms",
      source: "kms",
      resolved: true,
      maskedValue: maskSecretValue(plaintextStr),
      value: plaintextStr,
    };
  }

  /**
   * AWS KMS symmetric keys don't have native lease model.
   *
   * @returns null (not supported)
   */
  public async issueSecretLease(_secretRef: string): Promise<SecretProviderIssuedLease | null> {
    // AWS KMS symmetric keys don't have native lease model
    return null;
  }
}
