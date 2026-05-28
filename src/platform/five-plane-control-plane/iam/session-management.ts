/**
 * Session Management Module
 * §11.1/§11.2: access_token TTL=15min, refresh_token=24h, revocation, rotation
 *
 * Implements three-layer auth model:
 * - Layer 1: RBAC with hierarchical role inheritance (access-model.ts)
 * - Layer 2: Capability-based access control
 * - Layer 3: Context-aware authorization
 */

import { createHmac, randomBytes } from "node:crypto";
import { ValidationError } from "../../contracts/errors.js";
import { assertInMemoryStoreAllowed } from "./in-memory-store-guard.js";

// ============================================================================
// Session Token Configuration
// ============================================================================

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;        // 15 minutes
const REFRESH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_SIZE = 32;
const MAX_SESSION_STORE_ENTRIES = 10_000;
const MAX_TOKEN_INDEX_ENTRIES = 20_000;
const TOKEN_LOOKUP_HMAC_KEY = randomBytes(32);

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = "active" | "refreshed" | "revoked" | "expired";

export interface AccessToken {
  readonly tokenId: string;
  readonly sessionId: string;
  readonly principalId: string;
  readonly principalType: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly refreshTokenId: string;
}

export interface RefreshToken {
  readonly tokenId: string;
  readonly sessionId: string;
  readonly principalId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly rotatedCount: number;
  readonly isRotated: boolean;
}

export interface Session {
  readonly sessionId: string;
  readonly principalId: string;
  readonly principalType: string;
  readonly tenantId: string | null;
  readonly status: SessionStatus;
  readonly accessToken: AccessToken;
  readonly refreshToken: RefreshToken;
  readonly createdAt: number;
  readonly lastAccessedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly clientIp: string | null;
  readonly userAgent: string | null;
}

export interface SessionValidationResult {
  readonly valid: boolean;
  readonly session: Session | null;
  readonly reason: SessionValidationError | null;
}

export type SessionValidationError =
  | "session_not_found"
  | "session_expired"
  | "session_revoked"
  | "access_token_expired"
  | "access_token_invalid";

// ============================================================================
// In-Memory Session Store (per §11.2 - production would use distributed cache)
// ============================================================================

interface SessionEntry {
  session: Session;
  accessTokenSecretHash: string;
  refreshTokenSecretHash: string;
}

const sessions = new Map<string, SessionEntry>();
const accessTokenIndex = new Map<string, string>(); // accessTokenSecretHash -> sessionId
const refreshTokenIndex = new Map<string, string>(); // refreshTokenSecretHash -> sessionId
// Index for revoked tokens to enable session_revoked error instead of access_token_invalid
const revokedAccessTokenIndex = new Map<string, string>(); // revoked accessTokenSecretHash -> sessionId
// Index for rotated refresh tokens to enable refresh_token_reused error
const rotatedRefreshTokenIndex = new Map<string, string>(); // old refreshTokenSecretHash -> sessionId

function assertInMemorySessionStoreAllowed(): void {
  assertInMemoryStoreAllowed(
    "AA_ALLOW_IN_MEMORY_SESSION_STORE",
    "iam.session_store_distributed_required",
    "session store",
  );
}

function touchSession(sessionId: string, entry: SessionEntry): void {
  sessions.delete(sessionId);
  sessions.set(sessionId, entry);
}

function deleteSessionEntry(sessionId: string, entry: SessionEntry): void {
  sessions.delete(sessionId);
  accessTokenIndex.delete(entry.accessTokenSecretHash);
  refreshTokenIndex.delete(entry.refreshTokenSecretHash);
  revokedAccessTokenIndex.delete(entry.accessTokenSecretHash);
  rotatedRefreshTokenIndex.delete(entry.refreshTokenSecretHash);
}

function evictOldestEntries<K, V>(index: Map<K, V>, maxEntries: number): void {
  while (index.size > maxEntries) {
    const oldestKey = index.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    index.delete(oldestKey);
  }
}

