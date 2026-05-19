/**
 * OIDC Provider configuration from discovery document.
 */
export interface OidcProvider {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  userInfoEndpoint?: string;
  scopes: string[];
  allowedRedirectUris?: string[];
}

/**
 * JWK (JSON Web Key) structure for signature verification.
 */
export interface JwksKey {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
  k?: string;
}

/**
 * Claims extracted from a federated token.
 */
export interface FederatedTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nbf?: number;
  jti?: string;
  email?: string;
  name?: string;
  roles?: string[];
}

/**
 * Result of token validation operation.
 */
export interface TokenValidationResult {
  valid: boolean;
  error: string | null;
  claims: FederatedTokenClaims | null;
  provider: string | null;
}

/**
 * Record of an API key rotation operation.
 */
export interface ApiKeyRotationRecord {
  keyId: string;
  actorId: string;
  oldApiKeyFingerprint: string;
  status: "active" | "rotating" | "revoked";
  createdAt: string;
  rotatedAt: string | null;
  expiresAt: string;
}

/**
 * Configuration state for the OIDC/OAuth service.
 */
export interface OidcOAuthConfig {
  providers: Map<string, OidcProvider>;
  jwksCache: Map<string, { keys: JwksKey[]; fetchedAt: number }>;
  apiKeys: Map<string, ApiKeyRecord>;
  rotationKeys: Map<string, ApiKeyRotationRecord>;
  trustedIssuers: string[];
  audience: string;
}

/**
 * Internal API key record with metadata.
 */
export interface ApiKeyRecord {
  apiKey: string;
  actorId: string;
  roles: string[];
  rotatedAt: string | null;
  expiresAt: string | null;
}

export type FetchLike = typeof fetch;
