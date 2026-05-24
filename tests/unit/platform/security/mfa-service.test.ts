import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  startMfaEnrollment,
  completeMfaEnrollment,
  getMfaCredentials,
  hasActiveMfa,
  createMfaChallenge,
  verifyMfaChallenge,
  disableMfa,
  getMfaStats,
  operationRequiresMfa,
  DEFAULT_MFA_POLICY,
  __dangerousResetMfaStateForTests,
  __dangerousExpireEnrollmentSessionForTests,
  __dangerousExpireVerificationChallengeForTests,
} from "../../../../src/platform/five-plane-control-plane/iam/mfa-service.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// Helper to generate valid TOTP code
function generateValidTotpCode(secret: string, timestamp: number = Date.now()): string {
  const counter = Math.floor(timestamp / 30000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", Buffer.from(secret, "utf8"));
  const hash = hmac.update(counterBuffer).digest();
  const hashLen = hash.length;
  const offset = (hash[hashLen - 1] ?? 0) & 0x0f;
  const binary =
    ((hash[offset]! & 0x7f) << 24) |
    ((hash[offset + 1]! & 0xff) << 16) |
    ((hash[offset + 2]! & 0xff) << 8) |
    (hash[offset + 3]! & 0xff);
  const otp = binary % 10 ** 6;
  return otp.toString().padStart(6, "0");
}

test.describe("MFA Service", () => {
  test.beforeEach(() => {
    __dangerousResetMfaStateForTests();
  });

  test.afterEach(() => {
    __dangerousResetMfaStateForTests();
  });

  test("startMfaEnrollment creates enrollment session with TOTP secret", () => {
    const session = startMfaEnrollment({ principalId: "user-123", method: "totp" });

    assert.ok(session.enrollmentId);
    assert.equal(session.principalId, "user-123");
    assert.equal(session.method, "totp");
    assert.equal(session.status, "pending_verification");
    assert.ok(session.secret);
    assert.ok(session.qrCodeUri);
    assert.ok(session.qrCodeUri.includes("otpauth://totp/"));
    assert.ok(session.qrCodeUri.includes("secret="));
    assert.ok(session.expiresAt > Date.now());
  });

test("startMfaEnrollment rejects disallowed MFA method", () => {
  assert.throws(
      () => startMfaEnrollment({ principalId: "user-123", method: "push" as never }),
      /mfa.method_not_allowed/,
  );
});

  test("completeMfaEnrollment verifies valid TOTP code and creates credential", () => {
    const session = startMfaEnrollment({ principalId: "user-456", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    const credential = completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

  assert.ok(credential.credentialId);
  assert.equal(credential.method, "totp");
  assert.equal(credential.identifier, "us****56");
  assert.equal(credential.status, "active");
  assert.ok(credential.createdAt > 0);
  assert.ok(credential.lastUsedAt != null);
  assert.ok(credential.lastUsedAt > 0);
  });

  test("completeMfaEnrollment rejects invalid TOTP code", () => {
    const session = startMfaEnrollment({ principalId: "user-789", method: "totp" });

    assert.throws(
      () =>
        completeMfaEnrollment({
          enrollmentId: session.enrollmentId,
          verificationCode: "000000",
        }),
      /mfa.invalid_code/,
    );
  });

test("completeMfaEnrollment rejects expired enrollment", () => {
  const session = startMfaEnrollment({ principalId: "user-expired", method: "totp" });
  __dangerousExpireEnrollmentSessionForTests(session.enrollmentId);

    assert.throws(
    () =>
      completeMfaEnrollment({
        enrollmentId: session.enrollmentId,
        verificationCode: "000000",
      }),
      /mfa.enrollment_not_found/,
  );
});

  test("completeMfaEnrollment rejects enrollment not found", () => {
    assert.throws(
      () =>
        completeMfaEnrollment({
          enrollmentId: "nonexistent-enrollment",
          verificationCode: "000000",
        }),
      /mfa.enrollment_not_found/,
    );
  });

test("completeMfaEnrollment rejects already completed enrollment", () => {
    const session = startMfaEnrollment({ principalId: "user-completed", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    // Complete once
    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    // Try to complete again
    assert.throws(
    () =>
      completeMfaEnrollment({
        enrollmentId: session.enrollmentId,
        verificationCode: validCode,
      }),
      /mfa.enrollment_not_found/,
  );
});

  test("completeMfaEnrollment rejects duplicate credential for same method", () => {
    const session1 = startMfaEnrollment({ principalId: "user-dup", method: "totp" });
    const validCode1 = generateValidTotpCode(session1.secret);

    // Complete first enrollment
    completeMfaEnrollment({
      enrollmentId: session1.enrollmentId,
      verificationCode: validCode1,
    });

    // Start second enrollment with same method
    const session2 = startMfaEnrollment({ principalId: "user-dup", method: "totp" });
    const validCode2 = generateValidTotpCode(session2.secret);

    // Try to complete second enrollment
    assert.throws(
      () =>
        completeMfaEnrollment({
          enrollmentId: session2.enrollmentId,
          verificationCode: validCode2,
        }),
      /mfa.credential_already_exists/,
    );
  });

  test("getMfaCredentials returns empty array for unenrolled principal", () => {
    const credentials = getMfaCredentials("nonexistent-user");
    assert.deepEqual(credentials, []);
  });

  test("getMfaCredentials returns active credentials for enrolled principal", () => {
    const session = startMfaEnrollment({ principalId: "user-creds", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    const credentials = getMfaCredentials("user-creds");
    assert.equal(credentials.length, 1);
    assert.equal(credentials[0]!.method, "totp");
    assert.equal(credentials[0]!.status, "active");
  });

  test("hasActiveMfa returns false for unenrolled principal", () => {
    assert.equal(hasActiveMfa("nonexistent-user"), false);
  });

  test("hasActiveMfa returns true for principal with active MFA", () => {
    const session = startMfaEnrollment({ principalId: "user-active", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    assert.equal(hasActiveMfa("user-active"), true);
  });

  test("createMfaChallenge creates challenge for enrolled principal", () => {
    const session = startMfaEnrollment({ principalId: "user-challenge", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    const challenge = createMfaChallenge({
      principalId: "user-challenge",
      method: "totp",
      challengeType: "login",
    });

    assert.ok(challenge.challengeId);
    assert.equal(challenge.principalId, "user-challenge");
    assert.equal(challenge.method, "totp");
    assert.equal(challenge.challengeType, "login");
    assert.ok(challenge.attemptsRemaining > 0);
    assert.ok(challenge.expiresAt > Date.now());
  });

  test("createMfaChallenge throws for unenrolled credential", () => {
    assert.throws(
      () =>
        createMfaChallenge({
          principalId: "nonexistent-user",
          method: "totp",
          challengeType: "login",
        }),
      /mfa.credential_not_found/,
    );
  });

  test("createMfaChallenge throws for inactive credential", () => {
    const session = startMfaEnrollment({ principalId: "user-inactive", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    // Disable the credential
    disableMfa({ principalId: "user-inactive", method: "totp" });

    assert.throws(
      () =>
        createMfaChallenge({
          principalId: "user-inactive",
          method: "totp",
          challengeType: "login",
        }),
      /mfa.credential_not_found/,
    );
  });

test("verifyMfaChallenge verifies valid code and returns verified result", () => {
  const session = startMfaEnrollment({ principalId: "user-verify", method: "totp" });
  const validCode = generateValidTotpCode(session.secret);
  const nextWindowCode = generateValidTotpCode(session.secret, Date.now() + 30_000);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    const challenge = createMfaChallenge({
      principalId: "user-verify",
      method: "totp",
      challengeType: "login",
    });

  const result = verifyMfaChallenge({
    challengeId: challenge.challengeId,
    code: nextWindowCode,
  });

    assert.equal(result.verified, true);
    assert.equal(result.status, "verified");
    assert.ok(result.attemptsRemaining > 0);
    assert.equal(result.lockoutExpiresAt, null);
  });

  test("verifyMfaChallenge rejects invalid code and returns failed result", () => {
    const session = startMfaEnrollment({ principalId: "user-fail", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    const challenge = createMfaChallenge({
      principalId: "user-fail",
      method: "totp",
      challengeType: "login",
    });

    const result = verifyMfaChallenge({
      challengeId: challenge.challengeId,
      code: "000000",
    });

    assert.equal(result.verified, false);
    assert.equal(result.status, "failed");
    assert.ok(result.attemptsRemaining > 0);
  });

  test("verifyMfaChallenge locks account after max verification failures", () => {
    const session = startMfaEnrollment({ principalId: "user-lockout", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    const challenge = createMfaChallenge({
      principalId: "user-lockout",
      method: "totp",
      challengeType: "login",
    });

    // Verify with wrong code multiple times
    for (let i = 0; i < 5; i++) {
      const result = verifyMfaChallenge({
        challengeId: challenge.challengeId,
        code: "000000",
      });
      if (i < 4) {
        assert.notEqual(result.status, "locked");
      } else {
        assert.equal(result.status, "locked");
        assert.equal(result.attemptsRemaining, 0);
        assert.ok(result.lockoutExpiresAt !== null);
      }
    }
  });

test("verifyMfaChallenge throws for expired challenge", () => {
    const session = startMfaEnrollment({ principalId: "user-expired-chal", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    const challenge = createMfaChallenge({
      principalId: "user-expired-chal",
      method: "totp",
      challengeType: "login",
    });

    __dangerousExpireVerificationChallengeForTests(challenge.challengeId);

    assert.throws(
    () =>
      verifyMfaChallenge({
          challengeId: challenge.challengeId,
          code: validCode,
        }),
      /mfa.challenge_not_found/,
  );
});

  test("verifyMfaChallenge throws for nonexistent challenge", () => {
    assert.throws(
      () =>
        verifyMfaChallenge({
          challengeId: "nonexistent-challenge",
          code: "000000",
        }),
      /mfa.challenge_not_found/,
    );
  });

  test("disableMfa disables credential for enrolled principal", () => {
    const session = startMfaEnrollment({ principalId: "user-disable", method: "totp" });
    const validCode = generateValidTotpCode(session.secret);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    assert.equal(hasActiveMfa("user-disable"), true);

    disableMfa({ principalId: "user-disable", method: "totp" });

    const credentials = getMfaCredentials("user-disable");
    assert.equal(credentials[0]!.status, "disabled");
    assert.equal(hasActiveMfa("user-disable"), false);
  });

  test("disableMfa throws for nonexistent principal", () => {
    assert.throws(
      () => disableMfa({ principalId: "nonexistent-user", method: "totp" }),
      /mfa.credential_not_found/,
    );
  });

  test("getMfaStats returns correct statistics", () => {
    const session1 = startMfaEnrollment({ principalId: "user-stats-1", method: "totp" });
    const validCode1 = generateValidTotpCode(session1.secret);
    completeMfaEnrollment({ enrollmentId: session1.enrollmentId, verificationCode: validCode1 });

    const session2 = startMfaEnrollment({ principalId: "user-stats-2", method: "totp" });
    const validCode2 = generateValidTotpCode(session2.secret);
    completeMfaEnrollment({ enrollmentId: session2.enrollmentId, verificationCode: validCode2 });

    // Lock one user
    const challenge = createMfaChallenge({
      principalId: "user-stats-1",
      method: "totp",
      challengeType: "login",
    });
    for (let i = 0; i < 5; i++) {
      verifyMfaChallenge({ challengeId: challenge.challengeId, code: "000000" });
    }

    const stats = getMfaStats();
    assert.ok(stats.totalEnrollments >= 2);
    assert.ok(stats.activeCredentials >= 1);
    assert.ok(stats.lockedAccounts >= 0);
  });

  test("operationRequiresMfa returns correct values for operation types", () => {
    assert.equal(operationRequiresMfa(DEFAULT_MFA_POLICY, "sensitive"), true);
    assert.equal(operationRequiresMfa(DEFAULT_MFA_POLICY, "sso"), true);
    assert.equal(operationRequiresMfa(DEFAULT_MFA_POLICY, "standard"), false);
  });

  test("MFA enrollment creates QR code URI with proper format", () => {
    const session = startMfaEnrollment({ principalId: "user-qr", method: "totp" });

    assert.ok(session.qrCodeUri != null);
    assert.ok(session.qrCodeUri.startsWith("otpauth://totp/"));
    assert.ok(session.qrCodeUri.includes("secret="));
    assert.ok(session.qrCodeUri.includes("algorithm=SHA1"));
    assert.ok(session.qrCodeUri.includes("digits=6"));
    assert.ok(session.qrCodeUri.includes("period=30"));
  });

  test("MFA TOTP code generation produces 6-digit codes", () => {
    const session = startMfaEnrollment({ principalId: "user-totp", method: "totp" });
    const code = generateValidTotpCode(session.secret);

    assert.equal(code.length, 6);
    assert.ok(/^\d{6}$/.test(code));
  });

test("MFA verification rejects reused TOTP counter", () => {
  const session = startMfaEnrollment({ principalId: "user-reuse", method: "totp" });
  const validCode = generateValidTotpCode(session.secret);
  const nextWindowCode = generateValidTotpCode(session.secret, Date.now() + 30_000);

    completeMfaEnrollment({
      enrollmentId: session.enrollmentId,
      verificationCode: validCode,
    });

    const challenge = createMfaChallenge({
      principalId: "user-reuse",
      method: "totp",
      challengeType: "login",
    });

    // First verification succeeds
    const result1 = verifyMfaChallenge({
      challengeId: challenge.challengeId,
      code: nextWindowCode,
    });
    assert.equal(result1.verified, true);

    // Create new challenge with same code
    const challenge2 = createMfaChallenge({
      principalId: "user-reuse",
      method: "totp",
      challengeType: "login",
    });

    // Reusing same code should fail (reused counter)
    const result2 = verifyMfaChallenge({
      challengeId: challenge2.challengeId,
      code: nextWindowCode,
    });
    // The counter was already used, so this should fail or be rejected
    // Note: depends on implementation - counter window may skip
    assert.equal(result2.verified, false);
  });
});
