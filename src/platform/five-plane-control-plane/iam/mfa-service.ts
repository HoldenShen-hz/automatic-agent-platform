/**
 * Multi-Factor Authentication Module
 * §11/§48: Enterprise SSO/SCIM with MFA enforcement
 *
 * Implements MFA challenge/enrollment/verification flow.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ValidationError } from "../../contracts/errors.js";

// ============================================================================
// MFA Configuration
// ============================================================================

const MFA_CODE_LENGTH = 6;
const MFA_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes for TOTP
const MFA_MAX_VERIFICATION_ATTEMPTS = 5;
const MFA_ENROLLMENT_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes to complete enrollment
const MFA_MAX_PRINCIPALS = 5_000;
const MFA_MAX_ENROLLMENT_SESSIONS = 10_000;
const MFA_MAX_VERIFICATION_CHALLENGES = 10_000;
const MFA_MAX_RATE_LIMIT_KEYS = 10_000;

// ============================================================================
// MFA Types
// ============================================================================

export type MfaMethod = "totp" | "sms" | "email" | "webauthn";
export type MfaChallengeType = "login" | "sensitive_operation" | "session_elevation";
export type MfaEnrollmentStatus = "pending" | "active" | "disabled";
export type MfaVerificationStatus = "verified" | "failed" | "locked";

export interface MfaCredential {
  readonly credentialId: string;
  readonly method: MfaMethod;
  readonly identifier: string; // email, phone number, or device identifier
  readonly status: MfaEnrollmentStatus;
  readonly createdAt: number;
  readonly lastUsedAt: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface MfaEnrollmentChallenge {
  readonly challengeId: string;
  readonly principalId: string;
  readonly method: MfaMethod;
  readonly challengeType: MfaChallengeType;
  readonly code: string; // TOTP secret or verification code sent to user
  readonly expiresAt: number;
  readonly createdAt: number;
}

export interface MfaVerificationChallenge {
  readonly challengeId: string;
  readonly principalId: string;
  readonly method: MfaMethod;
  readonly challengeType: MfaChallengeType;
  readonly attemptsRemaining: number;
  readonly expiresAt: number;
  readonly createdAt: number;
}

export interface MfaEnrollmentSession {
  readonly enrollmentId: string;
  readonly principalId: string;
  readonly method: MfaMethod;
  readonly status: "pending_verification" | "completed" | "expired";
  readonly secret: string; // TOTP secret (stored encrypted in production)
  readonly qrCodeUri: string | null; // For TOTP setup
  readonly expiresAt: number;
  readonly createdAt: number;
}

export interface MfaPolicy {
  readonly requireMfaForSensitiveOps: boolean;
  readonly requireMfaForSso: boolean;
  readonly allowedMethods: readonly MfaMethod[];
  readonly maxVerificationAttempts: number;
  readonly lockoutDurationMs: number;
}

// ============================================================================
// In-Memory MFA Store (per §48 - production would use encrypted persistent store)
// ============================================================================

interface MfaCredentialEntry {
  credential: MfaCredential;
  verificationFailures: number;
  lockedUntil: number | null;
  totpSecret: string | null;
  usedTotpCounters: Set<number>;
}

const principalCredentials = new Map<string, MfaCredentialEntry[]>();
const enrollmentSessions = new Map<string, MfaEnrollmentSession>();
const verificationChallenges = new Map<string, MfaVerificationChallenge>();
const challengeCreationTimestamps = new Map<string, number[]>();
const MFA_ALLOWED_CLOCK_SKEW_WINDOWS = [-1, 0, 1] as const;
const MFA_CHALLENGE_RATE_LIMIT_WINDOW_MS = 60_000;
const MFA_CHALLENGE_RATE_LIMIT_MAX_REQUESTS = 5;

// ============================================================================
// Token Generation
// ============================================================================

function generateChallengeId(): string {
  return randomBytes(16).toString("base64url");
}

function generateEnrollmentId(): string {
  return randomBytes(16).toString("base64url");
}

function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

function encodeBase32(bytes: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let output = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 0x1f] ?? "";
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 0x1f] ?? "";
  }
  return output;
}

function decodeBase32(secret: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = secret.replace(/=+$/u, "").replace(/\s+/gu, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) {
      throw new ValidationError("mfa.invalid_totp_secret", "mfa.invalid_totp_secret");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpCode(secret: string, timestamp: number = Date.now()): string {
  const counter = Math.floor(timestamp / 30000); // 30-second window
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", decodeBase32(secret));
  const hash = hmac.update(counterBuffer).digest();
  const hashLen = hash.length;
  const offset = (hash[hashLen - 1] ?? 0) & 0x0f;
  const binary =
    ((hash[offset]! & 0x7f) << 24) |
    ((hash[offset + 1]! & 0xff) << 16) |
    ((hash[offset + 2]! & 0xff) << 8) |
    (hash[offset + 3]! & 0xff);
  const otp = binary % 10 ** MFA_CODE_LENGTH;
  return otp.toString().padStart(MFA_CODE_LENGTH, "0");
}

function getTotpCounter(timestamp: number = Date.now()): number {
  return Math.floor(timestamp / 30000);
}

function safeCompareCode(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function pruneExpiredMfaState(now: number = Date.now()): void {
  for (const [enrollmentId, session] of enrollmentSessions.entries()) {
    if (session.expiresAt <= now || session.status === "completed" || session.status === "expired") {
      enrollmentSessions.delete(enrollmentId);
    }
  }
  for (const [challengeId, challenge] of verificationChallenges.entries()) {
    if (challenge.expiresAt <= now) {
      verificationChallenges.delete(challengeId);
    }
  }
  for (const [key, timestamps] of challengeCreationTimestamps.entries()) {
    const next = timestamps.filter((timestamp) => timestamp > now - MFA_CHALLENGE_RATE_LIMIT_WINDOW_MS);
    if (next.length === 0) {
      challengeCreationTimestamps.delete(key);
      continue;
    }
    challengeCreationTimestamps.set(key, next);
  }
  pruneMfaMapSizes();
}

function pruneMfaMapSizes(): void {
  if (principalCredentials.size > MFA_MAX_PRINCIPALS) {
    const entries = Array.from(principalCredentials.entries()).sort((left, right) => {
      const leftTs = Math.max(...left[1].map((entry) => entry.credential.lastUsedAt ?? entry.credential.createdAt));
      const rightTs = Math.max(...right[1].map((entry) => entry.credential.lastUsedAt ?? entry.credential.createdAt));
      return leftTs - rightTs;
    });
    for (const [principalId] of entries.slice(0, principalCredentials.size - MFA_MAX_PRINCIPALS)) {
      principalCredentials.delete(principalId);
    }
  }
  if (enrollmentSessions.size > MFA_MAX_ENROLLMENT_SESSIONS) {
    const sessions = Array.from(enrollmentSessions.values()).sort((left, right) => left.createdAt - right.createdAt);
    for (const session of sessions.slice(0, enrollmentSessions.size - MFA_MAX_ENROLLMENT_SESSIONS)) {
      enrollmentSessions.delete(session.enrollmentId);
    }
  }
  if (verificationChallenges.size > MFA_MAX_VERIFICATION_CHALLENGES) {
    const challenges = Array.from(verificationChallenges.values()).sort((left, right) => left.createdAt - right.createdAt);
    for (const challenge of challenges.slice(0, verificationChallenges.size - MFA_MAX_VERIFICATION_CHALLENGES)) {
      verificationChallenges.delete(challenge.challengeId);
    }
  }
  if (challengeCreationTimestamps.size > MFA_MAX_RATE_LIMIT_KEYS) {
    const sorted = Array.from(challengeCreationTimestamps.entries()).sort((left, right) => {
      const leftLatest = Math.max(...left[1], Number.NEGATIVE_INFINITY);
      const rightLatest = Math.max(...right[1], Number.NEGATIVE_INFINITY);
      return leftLatest - rightLatest;
    });
    for (const [key] of sorted.slice(0, challengeCreationTimestamps.size - MFA_MAX_RATE_LIMIT_KEYS)) {
      challengeCreationTimestamps.delete(key);
    }
  }
}

function assertChallengeRateLimit(principalId: string, method: MfaMethod, now: number): void {
  const key = `${principalId}:${method}`;
  const recent = (challengeCreationTimestamps.get(key) ?? []).filter((timestamp) => timestamp > now - MFA_CHALLENGE_RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MFA_CHALLENGE_RATE_LIMIT_MAX_REQUESTS) {
    challengeCreationTimestamps.set(key, recent);
    throw new ValidationError("mfa.challenge_rate_limited", "mfa.challenge_rate_limited");
  }
  recent.push(now);
  challengeCreationTimestamps.set(key, recent);
}

function resolveTotpMatch(secret: string, code: string, timestamp: number = Date.now()): number | null {
  for (const offset of MFA_ALLOWED_CLOCK_SKEW_WINDOWS) {
    const candidateTimestamp = timestamp + offset * 30_000;
    const expectedCode = generateTotpCode(secret, candidateTimestamp);
    if (safeCompareCode(expectedCode, code)) {
      return getTotpCounter(candidateTimestamp);
    }
  }
  return null;
}

function sanitizeCredential(credential: MfaCredential): MfaCredential {
  return {
    ...credential,
    metadata: Object.freeze({
      ...credential.metadata,
    }),
  };
}

function maskMfaIdentifier(identifier: string): string {
  const normalized = identifier.trim();
  const atIndex = normalized.indexOf("@");
  if (atIndex > 1) {
    const local = normalized.slice(0, atIndex);
    const domain = normalized.slice(atIndex + 1);
    const visibleLocal = local.slice(0, Math.min(2, local.length));
    return `${visibleLocal}${"*".repeat(Math.max(1, local.length - visibleLocal.length))}@${domain}`;
  }
  if (/^\+?[0-9\-()\s]{6,}$/.test(normalized)) {
    const digits = normalized.replace(/\D/g, "");
    const suffix = digits.slice(-4);
    return `${"*".repeat(Math.max(0, digits.length - suffix.length))}${suffix}`;
  }
  if (normalized.length <= 4) {
    return "*".repeat(normalized.length);
  }
  return `${normalized.slice(0, 2)}${"*".repeat(Math.max(1, normalized.length - 4))}${normalized.slice(-2)}`;
}

// ============================================================================
// MFA Policy
// ============================================================================

export const DEFAULT_MFA_POLICY: MfaPolicy = {
  requireMfaForSensitiveOps: true,
  requireMfaForSso: true,
  allowedMethods: ["totp", "sms", "email", "webauthn"],
  maxVerificationAttempts: MFA_MAX_VERIFICATION_ATTEMPTS,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
};

/**
 * Check if an operation requires MFA based on policy.
 * §48: MFA enforcement for sensitive operations and SSO.
 */
