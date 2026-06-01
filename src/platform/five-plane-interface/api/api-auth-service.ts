/**
 * API Authentication Service
 *
 * Handles authentication and authorization for the HTTP API layer.
 * Supports two authentication methods: API keys (exchanged for JWT tokens) and direct JWT bearer tokens.
 *
 * API keys are exchanged for short-lived JWT access tokens via the /v1/auth/token endpoint.
 * Once authenticated, subsequent requests use the JWT Bearer token in the Authorization header.
 *
 * Authorization is role-based with three levels: viewer (read-only), operator (read-write), admin (full access).
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AuthError } from "../../contracts/errors.js";

/** Role levels for API access control */
export type ApiRole = "viewer" | "operator" | "admin";
/** Authentication method used to obtain the current session */
export type ApiAuthMethod = "api_key" | "jwt";

/**
 * The authenticated principal making an API request.
 * Represents the actor (user or service) and their authorization context.
 */
export interface ApiPrincipal {
  actorId: string;
  roles: ApiRole[];
  authMethod: ApiAuthMethod;
  tenantId: string | null;
}

/**
 * A registered API key with its associated identity and roles.
 * API keys are long-lived credentials issued to clients.
 */
export interface ApiKeyRecord {
  apiKey: string;
  actorId: string;
  roles: ApiRole[];
  tenantId?: string;
}

/**
 * Result of exchanging an API key for a JWT access token.
 * The access token is a short-lived credential for API access.
 */
export interface ExchangeApiKeyResult {
  tokenType: "Bearer";
  accessToken: string;
  expiresAt: string;
  principal: ApiPrincipal;
}

/**
 * Authentication-specific error with HTTP status code and auth category.
 * Used when API key or JWT validation fails.
 */
export class ApiAuthError extends AuthError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      source: "gateway",
      category: "auth",
      retryable: false,
    });
    this.name = "ApiAuthError";
  }
}

/** Configuration options for the API authentication service */
export interface ApiAuthServiceOptions {
  apiKeys: ApiKeyRecord[];
  jwtSecret: string;
  /** Additional secrets accepted during JWT verification to support key rotation. */
  jwtVerificationSecrets?: readonly string[];
  tokenTtlMs?: number;
  /** Allowed JWT signing algorithms (default: ["HS256"]). */
  allowedAlgorithms?: readonly string[];
  /** Maximum token age in milliseconds (default: 24 hours). */
  maxTokenAgeMs?: number;
  /** Expected issuer for service-issued and verified JWTs. */
  jwtIssuer?: string;
  /** Expected audience for service-issued and verified JWTs. */
  jwtAudience?: string | readonly string[];
  /** Clock skew tolerance used for exp/iat/nbf validation. */
  clockSkewMs?: number;
  /** Require and validate JWT ID claim during verification. */
  requireJwtId?: boolean;
  /** Revocation callback for JWT IDs. */
  isJwtRevoked?: (jwtId: string, claims: Readonly<JwtClaims>) => boolean;
}


interface JwtClaims {
  sub: string;
  roles: ApiRole[];
  tenantId?: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string | string[];
  nbf?: number;
  jti?: string;
}

const API_ROLE_IMPLICATIONS: Readonly<Record<ApiRole, readonly ApiRole[]>> = Object.freeze({
  viewer: ["viewer", "operator", "admin"],
  operator: ["operator", "admin"],
  admin: ["admin"],
});

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

const ALLOWED_JWT_ALGORITHMS = new Set(["HS256"]);
const MINIMUM_JWT_SECRET_LENGTH = 10;
const WEAK_JWT_SECRET_PATTERNS = [
  /^secret$/i,
  /^password$/i,
  /^changeme$/i,
  /^default$/i,
  /^jwtsecret$/i,
  /^admin$/i,
  /^test(?:ing)?$/i,
  /^qwerty(?:123)?$/i,
  /^(?:1234|12345|123456|12345678|123456789|1234567890)$/,
  /^(.)\1{7,}$/,
] as const;

