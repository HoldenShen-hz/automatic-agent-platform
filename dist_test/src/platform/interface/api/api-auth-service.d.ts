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
export declare class ApiAuthError extends AuthError {
    constructor(statusCode: number, code: string, message: string);
}
/** Configuration options for the API authentication service */
export interface ApiAuthServiceOptions {
    apiKeys: ApiKeyRecord[];
    jwtSecret: string;
    tokenTtlMs?: number;
    /** Allowed JWT signing algorithms (default: ["HS256"]). */
    allowedAlgorithms?: readonly string[];
    /** Maximum token age in milliseconds (default: 24 hours). */
    maxTokenAgeMs?: number;
}
/**
 * Service for API authentication and authorization.
 *
 * Handles API key validation, JWT token generation and verification,
 * and role-based access control for protected endpoints.
 */
export declare class ApiAuthService {
    private readonly options;
    private readonly tokenTtlMs;
    private readonly apiKeys;
    private readonly maxTokenAgeMs;
    /**
     * Creates an API auth service with the given configuration.
     * @param options - Configuration including registered API keys, JWT secret, and token TTL
     */
    constructor(options: ApiAuthServiceOptions);
    /**
     * Exchanges a long-lived API key for a short-lived JWT access token.
     * Used by the /v1/auth/token endpoint.
     *
     * @param apiKey - The API key to validate and exchange
     * @param issuedAt - Timestamp when the exchange was initiated (defaults to now)
     * @returns JWT access token with principal information
     * @throws ApiAuthError if the API key is invalid
     */
    exchangeApiKey(apiKey: string, issuedAt?: string): ExchangeApiKeyResult;
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
    authenticate(headers: Record<string, string | undefined>): ApiPrincipal;
    /**
     * Authenticates a request and verifies the principal has the required role.
     *
     * @param headers - HTTP request headers
     * @param requiredRole - The minimum role required to access the resource
     * @returns The authenticated principal if authorization passes
     * @throws ApiAuthError if authentication fails or principal lacks required role
     */
    requireRole(headers: Record<string, string | undefined>, requiredRole: ApiRole): ApiPrincipal;
}
