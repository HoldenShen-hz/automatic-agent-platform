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
import { maskSecretValue, } from "./env-secret-provider.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const kmsLogger = new StructuredLogger({ retentionLimit: 50 });
/**
 * Computes HMAC-SHA256.
 */
function hmacSha256(key, data) {
    return createHmac("sha256", key).update(data, "utf8").digest();
}
/**
 * Computes SHA-256 hash.
 */
function sha256(data) {
    return createHash("sha256").update(data, "utf8").digest();
}
/**
 * Builds canonical headers string for AWS Signature V4.
 * Headers must be sorted alphabetically by lowercase name.
 */
function buildCanonicalHeaders(headers) {
    return Object.keys(headers)
        .sort()
        .map((k) => `${k.toLowerCase()}:${headers[k].trim()}\n`)
        .join("");
}
/**
 * Builds signed headers list for AWS Signature V4.
 */
function signedHeaders(headers) {
    return Object.keys(headers)
        .sort()
        .map((k) => k.toLowerCase())
        .join(";");
}
/**
 * Builds the canonical request string for AWS Signature V4.
 */
function buildCanonicalRequest(method, path, query, headers, payloadHash) {
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
function buildStringToSign(algorithm, dateTime, region, service, canonicalRequestHash) {
    return [
        algorithm,
        dateTime,
        `${region}/${service}/aws4_request`,
        canonicalRequestHash,
    ].join("\n");
}
/**
 * Derives the signing key from AWS credentials.
 */
function deriveSigningKey(secretAccessKey, date, region, service) {
    const kDate = hmacSha256(`AWS4${secretAccessKey}`, date);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    return hmacSha256(kService, "aws4_request");
}
/**
 * Computes the AWS Signature V4.
 */
function getSignature(stringToSign, signingKey) {
    return hmacSha256(signingKey, stringToSign).toString("hex");
}
/**
 * Extracts AWS credentials from environment.
 *
 * @param env - Environment to read from
 * @returns Credentials or null if not configured
 */
function getCredentials(env) {
    const accessKeyId = env["AA_AWS_ACCESS_KEY_ID"];
    const secretAccessKey = env["AA_AWS_SECRET_ACCESS_KEY"];
    const region = env["AA_AWS_REGION"] ?? "us-east-1";
    const sessionToken = env["AA_AWS_SESSION_TOKEN"];
    if (!accessKeyId || !secretAccessKey)
        return null;
    return { accessKeyId, secretAccessKey, region, ...(sessionToken ? { sessionToken } : {}) };
}
/**
 * AWS KMS HTTP Secret Provider
 *
 * Decrypts secrets encrypted with AWS KMS.
 * Uses AWS Signature Version 4 for authentication.
 */
export class AwsKmsHttpSecretProvider {
    providerKind = "kms";
    env;
    timeoutMs;
    endpoint;
    constructor(options = {}) {
        this.env = options.env ?? process.env;
        this.timeoutMs = parseInt(this.env["AA_AWS_TIMEOUT_MS"] ?? "5000", 10);
        const region = this.env["AA_AWS_REGION"] ?? "us-east-1";
        this.endpoint = this.env["AA_AWS_KMS_ENDPOINT"] ?? `https://kms.${region}.amazonaws.com`;
    }
    isConfigured() {
        return typeof this.env["AA_AWS_ACCESS_KEY_ID"] === "string"
            && this.env["AA_AWS_ACCESS_KEY_ID"].trim().length > 0
            && typeof this.env["AA_AWS_SECRET_ACCESS_KEY"] === "string"
            && this.env["AA_AWS_SECRET_ACCESS_KEY"].trim().length > 0;
    }
    async refreshSecret(secretRef) {
        return this.describeSecret(secretRef);
    }
    /**
     * Performs a fetch with timeout.
     */
    async fetchWithTimeout(url, init) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            return await fetch(url, { signal: controller.signal, ...init });
        }
        finally {
            clearTimeout(timer);
        }
    }
    /**
     * Extracts the KMS key ID from a secret reference.
     */
    extractKeyId(secretRef) {
        const keyArn = this.env["AA_AWS_KMS_KEY_ARN"];
        const parts = secretRef.replace(/^secret:\/\//, "").split("/");
        if (parts[0] === "kms")
            return parts[parts.length - 1] ?? null;
        return keyArn ?? null;
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
    async awsRequest(method, action, payload) {
        const credentials = getCredentials(this.env);
        if (!credentials) {
            throw new ValidationError("kms.config_missing:set AA_AWS_ACCESS_KEY_ID and AA_AWS_SECRET_ACCESS_KEY", "kms.config_missing:set AA_AWS_ACCESS_KEY_ID and AA_AWS_SECRET_ACCESS_KEY", {
                source: "provider",
            });
        }
        const host = new URL(this.endpoint).host;
        const path = "/";
        const query = `Action=${encodeURIComponent(action)}&Version=2014-11-01`;
        const payloadStr = JSON.stringify(payload);
        const payloadHash = sha256(payloadStr).toString("hex");
        const dateTime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
        const date = dateTime.slice(0, 8);
        // Build headers
        const headers = {
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
        const stringToSign = buildStringToSign("AWS4-HMAC-SHA256", dateTime, credentials.region, "kms", sha256(canonicalReq).toString("hex"));
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
            return JSON.parse(text);
        }
        catch (err) {
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
    async isAvailable() {
        if (!this.env["AA_AWS_ACCESS_KEY_ID"])
            return false;
        try {
            await this.awsRequest("POST", "ListKeys", { Limit: 1 });
            return true;
        }
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
    async describeSecret(secretRef) {
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
    async requireSecret(secretRef) {
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
        const ciphertextBlob = Buffer.from(ciphertextRef, "base64");
        const result = await this.awsRequest("POST", "Decrypt", { CiphertextBlob: { "B": Array.from(ciphertextBlob) } });
        // Extract plaintext from response
        const plaintext = result.Plaintext;
        if (!plaintext?.B) {
            throw new ProviderError(`kms.decrypt_failed:${secretRef}`, `kms.decrypt_failed:${secretRef}`, {
                details: { secretRef },
            });
        }
        const plaintextStr = Buffer.from(plaintext.B).toString("utf8");
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
    async issueSecretLease(_secretRef) {
        // AWS KMS symmetric keys don't have native lease model
        return null;
    }
}
//# sourceMappingURL=aws-kms-http-secret-provider.js.map