function hashSecretToken(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function assertJwtSecretStrength(secret: string): void {
  const normalized = secret.trim();
  if (normalized.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new ApiAuthError(500, "api.jwt_secret_too_short", "JWT secret must be at least 10 characters.");
  }
  if (WEAK_JWT_SECRET_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new ApiAuthError(500, "api.jwt_secret_weak", "JWT secret must not use a known weak default.");
  }
}

function normalizeAudience(value: string | readonly string[] | undefined): string[] {
  if (value == null) {
    return [];
  }
  return typeof value === "string" ? [value] : [...value];
}

function claimsMatchAudience(claimsAudience: string | string[] | undefined, allowedAudiences: readonly string[]): boolean {
  if (allowedAudiences.length === 0) {
    return true;
  }
  const claimValues = claimsAudience == null
    ? []
    : Array.isArray(claimsAudience)
      ? claimsAudience
      : [claimsAudience];
  return claimValues.some((audience) => allowedAudiences.includes(audience));
}

function createJwtId(): string {
  return randomBytes(16).toString("hex");
}

function signJwt(payload: JwtClaims, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const body = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyJwt(
  token: string,
  secret: string,
  options?: {
    maxTokenAgeMs?: number;
    allowedAlgorithms?: ReadonlySet<string>;
    verificationSecrets?: readonly string[];
    allowedIssuers?: ReadonlySet<string>;
    allowedAudiences?: readonly string[];
    clockSkewMs?: number;
    requireJwtId?: boolean;
    isJwtRevoked?: (jwtId: string, claims: Readonly<JwtClaims>) => boolean;
  },
): JwtClaims {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new ApiAuthError(401, "api.invalid_token", "Bearer token is malformed.");
  }
  const encodedHeader = segments[0];
  const encodedPayload = segments[1];
  const signature = segments[2];
  if (encodedHeader == null || encodedPayload == null || signature == null) {
    throw new ApiAuthError(401, "api.invalid_token", "Bearer token is malformed.");
  }

  // Parse header and validate algorithm BEFORE signature check (security critical)
  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader)) as { alg?: string; typ?: string };
  } catch {
    throw new ApiAuthError(401, "api.invalid_token", "Bearer token header is malformed.");
  }
  const allowedAlgs = options?.allowedAlgorithms ?? ALLOWED_JWT_ALGORITHMS;
  if (!allowedAlgs.has(header.alg ?? "")) {
    throw new ApiAuthError(401, "api.unsupported_algorithm",
      `JWT algorithm '${header.alg}' is not allowed. Permitted: ${[...allowedAlgs].join(", ")}`);
  }
  if (header.alg === "none" || header.alg === "") {
    throw new ApiAuthError(401, "api.none_algorithm_rejected", "JWT 'none' algorithm is explicitly rejected");
  }
  if (header.typ !== "JWT") {
    throw new ApiAuthError(401, "api.invalid_token_header", "Bearer token header is invalid.");
  }

  // Verify signature
  const body = `${encodedHeader}.${encodedPayload}`;
  const actual = Buffer.from(signature, "base64url");
  const verificationSecrets = [secret, ...(options?.verificationSecrets ?? [])];
  const hasValidSignature = verificationSecrets.some((candidateSecret) => {
    const expected = createHmac("sha256", candidateSecret).update(body).digest();
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  if (!hasValidSignature) {
    throw new ApiAuthError(401, "api.invalid_token_signature", "Bearer token signature is invalid.");
  }

  let claims: JwtClaims;
  try {
    claims = JSON.parse(base64UrlDecode(encodedPayload)) as JwtClaims;
  } catch {
    throw new ApiAuthError(401, "api.invalid_token", "Bearer token payload is malformed.");
  }
  if (!claims.sub || !Array.isArray(claims.roles) || typeof claims.exp !== "number") {
    throw new ApiAuthError(401, "api.invalid_token_claims", "Bearer token claims are invalid.");
  }
  const now = Date.now();
  const clockSkewMs = options?.clockSkewMs ?? 0;
  if (claims.exp * 1000 + clockSkewMs <= now) {
    throw new ApiAuthError(401, "api.token_expired", "Bearer token has expired.");
  }
  if (claims.nbf != null && claims.nbf * 1000 - clockSkewMs > now) {
    throw new ApiAuthError(401, "api.token_not_yet_valid", "Bearer token is not valid yet.");
  }
  if (options?.allowedIssuers != null && options.allowedIssuers.size > 0 && !options.allowedIssuers.has(claims.iss ?? "")) {
    throw new ApiAuthError(401, "api.invalid_token_issuer", "Bearer token issuer is not allowed.");
  }
  if (!claimsMatchAudience(claims.aud, options?.allowedAudiences ?? [])) {
    throw new ApiAuthError(401, "api.invalid_token_audience", "Bearer token audience is not allowed.");
  }
  if (options?.maxTokenAgeMs != null && claims.iat != null) {
    const tokenAge = now - claims.iat * 1000;
    if (tokenAge > options.maxTokenAgeMs) {
      throw new ApiAuthError(401, "api.token_too_old", "JWT issued too long ago");
    }
  }
  if (options?.requireJwtId && typeof claims.jti !== "string") {
    throw new ApiAuthError(401, "api.invalid_token_id", "Bearer token is missing a valid JWT ID.");
  }
  if (typeof claims.jti === "string" && options?.isJwtRevoked?.(claims.jti, claims)) {
    throw new ApiAuthError(401, "api.token_revoked", "Bearer token has been revoked.");
  }
  return claims;
}

function principalHasRequiredRole(principalRoles: readonly ApiRole[], requiredRole: ApiRole): boolean {
  const allowedRoles = API_ROLE_IMPLICATIONS[requiredRole];
  return principalRoles.some((role) => allowedRoles.includes(role));
}

function normalizeRoles(roles: readonly ApiRole[]): ApiRole[] {
  return [...new Set(roles)].sort();
}

/**
 * Service for API authentication and authorization.
 *
 * Handles API key validation, JWT token generation and verification,
 * and role-based access control for protected endpoints.
 */
export class ApiAuthService {
  private readonly tokenTtlMs: number;
  private readonly apiKeys: ApiKeyRecord[];
  private readonly maxTokenAgeMs: number;
  private readonly verificationSecrets: readonly string[];
  private readonly allowedAudiences: readonly string[];
  private readonly clockSkewMs: number;
  private readonly allowedIssuers: ReadonlySet<string>;

  /**
   * Creates an API auth service with the given configuration.
   * @param options - Configuration including registered API keys, JWT secret, and token TTL
   */
  public constructor(private readonly options: ApiAuthServiceOptions) {
    assertJwtSecretStrength(options.jwtSecret);
    for (const rotatedSecret of options.jwtVerificationSecrets ?? []) {
      assertJwtSecretStrength(rotatedSecret);
    }
    this.tokenTtlMs = options.tokenTtlMs ?? 60 * 60 * 1000;
    this.maxTokenAgeMs = options.maxTokenAgeMs ?? 24 * 60 * 60 * 1000;
    this.verificationSecrets = [...(options.jwtVerificationSecrets ?? [])];
    this.allowedAudiences = normalizeAudience(options.jwtAudience);
    this.clockSkewMs = Math.max(0, Math.trunc(options.clockSkewMs ?? 0));
    this.allowedIssuers = new Set(options.jwtIssuer == null ? [] : [options.jwtIssuer]);
    this.apiKeys = options.apiKeys.map((item) => ({
      apiKey: item.apiKey,
      actorId: item.actorId,
      roles: normalizeRoles(item.roles),
      ...(typeof item.tenantId === "string" ? { tenantId: item.tenantId } : {}),
    }));
  }

  /**
   * Exchanges a long-lived API key for a short-lived JWT access token.
   * Used by the /v1/auth/token endpoint.
   *
   * @param apiKey - The API key to validate and exchange
   * @param issuedAt - Timestamp when the exchange was initiated (defaults to now)
   * @returns JWT access token with principal information
   * @throws ApiAuthError if the API key is invalid
   */
  public exchangeApiKey(apiKey: string, issuedAt: string = new Date().toISOString()): ExchangeApiKeyResult {
    const requestedKeyDigest = hashSecretToken(apiKey);
    const record = this.apiKeys.find((item) => {
      return timingSafeEqual(hashSecretToken(item.apiKey), requestedKeyDigest);
    });
    if (record == null) {
      throw new ApiAuthError(401, "api.invalid_api_key", "API key is invalid.");
    }
    const iatMs = Date.parse(issuedAt);
    const expMs = iatMs + this.tokenTtlMs;
    const claims: JwtClaims = {
      sub: record.actorId,
      roles: record.roles,
      ...(record.tenantId ? { tenantId: record.tenantId } : {}),
      iat: Math.floor(iatMs / 1000),
      exp: Math.floor(expMs / 1000),
      ...(this.options.jwtIssuer != null ? { iss: this.options.jwtIssuer } : {}),
      ...(this.allowedAudiences.length > 0
        ? { aud: this.allowedAudiences.length === 1 ? this.allowedAudiences[0] : [...this.allowedAudiences] }
        : {}),
      nbf: Math.floor(iatMs / 1000),
      jti: createJwtId(),
    };
    return {
      tokenType: "Bearer",
      accessToken: signJwt(claims, this.options.jwtSecret),
      expiresAt: new Date(expMs).toISOString(),
      principal: {
        actorId: record.actorId,
        roles: record.roles,
        authMethod: "api_key",
        tenantId: record.tenantId ?? null,
      },
    };
  }

  /**
   * Authenticates an incoming request using Authorization header or API key header.
   *
   * Checks for a Bearer JWT token first, then falls back to x-api-key header.
   * If neither is present, throws an authentication error.
   *
   * @param headers - HTTP request headers
   * @returns The authenticated principal
   * @throws ApiAuthError if authentication fails
   */
  public authenticate(headers: Record<string, string | undefined>): ApiPrincipal {
    const authorization = headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
      const verifyOptions = {
        maxTokenAgeMs: this.maxTokenAgeMs,
        ...(this.options.allowedAlgorithms == null
          ? {}
          : { allowedAlgorithms: new Set(this.options.allowedAlgorithms) }),
        verificationSecrets: this.verificationSecrets,
        allowedIssuers: this.allowedIssuers,
        allowedAudiences: this.allowedAudiences,
        clockSkewMs: this.clockSkewMs,
        requireJwtId: this.options.requireJwtId ?? false,
        ...(this.options.isJwtRevoked == null ? {} : { isJwtRevoked: this.options.isJwtRevoked }),
      };
      const claims = verifyJwt(authorization.slice("Bearer ".length), this.options.jwtSecret, verifyOptions);
      return {
        actorId: claims.sub,
        roles: normalizeRoles(claims.roles),
        authMethod: "jwt",
        tenantId: typeof claims.tenantId === "string" ? claims.tenantId : null,
      };
    }

    const apiKey = headers["x-api-key"];
    if (typeof apiKey === "string" && apiKey.trim().length > 0) {
      return this.exchangeApiKey(apiKey.trim()).principal;
    }

    throw new ApiAuthError(401, "api.auth_required", "This endpoint requires a Bearer token or x-api-key.");
  }

  /**
   * Authenticates a request and verifies the principal has the required role.
   *
   * @param headers - HTTP request headers
   * @param requiredRole - The minimum role required to access the resource
   * @returns The authenticated principal if authorization passes
   * @throws ApiAuthError if authentication fails or principal lacks required role
   */
  public requireRole(headers: Record<string, string | undefined>, requiredRole: ApiRole): ApiPrincipal {
    const principal = this.authenticate(headers);
    if (!principalHasRequiredRole(principal.roles, requiredRole)) {
      throw new ApiAuthError(403, "api.forbidden", "Authenticated principal lacks the required role.");
    }
    return principal;
  }
}
