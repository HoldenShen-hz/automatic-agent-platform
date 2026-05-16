/**
 * Service-to-Service Authentication Module
 * §11.2: Internal API mTLS / service token authentication
 * §8: Worker pool communication requires mTLS + service identity
 *
 * Implements service identity, mTLS certificate management, and JWT service tokens.
 */

import { randomBytes } from "node:crypto";
import { createHash, createHmac } from "node:crypto";
import { ValidationError } from "../../contracts/errors.js";

// ============================================================================
// Service Auth Configuration
// ============================================================================

const SERVICE_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour for service tokens
const SERVICE_TOKEN_SIZE = 32;
const MTLS_CERT_VALIDITY_DAYS = 90;
const MTLS_ROTATION_DAYS = 30;

// ============================================================================
// Service Identity Types
// ============================================================================

export type ServiceIdentityStatus = "active" | "suspended" | "revoked";
export type ServiceTokenType = "bearer" | "mtls";

export interface ServiceIdentity {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly namespace: string; // e.g., "execution", "orchestration", "control-plane"
  readonly capabilities: readonly string[]; // e.g., ["invoke_model", "tool:invoke"]
  readonly mtlsEnabled: boolean;
  readonly status: ServiceIdentityStatus;
  readonly createdAt: number;
  readonly lastRotatedAt: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ServiceToken {
  readonly tokenId: string;
  readonly serviceId: string;
  readonly tokenType: ServiceTokenType;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly audience: string; // Target service or service namespace
  readonly capabilities: readonly string[];
}

export interface MtlsCertificate {
  readonly certId: string;
  readonly serviceId: string;
  readonly serialNumber: string;
  readonly subject: string;
  readonly issuer: string;
  readonly notBefore: number;
  readonly notAfter: number;
  readonly status: "valid" | "expired" | "revoked";
  readonly san: readonly string[]; // Subject Alternative Names
}

export interface ServiceAuthResult {
  readonly authenticated: boolean;
  readonly serviceIdentity: ServiceIdentity | null;
  readonly token: ServiceToken | null;
  readonly reason: ServiceAuthError | null;
}

export type ServiceAuthError =
  | "service_not_found"
  | "service_suspended"
  | "service_revoked"
  | "token_expired"
  | "token_invalid"
  | "token_mtls_required"
  | "capability_not_granted"
  | "audience_mismatch";

// ============================================================================
// In-Memory Service Identity Store
// ============================================================================

interface ServiceIdentityEntry {
  identity: ServiceIdentity;
  tokens: Map<string, ServiceToken>;
  certificates: Map<string, MtlsCertificate>;
  // HMAC key for token signing (in production, store in HSM/KMS)
  signingKey: Buffer;
}

const serviceIdentities = new Map<string, ServiceIdentityEntry>();
const tokenIndex = new Map<string, string>(); // tokenId -> serviceId
const certIndex = new Map<string, string>(); // certId -> serviceId

function assertInMemoryServiceIdentityStoreAllowed(): void {
  if (process.env.NODE_ENV === "production" && process.env.AA_ALLOW_IN_MEMORY_SERVICE_IDENTITY_STORE !== "1") {
    throw new ValidationError("iam.service_identity_store_distributed_required", "In-memory service identity store is not allowed in production without explicit opt-in.");
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateServiceId(): string {
  return `svc_${randomBytes(16).toString("base64url")}`;
}

function generateTokenId(): string {
  return randomBytes(SERVICE_TOKEN_SIZE).toString("base64url");
}

function generateCertId(): string {
  return randomBytes(16).toString("base64url");
}

function generateSerialNumber(): string {
  const pairs = randomBytes(16).toString("hex").toUpperCase().match(/.{2}/g);
  if (!pairs) {
    throw new Error("iam.service_auth.serial_generation_failed");
  }
  return pairs.join(":");
}

/**
 * Sign a service token with HMAC for integrity verification.
 * §11.2: Service token integrity via HMAC signature.
 */
function signToken(token: ServiceToken, signingKey: Buffer): string {
  const payload = `${token.tokenId}.${token.serviceId}.${token.expiresAt}.${token.audience}`;
  return createHmac("sha256", signingKey).update(payload).digest("base64url");
}

/**
 * Verify token signature.
 */
function verifyTokenSignature(token: ServiceToken, signingKey: Buffer, signature: string): boolean {
  const expected = signToken(token, signingKey);
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

// ============================================================================
// Service Identity Management
// ============================================================================

/**
 * Register a new service identity.
 * §11.2: Service identity registration with namespace and capabilities.
 */
export function registerServiceIdentity(input: {
  serviceName: string;
  namespace: string;
  capabilities: readonly string[];
  mtlsEnabled?: boolean;
  metadata?: Record<string, unknown>;
}): ServiceIdentity {
  assertInMemoryServiceIdentityStoreAllowed();
  const serviceId = generateServiceId();
  const now = Date.now();

  const identity: ServiceIdentity = {
    serviceId,
    serviceName: input.serviceName,
    namespace: input.namespace,
    capabilities: input.capabilities,
    mtlsEnabled: input.mtlsEnabled ?? false,
    status: "active",
    createdAt: now,
    lastRotatedAt: null,
    metadata: Object.freeze(input.metadata ?? {}),
  };

  const signingKey = randomBytes(32);

  serviceIdentities.set(serviceId, {
    identity,
    tokens: new Map(),
    certificates: new Map(),
    signingKey,
  });

  return identity;
}

/**
 * Get service identity by ID.
 */
export function getServiceIdentity(serviceId: string): ServiceIdentity | null {
  return serviceIdentities.get(serviceId)?.identity ?? null;
}

/**
 * Get service identity by name and namespace.
 */
export function getServiceIdentityByName(serviceName: string, namespace: string): ServiceIdentity | null {
  const entries = Array.from(serviceIdentities.values());
  for (const entry of entries) {
    if (entry.identity.serviceName === serviceName && entry.identity.namespace === namespace) {
      return entry.identity;
    }
  }
  return null;
}

/**
 * Update service identity status (suspend/revoke).
 * §11.2: Service identity lifecycle management.
 */
export function updateServiceIdentityStatus(
  serviceId: string,
  status: ServiceIdentityStatus,
): void {
  const entry = serviceIdentities.get(serviceId);
  if (!entry) {
    throw new ValidationError("service.not_found", "service.not_found");
  }

  entry.identity = { ...entry.identity, status };

  // Revoke all tokens if suspended/revoked
  if (status === "suspended" || status === "revoked") {
    const tokenIds = Array.from(entry.tokens.keys());
    for (const tokenId of tokenIds) {
      tokenIndex.delete(tokenId);
    }
    entry.tokens.clear();
  }
}

/**
 * Rotate service identity signing key.
 * §11.2: Periodic key rotation for service tokens.
 */
export function rotateServiceKey(serviceId: string): ServiceIdentity {
  const entry = serviceIdentities.get(serviceId);
  if (!entry) {
    throw new ValidationError("service.not_found", "service.not_found");
  }

  // Generate new signing key
  const newSigningKey = randomBytes(32);
  entry.signingKey = newSigningKey;

    // Update last rotated timestamp, ensuring it's always > createdAt
  entry.identity = {
    ...entry.identity,
    createdAt: entry.identity.createdAt,
    lastRotatedAt: Math.max(Date.now(), entry.identity.createdAt + 1),
  };

  return entry.identity;
}

// ============================================================================
// Service Token Management
// ============================================================================

/**
 * Issue a service token for internal API authentication.
 * §11.2: Service token with TTL, audience, and capabilities.
 */
export function issueServiceToken(input: {
  serviceId: string;
  audience: string;
  capabilities?: readonly string[];
  ttlMs?: number;
}): ServiceToken {
  const entry = serviceIdentities.get(input.serviceId);
  if (!entry) {
    throw new ValidationError("service.not_found", "service.not_found");
  }

  if (entry.identity.status !== "active") {
    throw new ValidationError("service.not_active", "service.not_active");
  }

  const now = Date.now();
  const ttl = input.ttlMs ?? SERVICE_TOKEN_TTL_MS;

  const token: ServiceToken = {
    tokenId: generateTokenId(),
    serviceId: input.serviceId,
    tokenType: "bearer",
    issuedAt: now,
    expiresAt: now + ttl,
    audience: input.audience,
    capabilities: input.capabilities ?? [...entry.identity.capabilities],
  };

  entry.tokens.set(token.tokenId, token);
  tokenIndex.set(token.tokenId, input.serviceId);

  return token;
}

/**
 * Validate a service token.
 * §11.2: Token validation with expiry, audience, and capability checks.
 */
export function validateServiceToken(input: {
  tokenId: string;
  signature: string;
  audience?: string;
  requiredCapabilities?: readonly string[];
}): ServiceAuthResult {
  const serviceId = tokenIndex.get(input.tokenId);
  if (!serviceId) {
    return { authenticated: false, serviceIdentity: null, token: null, reason: "token_invalid" };
  }

  const entry = serviceIdentities.get(serviceId);
  if (!entry) {
    return { authenticated: false, serviceIdentity: null, token: null, reason: "service_not_found" };
  }

  const token = entry.tokens.get(input.tokenId);
  if (!token) {
    return { authenticated: false, serviceIdentity: null, token: null, reason: "token_invalid" };
  }

  // Check expiry
  if (token.expiresAt < Date.now()) {
    return { authenticated: false, serviceIdentity: null, token: null, reason: "token_expired" };
  }

  // Check audience if specified (before signature for proper error ordering)
  if (input.audience && token.audience !== input.audience && token.audience !== "*") {
    return { authenticated: false, serviceIdentity: null, token: null, reason: "audience_mismatch" };
  }

  // Check capabilities if specified (before signature for proper error ordering)
  if (input.requiredCapabilities) {
    const granted = new Set(token.capabilities);
    const hasAll = input.requiredCapabilities.every((cap) => granted.has(cap));
    if (!hasAll) {
      return { authenticated: false, serviceIdentity: null, token: null, reason: "capability_not_granted" };
    }
  }

  // Check signature (last, after other validations)
  if (!verifyTokenSignature(token, entry.signingKey, input.signature)) {
    return { authenticated: false, serviceIdentity: null, token: null, reason: "token_invalid" };
  }

  return {
    authenticated: true,
    serviceIdentity: entry.identity,
    token,
    reason: null,
  };
}

/**
 * Revoke a service token.
 * §11.2: Token revocation for security events.
 */
export function revokeServiceToken(tokenId: string): void {
  const serviceId = tokenIndex.get(tokenId);
  if (!serviceId) {
    throw new ValidationError("token.not_found", "token.not_found");
  }

  const entry = serviceIdentities.get(serviceId);
  if (entry) {
    entry.tokens.delete(tokenId);
  }
  tokenIndex.delete(tokenId);
}

/**
 * Revoke all tokens for a service.
 */
export function revokeAllServiceTokens(serviceId: string): number {
  const entry = serviceIdentities.get(serviceId);
  if (!entry) {
    throw new ValidationError("service.not_found", "service.not_found");
  }

  let count = 0;
  const tokenIds = Array.from(entry.tokens.keys());
  for (const tokenId of tokenIds) {
    tokenIndex.delete(tokenId);
    count++;
  }
  entry.tokens.clear();
  return count;
}

// ============================================================================
// mTLS Certificate Management
// ============================================================================

/**
 * Generate mTLS certificate for a service.
 * §11.2/§8: mTLS certificate with service identity for worker pool communication.
 */
export function generateMtlsCertificate(input: {
  serviceId: string;
  sans?: readonly string[]; // Subject Alternative Names
  validityDays?: number;
}): MtlsCertificate {
  const entry = serviceIdentities.get(input.serviceId);
  if (!entry) {
    throw new ValidationError("service.not_found", "service.not_found");
  }

  if (!entry.identity.mtlsEnabled) {
    throw new ValidationError("service.mtls_not_enabled", "service.mtls_not_enabled");
  }

  const now = Date.now();
  const validityDays = input.validityDays ?? MTLS_CERT_VALIDITY_DAYS;
  const notAfter = now + validityDays * 24 * 60 * 60 * 1000;

  const certId = generateCertId();
  const serialNumber = generateSerialNumber();

  const cert: MtlsCertificate = {
    certId,
    serviceId: input.serviceId,
    serialNumber,
    subject: `CN=${entry.identity.serviceName},O=AutomaticAgentPlatform,OU=${entry.identity.namespace}`,
    issuer: "CN=AutomaticAgentPlatform CA,O=AutomaticAgentPlatform,OU=PKI",
    notBefore: now,
    notAfter,
    status: "valid",
    san: input.sans ?? [`${entry.identity.serviceName}.${entry.identity.namespace}.svc`],
  };

  entry.certificates.set(certId, cert);
  certIndex.set(certId, input.serviceId);

  return cert;
}

/**
 * Get mTLS certificate by ID.
 */
export function getMtlsCertificate(certId: string): MtlsCertificate | null {
  return serviceIdentities.get(certIndex.get(certId)!)?.certificates.get(certId) ?? null;
}

/**
 * Revoke an mTLS certificate.
 * §11.2: Certificate revocation for security events.
 */
export function revokeMtlsCertificate(certId: string): void {
  const serviceId = certIndex.get(certId);
  if (!serviceId) {
    throw new ValidationError("cert.not_found", "cert.not_found");
  }

  const entry = serviceIdentities.get(serviceId);
  if (entry) {
    const cert = entry.certificates.get(certId);
    if (cert) {
      entry.certificates.set(certId, { ...cert, status: "revoked" });
    }
  }
  // Note: Do NOT delete from certIndex - cert must remain findable to check its revoked status
}

/**
 * Get all certificates for a service.
 */
export function getServiceCertificates(serviceId: string): readonly MtlsCertificate[] {
  const entry = serviceIdentities.get(serviceId);
  if (!entry) return [];
  const allCerts = Array.from(entry.certificates.values());
  return allCerts.filter((c) => c.status === "valid");
}

// ============================================================================
// Service Auth Middleware Helper
// ============================================================================

/**
 * Extract and validate service auth from request headers.
 * §11.2: Service auth validation for internal API calls.
 */
export function extractServiceAuth(headers: {
  "x-service-id"?: string;
  "x-service-token"?: string;
  "x-service-token-signature"?: string;
  "x-mtls-cert"?: string;
}): ServiceAuthResult {
  // Check for mTLS certificate first
  if (headers["x-mtls-cert"]) {
    const cert = getMtlsCertificate(headers["x-mtls-cert"]);
    if (!cert) {
      return { authenticated: false, serviceIdentity: null, token: null, reason: "token_invalid" };
    }
    if (cert.status !== "valid") {
      return { authenticated: false, serviceIdentity: null, token: null, reason: "token_invalid" };
    }
    const identity = getServiceIdentity(cert.serviceId);
    if (!identity || identity.status !== "active") {
      return { authenticated: false, serviceIdentity: null, token: null, reason: "service_not_found" };
    }
    return { authenticated: true, serviceIdentity: identity, token: null, reason: null };
  }

  // Check for service token
  if (headers["x-service-id"] && headers["x-service-token"] && headers["x-service-token-signature"]) {
    return validateServiceToken({
      tokenId: headers["x-service-token"],
      signature: headers["x-service-token-signature"],
    });
  }

  return { authenticated: false, serviceIdentity: null, token: null, reason: "token_invalid" };
}

// ============================================================================
// Audit & Stats
// ============================================================================

export function getServiceAuthStats(): {
  totalServices: number;
  activeServices: number;
  activeTokens: number;
  activeCertificates: number;
} {
  let activeServices = 0;
  let activeTokens = 0;
  let activeCertificates = 0;

  const entries = Array.from(serviceIdentities.values());
  for (const entry of entries) {
    if (entry.identity.status === "active") activeServices++;
    activeTokens += entry.tokens.size;
    activeCertificates += entry.certificates.size;
  }

  return {
    totalServices: serviceIdentities.size,
    activeServices,
    activeTokens,
    activeCertificates,
  };
}
