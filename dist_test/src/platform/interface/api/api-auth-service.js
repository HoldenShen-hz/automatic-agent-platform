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
import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthError } from "../../contracts/errors.js";
/**
 * Authentication-specific error with HTTP status code and auth category.
 * Used when API key or JWT validation fails.
 */
export class ApiAuthError extends AuthError {
    constructor(statusCode, code, message) {
        super(code, message, {
            statusCode,
            source: "gateway",
            category: "auth",
            retryable: false,
        });
        this.name = "ApiAuthError";
    }
}
function base64UrlEncode(value) {
    return Buffer.from(value, "utf8").toString("base64url");
}
function base64UrlDecode(value) {
    return Buffer.from(value, "base64url").toString("utf8");
}
const ALLOWED_JWT_ALGORITHMS = new Set(["HS256"]);
function signJwt(payload, secret) {
    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const body = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${signature}`;
}
function verifyJwt(token, secret, options) {
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
    let header;
    try {
        header = JSON.parse(base64UrlDecode(encodedHeader));
    }
    catch {
        throw new ApiAuthError(401, "api.invalid_token", "Bearer token header is malformed.");
    }
    const allowedAlgs = options?.allowedAlgorithms ?? ALLOWED_JWT_ALGORITHMS;
    if (!allowedAlgs.has(header.alg ?? "")) {
        throw new ApiAuthError(401, "api.unsupported_algorithm", `JWT algorithm '${header.alg}' is not allowed. Permitted: ${[...allowedAlgs].join(", ")}`);
    }
    if (header.alg === "none" || header.alg === "") {
        throw new ApiAuthError(401, "api.none_algorithm_rejected", "JWT 'none' algorithm is explicitly rejected");
    }
    if (header.typ !== "JWT") {
        throw new ApiAuthError(401, "api.invalid_token_header", "Bearer token header is invalid.");
    }
    // Verify signature
    const body = `${encodedHeader}.${encodedPayload}`;
    const expected = createHmac("sha256", secret).update(body).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw new ApiAuthError(401, "api.invalid_token_signature", "Bearer token signature is invalid.");
    }
    const claims = JSON.parse(base64UrlDecode(encodedPayload));
    if (!claims.sub || !Array.isArray(claims.roles) || typeof claims.exp !== "number") {
        throw new ApiAuthError(401, "api.invalid_token_claims", "Bearer token claims are invalid.");
    }
    if (claims.exp * 1000 <= Date.now()) {
        throw new ApiAuthError(401, "api.token_expired", "Bearer token has expired.");
    }
    if (options?.maxTokenAgeMs != null && claims.iat != null) {
        const tokenAge = Date.now() - claims.iat * 1000;
        if (tokenAge > options.maxTokenAgeMs) {
            throw new ApiAuthError(401, "api.token_too_old", "JWT issued too long ago");
        }
    }
    return claims;
}
function normalizeRoles(roles) {
    return [...new Set(roles)].sort();
}
/**
 * Service for API authentication and authorization.
 *
 * Handles API key validation, JWT token generation and verification,
 * and role-based access control for protected endpoints.
 */
export class ApiAuthService {
    options;
    tokenTtlMs;
    apiKeys;
    maxTokenAgeMs;
    /**
     * Creates an API auth service with the given configuration.
     * @param options - Configuration including registered API keys, JWT secret, and token TTL
     */
    constructor(options) {
        this.options = options;
        this.tokenTtlMs = options.tokenTtlMs ?? 60 * 60 * 1000;
        this.maxTokenAgeMs = options.maxTokenAgeMs ?? 24 * 60 * 60 * 1000;
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
    exchangeApiKey(apiKey, issuedAt = new Date().toISOString()) {
        const record = this.apiKeys.find((item) => {
            if (item.apiKey.length !== apiKey.length) {
                return false;
            }
            return timingSafeEqual(Buffer.from(item.apiKey), Buffer.from(apiKey));
        });
        if (record == null) {
            throw new ApiAuthError(401, "api.invalid_api_key", "API key is invalid.");
        }
        const iatMs = Date.parse(issuedAt);
        const expMs = iatMs + this.tokenTtlMs;
        const claims = {
            sub: record.actorId,
            roles: record.roles,
            ...(record.tenantId ? { tenantId: record.tenantId } : {}),
            iat: Math.floor(iatMs / 1000),
            exp: Math.floor(expMs / 1000),
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
    authenticate(headers) {
        const authorization = headers.authorization;
        if (authorization?.startsWith("Bearer ")) {
            const claims = verifyJwt(authorization.slice("Bearer ".length), this.options.jwtSecret, { maxTokenAgeMs: this.maxTokenAgeMs });
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
    requireRole(headers, requiredRole) {
        const principal = this.authenticate(headers);
        if (!principal.roles.includes(requiredRole)) {
            throw new ApiAuthError(403, "api.forbidden", "Authenticated principal lacks the required role.");
        }
        return principal;
    }
}
//# sourceMappingURL=api-auth-service.js.map