export function operationRequiresMfa(
  policy: MfaPolicy,
  operationType: "sensitive" | "standard" | "sso",
): boolean {
  switch (operationType) {
    case "sensitive":
      return policy.requireMfaForSensitiveOps;
    case "sso":
      return policy.requireMfaForSso;
    case "standard":
    default:
      return false;
  }
}

// ============================================================================
// MFA Enrollment
// ============================================================================

/**
 * Start MFA enrollment - generates TOTP secret and QR code URI.
 * §48: MFA enrollment flow for enterprise SSO/SCIM.
 */
export function startMfaEnrollment(input: {
  principalId: string;
  method: MfaMethod;
  policy?: MfaPolicy;
}): MfaEnrollmentSession {
  pruneExpiredMfaState();
  const policy = input.policy ?? DEFAULT_MFA_POLICY;
  if (!policy.allowedMethods.includes(input.method)) {
    throw new ValidationError("mfa.method_not_allowed", "mfa.method_not_allowed");
  }

  const enrollmentId = generateEnrollmentId();
  const secret = generateTotpSecret();
  const now = Date.now();

  // Generate TOTP URI for authenticator apps (RFC 6238)
  const issuer = "AutomaticAgentPlatform";
  const qrCodeUri = `otpauth://totp/${issuer}:${input.principalId}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  const session: MfaEnrollmentSession = {
    enrollmentId,
    principalId: input.principalId,
    method: input.method,
    status: "pending_verification",
    secret,
    qrCodeUri,
    expiresAt: now + MFA_ENROLLMENT_EXPIRY_MS,
    createdAt: now,
  };

  enrollmentSessions.set(enrollmentId, session);
  pruneMfaMapSizes();
  return session;
}

/**
 * Complete MFA enrollment by verifying the first TOTP code.
 * §48: MFA verification during enrollment.
 */
export function completeMfaEnrollment(input: {
  enrollmentId: string;
  verificationCode: string;
}): MfaCredential {
  pruneExpiredMfaState();
  const session = enrollmentSessions.get(input.enrollmentId);
  if (!session) {
    throw new ValidationError("mfa.enrollment_not_found", "mfa.enrollment_not_found");
  }

  if (session.status === "expired" || session.expiresAt < Date.now()) {
    enrollmentSessions.delete(input.enrollmentId);
    throw new ValidationError("mfa.enrollment_expired", "mfa.enrollment_expired");
  }

  if (session.status === "completed") {
    throw new ValidationError("mfa.enrollment_already_completed", "mfa.enrollment_already_completed");
  }

  // Verify the TOTP code
  const existingCredential = principalCredentials
    .get(session.principalId)
    ?.find((entry) => entry.credential.method === session.method && entry.credential.status !== "disabled");
  if (existingCredential) {
    throw new ValidationError("mfa.credential_already_exists", "mfa.credential_already_exists");
  }

  const matchedCounter = resolveTotpMatch(session.secret, input.verificationCode);
  if (matchedCounter == null) {
    throw new ValidationError("mfa.invalid_code", "mfa.invalid_code");
  }

  const now = Date.now();
  const credential: MfaCredential = {
    credentialId: generateChallengeId(),
    method: session.method,
    identifier: maskMfaIdentifier(session.principalId),
    status: "active",
    createdAt: now,
    lastUsedAt: now,
    metadata: Object.freeze({
      enrollmentId: session.enrollmentId,
    }),
  };

  // Store credential
  if (!principalCredentials.has(session.principalId)) {
    principalCredentials.set(session.principalId, []);
  }
  principalCredentials.get(session.principalId)?.push({
    credential,
    verificationFailures: 0,
    lockedUntil: null,
    totpSecret: session.secret,
    usedTotpCounters: new Set([matchedCounter]),
  });

  // Update enrollment session
  const completedSession: MfaEnrollmentSession = { ...session, status: "completed" };
  enrollmentSessions.set(input.enrollmentId, completedSession);

  return credential;
}

/**
 * Get MFA credentials for a principal.
 */
export function getMfaCredentials(principalId: string): readonly MfaCredential[] {
  pruneExpiredMfaState();
  return principalCredentials.get(principalId)?.map((e) => sanitizeCredential(e.credential)) ?? [];
}

/**
 * Check if principal has active MFA enrolled.
 * §48: MFA enrollment check for SSO/SCIM integration.
 */
export function hasActiveMfa(principalId: string): boolean {
  const credentials = principalCredentials.get(principalId);
  if (!credentials) return false;
  return credentials.some((e) => e.credential.status === "active");
}

// ============================================================================
// MFA Verification / Challenge
// ============================================================================

/**
 * Create a new MFA verification challenge.
 * §48: MFA challenge flow.
 */
export function createMfaChallenge(input: {
  principalId: string;
  method: MfaMethod;
  challengeType: MfaChallengeType;
}): MfaVerificationChallenge {
  const now = Date.now();
  pruneExpiredMfaState(now);
  const credentials = principalCredentials.get(input.principalId);
  const credential = credentials?.find((e) => e.credential.method === input.method && e.credential.status === "active");

  if (!credential) {
    throw new ValidationError("mfa.credential_not_found", "mfa.credential_not_found");
  }

  // Check if locked
  if (credential.lockedUntil !== null && credential.lockedUntil > now) {
    throw new ValidationError("mfa.account_locked", "mfa.account_locked");
  }
  if (credential.lockedUntil !== null && credential.lockedUntil <= now) {
    credential.lockedUntil = null;
    credential.verificationFailures = 0;
  }

  assertChallengeRateLimit(input.principalId, input.method, now);

  const challengeId = generateChallengeId();

  const challenge: MfaVerificationChallenge = {
    challengeId,
    principalId: input.principalId,
    method: input.method,
    challengeType: input.challengeType,
    attemptsRemaining: DEFAULT_MFA_POLICY.maxVerificationAttempts - credential.verificationFailures,
    expiresAt: now + MFA_CODE_TTL_MS,
    createdAt: now,
  };

  verificationChallenges.set(challengeId, challenge);
  return challenge;
}

/**
 * Verify an MFA challenge code.
 * §48: MFA verification with lockout on failed attempts.
 */
export function verifyMfaChallenge(input: {
  challengeId: string;
  code: string;
}): MfaVerificationResult {
  pruneExpiredMfaState();
  const challenge = verificationChallenges.get(input.challengeId);
  if (!challenge) {
    throw new ValidationError("mfa.challenge_not_found", "mfa.challenge_not_found");
  }

  const now = Date.now();
  if (challenge.expiresAt < now) {
    verificationChallenges.delete(input.challengeId);
    throw new ValidationError("mfa.challenge_expired", "mfa.challenge_expired");
  }

  // Get credential
  const credentials = principalCredentials.get(challenge.principalId);
  const entry = credentials?.find((e) => e.credential.method === challenge.method);

  if (!entry) {
    throw new ValidationError("mfa.credential_not_found", "mfa.credential_not_found");
  }

  if (entry.credential.status !== "active") {
    throw new ValidationError("mfa.credential_inactive", "mfa.credential_inactive");
  }

  if (entry.lockedUntil !== null && entry.lockedUntil > now) {
    return {
      verified: false,
      status: "locked",
      attemptsRemaining: 0,
      lockoutExpiresAt: entry.lockedUntil,
    };
  }
  if (entry.lockedUntil !== null && entry.lockedUntil <= now) {
    entry.lockedUntil = null;
    entry.verificationFailures = 0;
  }

  // For TOTP, verify the code
  const secret = entry.totpSecret;
  const matchedCounter = secret == null ? null : resolveTotpMatch(secret, input.code, now);
  if (matchedCounter == null || entry.usedTotpCounters.has(matchedCounter)) {
    entry.verificationFailures++;

    if (entry.verificationFailures >= DEFAULT_MFA_POLICY.maxVerificationAttempts) {
      entry.lockedUntil = now + DEFAULT_MFA_POLICY.lockoutDurationMs;
      return {
        verified: false,
        status: "locked",
        attemptsRemaining: 0,
        lockoutExpiresAt: entry.lockedUntil,
      };
    }

    return {
      verified: false,
      status: "failed",
      attemptsRemaining: DEFAULT_MFA_POLICY.maxVerificationAttempts - entry.verificationFailures,
      lockoutExpiresAt: null,
    };
  }

  // Success - reset failures and update last used
  entry.verificationFailures = 0;
  entry.usedTotpCounters.add(matchedCounter);
  for (const counter of Array.from(entry.usedTotpCounters)) {
    if (counter < getTotpCounter(now) - 1) {
      entry.usedTotpCounters.delete(counter);
    }
  }
  entry.credential = {
    ...entry.credential,
    lastUsedAt: now,
  };
  verificationChallenges.delete(input.challengeId);

  return {
    verified: true,
    status: "verified",
    attemptsRemaining: DEFAULT_MFA_POLICY.maxVerificationAttempts,
    lockoutExpiresAt: null,
  };
}

export interface MfaVerificationResult {
  readonly verified: boolean;
  readonly status: MfaVerificationStatus;
  readonly attemptsRemaining: number;
  readonly lockoutExpiresAt: number | null;
}

// ============================================================================
// MFA Management
// ============================================================================

/**
 * Disable MFA for a principal (admin action).
 * §48: MFA disable for enterprise SCIM integration.
 */
export function disableMfa(input: { principalId: string; method: MfaMethod }): void {
  pruneExpiredMfaState();
  const credentials = principalCredentials.get(input.principalId);
  if (!credentials) {
    throw new ValidationError("mfa.credential_not_found", "mfa.credential_not_found");
  }

  const entry = credentials.find((e) => e.credential.method === input.method);
  if (!entry) {
    throw new ValidationError("mfa.credential_not_found", "mfa.credential_not_found");
  }

  entry.credential = {
    ...entry.credential,
    status: "disabled",
  };
}

/**
 * Get MFA policy statistics.
 */
export function getMfaStats(): {
  totalEnrollments: number;
  activeCredentials: number;
  lockedAccounts: number;
} {
  let active = 0;
  let locked = 0;
  let total = 0;

  const allEntries = Array.from(principalCredentials.values());
  for (const entries of allEntries) {
    for (const entry of entries) {
      total++;
      if (entry.credential.status === "active") active++;
      if (entry.lockedUntil !== null && entry.lockedUntil > Date.now()) locked++;
    }
  }

  return {
    totalEnrollments: total,
    activeCredentials: active,
    lockedAccounts: locked,
  };
}

export function __dangerousResetMfaStateForTests(): void {
  principalCredentials.clear();
  enrollmentSessions.clear();
  verificationChallenges.clear();
  challengeCreationTimestamps.clear();
}

export function __dangerousExpireEnrollmentSessionForTests(enrollmentId: string): void {
  const stored = enrollmentSessions.get(enrollmentId);
  if (!stored) {
    return;
  }
  enrollmentSessions.set(enrollmentId, {
    ...stored,
    expiresAt: Date.now() - 1,
  });
}

export function __dangerousExpireVerificationChallengeForTests(challengeId: string): void {
  const stored = verificationChallenges.get(challengeId);
  if (!stored) {
    return;
  }
  verificationChallenges.set(challengeId, {
    ...stored,
    expiresAt: Date.now() - 1,
  });
}