function pruneSessionStore(now: number = Date.now()): void {
  for (const [sessionId, entry] of sessions.entries()) {
    const refreshExpired = entry.session.refreshToken.expiresAt <= now;
    const revokedWindowExpired = entry.session.status === "revoked"
      && entry.session.accessToken.expiresAt <= now
      && entry.session.refreshToken.expiresAt <= now;
    if (refreshExpired || revokedWindowExpired) {
      deleteSessionEntry(sessionId, entry);
    }
  }

  while (sessions.size > MAX_SESSION_STORE_ENTRIES) {
    const oldestSessionId = sessions.keys().next().value;
    if (oldestSessionId === undefined) {
      return;
    }
    const oldestEntry = sessions.get(oldestSessionId);
    if (!oldestEntry) {
      sessions.delete(oldestSessionId);
      continue;
    }
    deleteSessionEntry(oldestSessionId, oldestEntry);
  }

  evictOldestEntries(revokedAccessTokenIndex, MAX_TOKEN_INDEX_ENTRIES);
  evictOldestEntries(rotatedRefreshTokenIndex, MAX_TOKEN_INDEX_ENTRIES);
}

// ============================================================================
// Token Generation
// ============================================================================

function generateTokenId(): string {
  return randomBytes(TOKEN_SIZE).toString("base64url");
}

function hashToken(token: string): string {
  return createHmac("sha256", TOKEN_LOOKUP_HMAC_KEY).update(token).digest("base64url");
}

function deriveTokenLookupKey(token: string): string {
  return hashToken(token);
}

function hasMatchingBoundContext(
  session: Session,
  clientIp?: string | null,
  userAgent?: string | null,
): boolean {
  if ((session.clientIp ?? null) !== (clientIp ?? null) && session.clientIp != null) {
    return false;
  }
  if ((session.userAgent ?? null) !== (userAgent ?? null) && session.userAgent != null) {
    return false;
  }
  return true;
}

// ============================================================================
// Session Lifecycle Operations
// ============================================================================

/**
 * Create a new session with access token and refresh token.
 * §11.1/§11.2: access_token TTL=15min, refresh_token=24h
 */
export function createSession(input: {
  principalId: string;
  principalType: string;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
  clientIp?: string | null;
  userAgent?: string | null;
}): Session {
  assertInMemorySessionStoreAllowed();
  pruneSessionStore();
  const sessionId = generateTokenId();
  const now = Date.now();

  const refreshTokenId = generateTokenId();
  const accessTokenId = generateTokenId();

  // Create refresh token first
  const refreshToken: RefreshToken = {
    tokenId: refreshTokenId,
    sessionId,
    principalId: input.principalId,
    issuedAt: now,
    expiresAt: now + REFRESH_TOKEN_TTL_MS,
    rotatedCount: 0,
    isRotated: false,
  };

  // Create access token with refresh token back-reference
  const accessToken: AccessToken = {
    tokenId: accessTokenId,
    sessionId,
    principalId: input.principalId,
    principalType: input.principalType,
    issuedAt: now,
    expiresAt: now + ACCESS_TOKEN_TTL_MS,
    refreshTokenId, // Back-reference set during construction
  };

  const session: Session = {
    sessionId,
    principalId: input.principalId,
    principalType: input.principalType,
    tenantId: input.tenantId ?? null,
    status: "active",
    accessToken,
    refreshToken,
    createdAt: now,
    lastAccessedAt: now,
    metadata: Object.freeze(input.metadata ?? {}),
    clientIp: input.clientIp ?? null,
    userAgent: input.userAgent ?? null,
  };

  const entry: SessionEntry = {
    session,
    accessTokenSecretHash: hashToken(accessTokenId),
    refreshTokenSecretHash: hashToken(refreshTokenId),
  };

  touchSession(sessionId, entry);
  accessTokenIndex.set(deriveTokenLookupKey(accessTokenId), sessionId);
  refreshTokenIndex.set(deriveTokenLookupKey(refreshTokenId), sessionId);
  pruneSessionStore(now);

  return session;
}

/**
 * Validate an access token.
 * §11.2: Token validation with expiry check.
 */
