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

import { createHmac, createHash, timingSafeEqual, randomBytes, createVerify, createPublicKey, type JsonWebKey } from "node:crypto";
import { BoundedCache } from "../../shared/utils/bounded-cache.js";
import { ProviderError, ValidationError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import {
  ecAlgToNode,
  hmacAlgToNode,
  rsaAlgToNode,
} from "./oidc-oauth/crypto-utils.js";
import {
  decodeJwtJsonSegment,
  parseFederatedTokenClaims,
  parseJwtHeader,
} from "./oidc-oauth/jwt-utils.js";
import type {
  ApiKeyRecord,
  ApiKeyRotationRecord,
  FetchLike,
  JwksKey,
  OidcProvider,
  TokenValidationResult,
} from "./oidc-oauth/types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });
export type {
  ApiKeyRotationRecord,
  JwksKey,
  OidcProvider,
  TokenValidationResult,
} from "./oidc-oauth/types.js";

// ── OIDC Discovery Cache ─────────────────────────────────────────────

const OIDC_DISCOVERY_PATH = "/.well-known/openid-configuration";
const JWKS_CACHE_TTL_MS = 3600000; // 1 hour

/**
 * Creates an OIDC provider error for network issues.
 */
function throwOidcProviderError(
  code: string,
  details: Record<string, unknown> = {},
  statusCode = 502,
): never {
  throw new ProviderError(code, code, {
    statusCode,
    retryable: statusCode >= 500,
    details,
  });
}

/**
 * Creates a validation error for token/claim issues.
 */
function throwOidcValidationError(code: string, details: Record<string, unknown> = {}): never {
  throw new ValidationError(code, code, {
    retryable: false,
    details,
  });
}

// ── OIDC/OAuth Service ─────────────────────────────────────────────────

/**
 * OIDC/OAuth Federation Service
 *
 * Manages OIDC provider registration, token validation, and API key lifecycle.
 * Supports multiple identity providers with JWKS-based signature verification.
 */
export class OidcOAuthService {
  private readonly providers: BoundedCache<string, OidcProvider> = new BoundedCache(50);
  private readonly jwksCache: BoundedCache<string, { keys: JwksKey[]; fetchedAt: number }> = new BoundedCache(200);
  private readonly apiKeys: BoundedCache<string, ApiKeyRecord> = new BoundedCache(500);
  private readonly rotationKeys: BoundedCache<string, ApiKeyRotationRecord> = new BoundedCache(100);
  private readonly trustedIssuers: string[];
  private readonly audience: string;
  private readonly fetchImpl: FetchLike;

  /** Set to true to skip signature verification (for unit testing only) */
  private readonly _skipSignatureVerification: boolean;

  /**
   * Creates a new OidcOAuthService instance.
   *
   * @param providers - Initial OIDC providers to register
   * @param trustedIssuers - List of trusted token issuers
   * @param audience - Expected audience claim
   * @param fetchImpl - Optional fetch implementation for testing
   * @param skipSignatureVerification - Skip signature verification (testing only)
   */
  constructor(
    providers: OidcProvider[] = [],
    trustedIssuers: string[] = [],
    audience: string = "automatic-agent-platform",
    fetchImpl?: FetchLike,
    skipSignatureVerification = false,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
    this._skipSignatureVerification = skipSignatureVerification;
    for (const provider of providers) {
      this.providers.set(provider.issuer, provider);
    }
    this.trustedIssuers = trustedIssuers;
    this.audience = audience;
  }

  // ── OIDC Discovery ────────────────────────────────────────────────

  /**
   * Fetches OIDC discovery document from an issuer.
   *
   * @param issuer - The issuer URL (will be normalized by removing trailing slash)
   * @returns The parsed OIDC provider configuration
   */
  async fetchOidcDiscovery(issuer: string): Promise<OidcProvider> {
    const discoveryUrl = `${issuer.replace(/\/$/, "")}${OIDC_DISCOVERY_PATH}`;
    const response = await this.fetchImpl(discoveryUrl);

    if (!response.ok) {
      throwOidcProviderError("oidc.discovery_failed", { issuer, status: response.status }, response.status);
    }

    const doc = await response.json() as {
      issuer: string;
      authorization_endpoint: string;
      token_endpoint: string;
      jwks_uri: string;
      userinfo_endpoint?: string;
      scopes_supported?: string[];
    };

    const provider: OidcProvider = {
      issuer: doc.issuer,
      authorizationEndpoint: doc.authorization_endpoint,
      tokenEndpoint: doc.token_endpoint,
      jwksUri: doc.jwks_uri,
      ...(doc.userinfo_endpoint !== undefined ? { userInfoEndpoint: doc.userinfo_endpoint } : {}),
      scopes: doc.scopes_supported ?? ["openid", "profile", "email"],
    };

    this.providers.set(provider.issuer, provider);
    return provider;
  }

  /**
   * Fetches JWKS (JSON Web Key Set) from a provider.
   * Results are cached for 1 hour.
   *
   * @param issuer - The issuer to fetch JWKS for
   * @returns Array of JWK keys
   */
  async fetchJwks(issuer: string): Promise<JwksKey[]> {
    const cached = this.jwksCache.get(issuer);
    if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
      return cached.keys;
    }

    const provider = this.providers.get(issuer);
    if (!provider) {
      throwOidcValidationError("oidc.provider_not_registered", { issuer });
    }

    const response = await this.fetchImpl(provider.jwksUri);
    if (!response.ok) {
      throwOidcProviderError("oidc.jwks_fetch_failed", {
        issuer,
        jwksUri: provider.jwksUri,
        status: response.status,
      }, response.status);
    }

    const jwks = await response.json() as { keys: JwksKey[] };
    this.jwksCache.set(issuer, { keys: jwks.keys, fetchedAt: Date.now() });
    return jwks.keys;
  }

  /**
   * Validates a federated token from an external IdP.
   *
   * @param token - The JWT token to validate
   * @returns Validation result with claims if valid
   */
  async validateFederatedToken(token: string): Promise<TokenValidationResult> {
    try {
      // Decode JWT without verification first to get header
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { valid: false, error: "jwt.malformed", claims: null, provider: null };
      }

      const header = parseJwtHeader(decodeJwtJsonSegment(parts[0]!, "header"));
      const payload = parseFederatedTokenClaims(decodeJwtJsonSegment(parts[1]!, "payload"));

      // Verify issuer is trusted
      if (!this.trustedIssuers.includes(payload.iss)) {
        return { valid: false, error: "jwt.untrusted_issuer", claims: null, provider: null };
      }

      // Verify audience
      const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!aud.includes(this.audience)) {
        return { valid: false, error: "jwt.invalid_audience", claims: null, provider: null };
      }

      // Verify expiration
      if (payload.exp * 1000 < Date.now()) {
        return { valid: false, error: "jwt.token_expired", claims: null, provider: null };
      }

      // Skip signature verification if configured (for unit testing with mock tokens)
      if (!this._skipSignatureVerification) {
        const signatureValid = await this.verifySignature(token, header, parts[2]!, payload.iss);
        if (!signatureValid) {
          return { valid: false, error: "jwt.signature_invalid", claims: null, provider: null };
        }
      }

      return {
        valid: true,
        error: null,
        claims: payload,
        provider: payload.iss,
      };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : "jwt.validation_failed",
        claims: null,
        provider: null,
      };
    }
  }

  // ── API Key Management ─────────────────────────────────────────────

  /**
   * Registers a new API key for authentication.
   *
   * @param apiKey - The API key string
   * @param actorId - The actor ID associated with the key
   * @param roles - Roles assigned to this key
   * @param expiresAt - Optional expiration timestamp
   */
  registerApiKey(apiKey: string, actorId: string, roles: string[], expiresAt?: string): void {
    this.apiKeys.set(apiKey, {
      apiKey,
      actorId,
      roles,
      rotatedAt: null,
      expiresAt: expiresAt ?? null,
    });
  }

  /**
   * Validates an API key.
   *
   * @param apiKey - The API key to validate
   * @returns Validation result with actor ID and roles if valid
   */
  validateApiKey(apiKey: string): { valid: boolean; actorId: string | null; roles: string[] } {
    const record = this.apiKeys.get(apiKey);
    if (!record) {
      return { valid: false, actorId: null, roles: [] };
    }

    // Check expiration
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return { valid: false, actorId: null, roles: [] };
    }

    return { valid: true, actorId: record.actorId, roles: record.roles };
  }

  /**
   * Initiates API key rotation.
   *
   * @param apiKey - The current API key to rotate
   * @returns Rotation result with new key if successful
   */
  initiateKeyRotation(apiKey: string): { success: boolean; rotationId: string | null; newKey: string | null } {
    const record = this.apiKeys.get(apiKey);
    if (!record) {
      return { success: false, rotationId: null, newKey: null };
    }

    const rotationId = `rot_${randomBytes(16).toString("hex")}`;
    const newKey = `ak_${randomBytes(24).toString("base64url")}`;

    // Create rotation record
    this.rotationKeys.set(rotationId, {
      keyId: rotationId,
      actorId: record.actorId,
      status: "rotating",
      createdAt: new Date().toISOString(),
      rotatedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h grace period
    });

    // Create new key
    this.apiKeys.set(newKey, {
      apiKey: newKey,
      actorId: record.actorId,
      roles: record.roles,
      rotatedAt: null,
      expiresAt: null,
    });

    return { success: true, rotationId, newKey };
  }

  /**
   * Completes key rotation after grace period.
   *
   * @param rotationId - The rotation ID to complete
   * @returns True if rotation was completed
   */
  completeKeyRotation(rotationId: string): boolean {
    const record = this.rotationKeys.get(rotationId);
    if (!record || record.status !== "rotating") {
      return false;
    }

    record.status = "revoked";
    record.rotatedAt = new Date().toISOString();

    return true;
  }

  /**
   * Gets the status of a key rotation.
   *
   * @param rotationId - The rotation ID to check
   * @returns Rotation record or null
   */
  getRotationStatus(rotationId: string): ApiKeyRotationRecord | null {
    return this.rotationKeys.get(rotationId) ?? null;
  }

  // ── Provider Management ───────────────────────────────────────────

  /**
   * Registers an OIDC provider.
   *
   * @param provider - The provider configuration
   */
  registerProvider(provider: OidcProvider): void {
    this.providers.set(provider.issuer, provider);
  }

  /**
   * Gets a registered provider by issuer.
   *
   * @param issuer - The issuer URL
   * @returns Provider or null if not found
   */
  getProvider(issuer: string): OidcProvider | null {
    return this.providers.get(issuer) ?? null;
  }

  /**
   * Lists all registered providers.
   *
   * @returns Array of all registered providers
   */
  listProviders(): OidcProvider[] {
    return [...this.providers.values()];
  }

  /**
   * Verifies JWT signature using JWKS from the issuer.
   *
   * @param token - The JWT token
   * @param header - The decoded header
   * @param signature - The signature portion
   * @param issuer - The token issuer
   * @returns True if signature is valid
   */
  private async verifySignature(
    token: string,
    header: { kid?: string; alg?: string },
    signature: string,
    issuer: string,
  ): Promise<boolean> {
    try {
      // Fetch JWKS keys for the issuer
      const keys = await this.fetchJwks(issuer);
      if (keys.length === 0) {
        return false;
      }

      // Find the key by kid if specified
      let key = header.kid
        ? keys.find((k) => k.kid === header.kid)
        : keys[0];

      if (!key) {
        // Fall back to first key if kid not found
        key = keys[0];
      }

      if (!key) {
        return false;
      }

      // Determine the algorithm - key.alg takes precedence for RSA/EC to prevent
      // algorithm confusion attacks; header.alg is used for HMAC (kty: "oct")
      let alg: string;
      if (key.kty === "oct") {
        // P0-5: HMAC alg comes from header or default - the key itself has no inherent algorithm
        alg = header.alg ?? key.alg ?? "HS256";
      } else {
        // P0-5: RSA/EC trust key.alg over header.alg to prevent attacker-specified algorithms
        alg = key.alg ?? header.alg ?? "RS256";
      }

      // Verify based on key type
      if (key.kty === "RSA" && key.n && key.e) {
        return this.verifyRsaSignature(token, signature, key, alg);
      } else if (key.kty === "EC" && key.x && key.y && key.crv) {
        return this.verifyEcSignature(token, signature, key, alg);
      } else if (key.kty === "oct") {
        return this.verifyHmacSignature(token, signature, key, alg);
      }

      return false;
    } catch (err) {
      logger.warn("verifyTokenSignature failed", { error: err });
      return false;
    }
  }

  /**
   * Verifies RSA signature using the given key.
   */
  private verifyRsaSignature(token: string, signature: string, key: JwksKey, alg: string): boolean {
    try {
      if (!key.n || !key.e) return false;
      const jwk: JsonWebKey = { kty: "RSA", n: key.n, e: key.e };
      const publicKey = createPublicKey({ format: "jwk", key: jwk });

      const verify = createVerify(rsaAlgToNode(alg));
      verify.update(token.slice(0, token.lastIndexOf(".")));
      return verify.verify(publicKey, Buffer.from(signature, "base64url"));
    } catch (err) {
      logger.warn("verifyRsaSignature failed", { error: err });
      return false;
    }
  }

  /**
   * Verifies ECDSA signature using the given key.
   */
  private verifyEcSignature(token: string, signature: string, key: JwksKey, alg: string): boolean {
    try {
      if (!key.x || !key.y || !key.crv) return false;
      const jwk: JsonWebKey = { kty: "EC", x: key.x, y: key.y, crv: key.crv };
      const publicKey = createPublicKey({ format: "jwk", key: jwk });

      // Node.js ECDSA verify uses algorithm string with ECDSA keys
      const verifyAlg = ecAlgToNode(alg);
      const verify = createVerify(verifyAlg);
      verify.update(token.slice(0, token.lastIndexOf(".")));
      return verify.verify(publicKey, Buffer.from(signature, "base64url"));
    } catch (err) {
      logger.warn("verifyEcSignature failed", { error: err });
      return false;
    }
  }

  /**
   * Verifies HMAC signature using the given symmetric key.
   */
  private verifyHmacSignature(token: string, signature: string, key: JwksKey, alg: string): boolean {
    try {
      // P0-5: For symmetric keys (kty: "oct"), secret is in key.k, not key.x
      if (!key.k) return false;
      const secret = Buffer.from(key.k, "base64url");
      const expected = createHmac(hmacAlgToNode(alg), secret)
        .update(token.slice(0, token.lastIndexOf(".")))
        .digest("base64url");
      const sigBuf = Buffer.from(signature, "base64url");
      const expBuf = Buffer.from(expected, "base64url");
      if (sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    } catch (err) {
      logger.warn("verifyHmacSignature failed", { error: err });
      return false;
    }
  }

  // ── Token Exchange ─────────────────────────────────────────────────

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
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier: string,
    provider: OidcProvider,
    clientId: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; idToken: string; expiresIn: number }> {
    const response = await this.fetchImpl(provider.tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      throwOidcProviderError("oauth.token_exchange_failed", {
        issuer: provider.issuer,
        tokenEndpoint: provider.tokenEndpoint,
        status: response.status,
      }, response.status);
    }

    const tokens = await response.json() as {
      access_token: string;
      id_token?: string;
      expires_in: number;
    };

    return {
      accessToken: tokens.access_token,
      idToken: tokens.id_token ?? tokens.access_token,
      expiresIn: tokens.expires_in,
    };
  }

  /**
   * Generates a PKCE code verifier.
   *
   * @returns Random 32-byte code verifier
   */
  generateCodeVerifier(): string {
    return randomBytes(32).toString("base64url");
  }

  /**
   * Generates a PKCE code challenge from a verifier.
   *
   * @param verifier - The code verifier
   * @returns S256 hash of the verifier
   */
  generateCodeChallenge(verifier: string): string {
    // P0-4: Use createHash, not createHmac - PKCE is a hash, not HMAC
    const hash = createHash("sha256")
      .update(verifier)
      .digest();
    return Buffer.from(hash).toString("base64url");
  }

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
  buildAuthorizationUrl(
    provider: OidcProvider,
    clientId: string,
    redirectUri: string,
    state: string,
    codeChallenge: string,
    scopes?: string[],
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      scope: (scopes ?? provider.scopes).join(" "),
    });

    return `${provider.authorizationEndpoint}?${params}`;
  }
}
