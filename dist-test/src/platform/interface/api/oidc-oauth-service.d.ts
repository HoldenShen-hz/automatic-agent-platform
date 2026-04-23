/**
 * OIDC/OAuth Federation Service
 *
 * Provides:
 * - OIDC discovery and JWKS key fetching
 * - External IdP token validation
 * - API key rotation support
 * - Federation trust management
 *
 * @see docs_zh/contracts/api_auth_contract.md
 */
import type { ApiKeyRotationRecord, FetchLike, JwksKey, OidcProvider, TokenValidationResult } from "./oidc-oauth/types.js";
export type { ApiKeyRotationRecord, JwksKey, OidcProvider, TokenValidationResult, } from "./oidc-oauth/types.js";
/**
 * OIDC/OAuth Federation Service
 *
 * Manages OIDC provider registration, token validation, and API key lifecycle.
 * Supports multiple identity providers with JWKS-based signature verification.
 */
export declare class OidcOAuthService {
    private readonly providers;
    private readonly jwksCache;
    private readonly apiKeys;
    private readonly rotationKeys;
    private readonly trustedIssuers;
    private readonly audience;
    private readonly fetchImpl;
    /** Set to true to skip signature verification (for unit testing only) */
    private readonly _skipSignatureVerification;
    /**
     * Creates a new OidcOAuthService instance.
     *
     * @param providers - Initial OIDC providers to register
     * @param trustedIssuers - List of trusted token issuers
     * @param audience - Expected audience claim
     * @param fetchImpl - Optional fetch implementation for testing
     * @param skipSignatureVerification - Skip signature verification (testing only)
     */
    constructor(providers?: OidcProvider[], trustedIssuers?: string[], audience?: string, fetchImpl?: FetchLike, skipSignatureVerification?: boolean);
    /**
     * Fetches OIDC discovery document from an issuer.
     *
     * @param issuer - The issuer URL (will be normalized by removing trailing slash)
     * @returns The parsed OIDC provider configuration
     */
    fetchOidcDiscovery(issuer: string): Promise<OidcProvider>;
    /**
     * Fetches JWKS (JSON Web Key Set) from a provider.
     * Results are cached for 1 hour.
     *
     * @param issuer - The issuer to fetch JWKS for
     * @returns Array of JWK keys
     */
    fetchJwks(issuer: string): Promise<JwksKey[]>;
    /**
     * Validates a federated token from an external IdP.
     *
     * @param token - The JWT token to validate
     * @returns Validation result with claims if valid
     */
    validateFederatedToken(token: string): Promise<TokenValidationResult>;
    /**
     * Registers a new API key for authentication.
     *
     * @param apiKey - The API key string
     * @param actorId - The actor ID associated with the key
     * @param roles - Roles assigned to this key
     * @param expiresAt - Optional expiration timestamp
     */
    registerApiKey(apiKey: string, actorId: string, roles: string[], expiresAt?: string): void;
    /**
     * Validates an API key.
     *
     * @param apiKey - The API key to validate
     * @returns Validation result with actor ID and roles if valid
     */
    validateApiKey(apiKey: string): {
        valid: boolean;
        actorId: string | null;
        roles: string[];
    };
    /**
     * Initiates API key rotation.
     *
     * @param apiKey - The current API key to rotate
     * @returns Rotation result with new key if successful
     */
    initiateKeyRotation(apiKey: string): {
        success: boolean;
        rotationId: string | null;
        newKey: string | null;
    };
    /**
     * Completes key rotation after grace period.
     *
     * @param rotationId - The rotation ID to complete
     * @returns True if rotation was completed
     */
    completeKeyRotation(rotationId: string): boolean;
    /**
     * Gets the status of a key rotation.
     *
     * @param rotationId - The rotation ID to check
     * @returns Rotation record or null
     */
    getRotationStatus(rotationId: string): ApiKeyRotationRecord | null;
    /**
     * Registers an OIDC provider.
     *
     * @param provider - The provider configuration
     */
    registerProvider(provider: OidcProvider): void;
    /**
     * Gets a registered provider by issuer.
     *
     * @param issuer - The issuer URL
     * @returns Provider or null if not found
     */
    getProvider(issuer: string): OidcProvider | null;
    /**
     * Lists all registered providers.
     *
     * @returns Array of all registered providers
     */
    listProviders(): OidcProvider[];
    /**
     * Verifies JWT signature using JWKS from the issuer.
     *
     * @param token - The JWT token
     * @param header - The decoded header
     * @param signature - The signature portion
     * @param issuer - The token issuer
     * @returns True if signature is valid
     */
    private verifySignature;
    /**
     * Verifies RSA signature using the given key.
     */
    private verifyRsaSignature;
    /**
     * Verifies ECDSA signature using the given key.
     */
    private verifyEcSignature;
    /**
     * Verifies HMAC signature using the given symmetric key.
     */
    private verifyHmacSignature;
    /**
     * Exchanges authorization code for tokens (OAuth2).
     *
     * @param code - Authorization code from redirect
     * @param redirectUri - Original redirect URI used
     * @param codeVerifier - PKCE code verifier
     * @param provider - OIDC provider configuration
     * @param clientId - OAuth client ID
     * @param clientSecret - OAuth client secret
     * @returns Token response with access and ID tokens
     */
    exchangeCodeForTokens(code: string, redirectUri: string, codeVerifier: string, provider: OidcProvider, clientId: string, clientSecret: string): Promise<{
        accessToken: string;
        idToken: string;
        expiresIn: number;
    }>;
    /**
     * Generates a PKCE code verifier.
     *
     * @returns Random 32-byte code verifier
     */
    generateCodeVerifier(): string;
    /**
     * Generates a PKCE code challenge from a verifier.
     *
     * @param verifier - The code verifier
     * @returns S256 hash of the verifier
     */
    generateCodeChallenge(verifier: string): string;
    /**
     * Builds an authorization URL for OAuth/OIDC flow.
     *
     * @param provider - OIDC provider configuration
     * @param clientId - OAuth client ID
     * @param redirectUri - Callback URL
     * @param state - CSRF protection state
     * @param codeChallenge - PKCE code challenge
     * @param scopes - Optional scope override
     * @returns Complete authorization URL
     */
    buildAuthorizationUrl(provider: OidcProvider, clientId: string, redirectUri: string, state: string, codeChallenge: string, scopes?: string[]): string;
}