export function validateAccessToken(
  accessTokenString: string,
  context: { clientIp?: string | null; userAgent?: string | null } = {},
): SessionValidationResult {
  pruneSessionStore();
  const tokenHash = deriveTokenLookupKey(accessTokenString);
  let sessionId = accessTokenIndex.get(tokenHash);

  // Check if token was revoked (deleted from index but tracked separately)
  if (!sessionId) {
    sessionId = revokedAccessTokenIndex.get(tokenHash) ?? undefined;
  }

  if (!sessionId) {
    return { valid: false, session: null, reason: "access_token_invalid" };
  }

  const entry = sessions.get(sessionId);
  if (!entry) {
    return { valid: false, session: null, reason: "session_not_found" };
  }

  const session = entry.session;

  if (session.status === "revoked") {
    return { valid: false, session, reason: "session_revoked" };
  }

  if (session.status === "expired") {
    return { valid: false, session, reason: "session_expired" };
  }

  const now = Date.now();
  if (session.accessToken.expiresAt < now) {
    return { valid: false, session, reason: "access_token_expired" };
  }

  if (entry.accessTokenSecretHash !== tokenHash) {
    return { valid: false, session: null, reason: "access_token_invalid" };
  }

  if (!hasMatchingBoundContext(session, context.clientIp, context.userAgent)) {
    return { valid: false, session: null, reason: "access_token_invalid" };
  }

  touchSession(sessionId, entry);
  return { valid: true, session, reason: null };
}

/**
 * Refresh tokens with rotation.
 * §11.2: refresh_token rotation with 24h TTL, old token invalidated.
 */
export function refreshSession(refreshTokenString: string, clientIp?: string | null, userAgent?: string | null): Session {
  pruneSessionStore();
  const tokenHash = deriveTokenLookupKey(refreshTokenString);
  let sessionId = refreshTokenIndex.get(tokenHash);
  const reusedTokenSessionId = rotatedRefreshTokenIndex.get(tokenHash);

  // Check if token was rotated (deleted from index but tracked separately)
  if (!sessionId) {
    sessionId = reusedTokenSessionId ?? undefined;
  }

  if (!sessionId) {
    throw new ValidationError("session.refresh_token_invalid", "session.refresh_token_invalid");
  }

  const entry = sessions.get(sessionId);
  if (!entry) {
    throw new ValidationError("session.not_found", "session.not_found");
  }

  const session = entry.session;

  if (session.status === "revoked" || session.status === "expired") {
    throw new ValidationError("session.invalid_state", "session.invalid_state");
  }

  const now = Date.now();
  if (session.refreshToken.expiresAt < now) {
    throw new ValidationError("session.refresh_token_expired", "session.refresh_token_expired");
  }

  if (reusedTokenSessionId != null && entry.refreshTokenSecretHash !== tokenHash) {
    throw new ValidationError("session.refresh_token_reused", "session.refresh_token_reused");
  }

  if (entry.refreshTokenSecretHash !== tokenHash) {
    throw new ValidationError("session.refresh_token_invalid", "session.refresh_token_invalid");
  }

  if (!hasMatchingBoundContext(session, clientIp, userAgent)) {
    throw new ValidationError("session.refresh_token_invalid", "session.refresh_token_invalid");
  }

  if (session.refreshToken.isRotated && session.refreshToken.tokenId !== refreshTokenString) {
    throw new ValidationError("session.refresh_token_reused", "session.refresh_token_reused");
  }

  // Record rotated refresh token for later reuse detection
  rotatedRefreshTokenIndex.set(entry.refreshTokenSecretHash, sessionId);

  // Invalidate old tokens
  accessTokenIndex.delete(entry.accessTokenSecretHash);
  refreshTokenIndex.delete(entry.refreshTokenSecretHash);

  // Issue new tokens with rotation
  const newAccessTokenId = generateTokenId();
  const newRefreshTokenId = generateTokenId();

  const newAccessToken: AccessToken = {
    tokenId: newAccessTokenId,
    sessionId: session.sessionId,
    principalId: session.principalId,
    principalType: session.principalType,
    issuedAt: now,
    expiresAt: now + ACCESS_TOKEN_TTL_MS,
    refreshTokenId: newRefreshTokenId,
  };

  const newRefreshToken: RefreshToken = {
    tokenId: newRefreshTokenId,
    sessionId: session.sessionId,
    principalId: session.principalId,
    issuedAt: now,
    expiresAt: now + REFRESH_TOKEN_TTL_MS,
    rotatedCount: session.refreshToken.rotatedCount + 1,
    isRotated: true,
  };

  const newSession: Session = {
    ...session,
    status: "refreshed",
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    lastAccessedAt: now,
    clientIp: clientIp ?? session.clientIp,
    userAgent: userAgent ?? session.userAgent,
  };

  const newEntry: SessionEntry = {
    session: newSession,
    accessTokenSecretHash: hashToken(newAccessTokenId),
    refreshTokenSecretHash: hashToken(newRefreshTokenId),
  };

  touchSession(sessionId, newEntry);
  accessTokenIndex.set(newEntry.accessTokenSecretHash, sessionId);
  refreshTokenIndex.set(newEntry.refreshTokenSecretHash, sessionId);
  pruneSessionStore(now);

  return newSession;
}

/**
 * Revoke a session (logout).
 * §11.2: Immediate revocation with token invalidation.
 */
export function revokeSession(sessionId: string): void {
  pruneSessionStore();
  const entry = sessions.get(sessionId);
  if (!entry) {
    throw new ValidationError("session.not_found", "session.not_found");
  }

  // Record revoked access token for later lookup (enables session_revoked error)
  revokedAccessTokenIndex.set(entry.accessTokenSecretHash, sessionId);

  // Invalidate tokens
  accessTokenIndex.delete(entry.accessTokenSecretHash);
  refreshTokenIndex.delete(entry.refreshTokenSecretHash);

  // Mark session as revoked
  const revokedSession: Session = {
    ...entry.session,
    status: "revoked",
  };

  touchSession(sessionId, { ...entry, session: revokedSession });
}

/**
 * Revoke all sessions for a principal.
 * §11.2: Bulk revocation for security events (e.g., password change, MFA disable).
 */
export function revokeAllPrincipalSessions(principalId: string): number {
  pruneSessionStore();
  let count = 0;
  const sessionIds = Array.from(sessions.keys());
  for (const sessionId of sessionIds) {
    const entry = sessions.get(sessionId);
    if (entry && entry.session.principalId === principalId) {
      revokeSession(sessionId);
      count++;
    }
  }
  return count;
}

/**
 * Get session by ID.
 */
export function getSession(sessionId: string): Session | null {
  pruneSessionStore();
  return sessions.get(sessionId)?.session ?? null;
}

/**
 * Get all active sessions for a principal.
 */
export function getPrincipalSessions(principalId: string): readonly Session[] {
  pruneSessionStore();
  const result: Session[] = [];
  const entries = Array.from(sessions.values());
  for (const entry of entries) {
    if (entry.session.principalId === principalId && entry.session.status === "active") {
      result.push(entry.session);
    }
  }
  return result;
}

// ============================================================================
// Token Extraction Helpers
// ============================================================================

/**
 * Extract bearer token from Authorization header.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

// ============================================================================
// Audit & Metrics
// ============================================================================

export function getSessionStats(): {
  totalSessions: number;
  activeSessions: number;
  revokedSessions: number;
  expiredSessions: number;
} {
  pruneSessionStore();
  let active = 0;
  let revoked = 0;
  let expired = 0;

  const entries = Array.from(sessions.values());
  for (const entry of entries) {
    switch (entry.session.status) {
      case "active":
      case "refreshed":
        active++;
        break;
      case "revoked":
        revoked++;
        break;
      case "expired":
        expired++;
        break;
    }
  }

  return {
    totalSessions: sessions.size,
    activeSessions: active,
    revokedSessions: revoked,
    expiredSessions: expired,
  };
}

function assertTestSessionMutationAllowed(): void {
  if (process.env.NODE_ENV === "test" || process.env.AA_ALLOW_TEST_SESSION_STORE_MUTATIONS === "1") {
    return;
  }
  throw new ValidationError(
    "session.test_only_mutation_denied",
    "session.test_only_mutation_denied",
  );
}

export function __dangerousResetSessionStoreForTests(): void {
  assertTestSessionMutationAllowed();
  sessions.clear();
  accessTokenIndex.clear();
  refreshTokenIndex.clear();
  revokedAccessTokenIndex.clear();
  rotatedRefreshTokenIndex.clear();
}

export function __dangerousExpireSessionForTests(sessionId: string): void {
  assertTestSessionMutationAllowed();
  const entry = sessions.get(sessionId);
  if (!entry) {
    return;
  }
  const now = Date.now();
  const expiredSession: Session = {
    ...entry.session,
    status: "expired",
    accessToken: {
      ...entry.session.accessToken,
      expiresAt: now - 1,
    },
    refreshToken: {
      ...entry.session.refreshToken,
      expiresAt: now - 1,
    },
  };
  sessions.set(sessionId, { ...entry, session: expiredSession });
}
