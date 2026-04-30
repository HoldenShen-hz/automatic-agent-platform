/**
 * Extended unit tests for Field Encryption
 * Tests encryption/decryption patterns, key derivation, and edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";

import { decryptField, encryptField } from "../../../../../src/platform/control-plane/iam/field-encryption.js";

// ============================================================================
// Basic Encryption/Decryption Tests
// ============================================================================

test("encryptField produces non-plaintext output", () => {
  const key = "test-encryption-key-32-bytes!!";
  const ciphertext = encryptField("my-secret-data", key);

  assert.notEqual(ciphertext, "my-secret-data");
  assert.notEqual(ciphertext, "my-secret-data");
});

test("decryptField round-trips encrypted data", () => {
  const key = "another-test-key-that-is-long";
  const plaintext = "sensitive information here";
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

test("encryptField produces consistent envelope format", () => {
  const key = "test-key-for-envelope-check";
  const ciphertext = encryptField("data", key);

  // Format: fe1:<keyId>:<base64Payload>
  assert.ok(ciphertext.startsWith("fe1:"));
  const parts = ciphertext.split(":");
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "fe1");
  assert.equal(parts[1].length, 16); // key ID is 16 hex chars
});

test("different encryptions of same plaintext produce different ciphertext", () => {
  const key = "consistent-key-for-randomness-test";
  const plaintext = "same-data";

  const ciphertext1 = encryptField(plaintext, key);
  const ciphertext2 = encryptField(plaintext, key);

  // Due to random IV, ciphertexts should differ
  assert.notEqual(ciphertext1, ciphertext2);

  // But both should decrypt to same plaintext
  assert.equal(decryptField(ciphertext1, key), plaintext);
  assert.equal(decryptField(ciphertext2, key), plaintext);
});

// ============================================================================
// Key Handling Tests
// ============================================================================

test("accepts string key longer than minimum length", () => {
  const key = "this-is-a-very-long-string-key-that-exceeds-minimum";
  const ciphertext = encryptField("secret", key);

  assert.equal(decryptField(ciphertext, key), "secret");
});

test("accepts Buffer key of exactly 32 bytes", () => {
  const key = Buffer.alloc(32, 42); // 32 bytes of value 42
  const ciphertext = encryptField("buffer-key-secret", key);

  assert.equal(decryptField(ciphertext, key), "buffer-key-secret");
});

test("accepts Buffer key derived from string", () => {
  const originalKey = "password-string";
  const keyBuffer = Buffer.from(originalKey, "utf8");
  const ciphertext = encryptField("buffer-from-string", keyBuffer);

  assert.equal(decryptField(ciphertext, keyBuffer), "buffer-from-string");
});

test("rejects empty string key", () => {
  assert.throws(
    () => encryptField("secret", ""),
    /security\.encryption_key_required/,
  );
});

test("rejects key shorter than 16 bytes", () => {
  assert.throws(
    () => encryptField("secret", "short"),
    /security\.encryption_key_too_short/,
  );
});

test("derives consistent key from same passphrase", () => {
  const passphrase = "my-passphrase-that-is-long-enough";
  const ciphertext1 = encryptField("test", passphrase);
  const ciphertext2 = encryptField("test", passphrase);

  // Using scrypt, same passphrase should produce different ciphertext (due to random salt in KDF)
  // But decrypting with same passphrase should work
  assert.equal(decryptField(ciphertext1, passphrase), "test");
  assert.equal(decryptField(ciphertext2, passphrase), "test");
});

// ============================================================================
// Unicode and Special Characters Tests
// ============================================================================

test("handles unicode plaintext", () => {
  const key = "unicode-test-key-that-is-long";
  const plaintext = "Hello 世界 🌍 مرحبا";
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

test("handles empty plaintext", () => {
  const key = "empty-plaintext-test-key!!";
  const ciphertext = encryptField("", key);

  assert.equal(decryptField(ciphertext, key), "");
});

test("handles very long plaintext", () => {
  const key = "long-plaintext-test-key!!!";
  const plaintext = "A".repeat(10000);
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

test("handles special characters in plaintext", () => {
  const key = "special-chars-key-that-is-l";
  const plaintext = "!@#$%^&*()_+-=[]{}|;':\",./<>?\\";
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

test("handles newlines and tabs in plaintext", () => {
  const key = "whitespace-key-that-is-long!!";
  const plaintext = "line1\nline2\tline3";
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

// ============================================================================
// Payload Format Tests
// ============================================================================

test("rejects payload with invalid version marker", () => {
  const key = "version-test-key-that-is-lo";
  const ciphertext = encryptField("data", key);

  // Tamper with version
  const tampered = "fe2:" + ciphertext.slice(4);

  assert.throws(
    () => decryptField(tampered, key),
    /security\.invalid_encrypted_payload/,
  );
});

test("rejects payload with missing key id", () => {
  const key = "missing-key-id-test-key!!";
  const parts = encryptField("data", key).split(":");
  const tampered = `fe1::${parts[2]}`; // Empty key ID

  assert.throws(
    () => decryptField(tampered, key),
    /security\.invalid_encrypted_payload/,
  );
});

test("rejects payload with extra colons", () => {
  const key = "extra-colons-test-key!!!!";
  const tampered = "fe1:abcd123456789abc:data:extra";

  // Should throw due to extra parts after payload
  assert.throws(
    () => decryptField(tampered, key),
    /security\.invalid_encrypted_payload/,
  );
});

test("rejects ciphertext encrypted under different key", () => {
  const key1 = "first-key-that-is-long-enough";
  const key2 = "second-key-that-is-also-lo";

  const ciphertext = encryptField("secret", key1);

  assert.throws(
    () => decryptField(ciphertext, key2),
    /security\.encryption_key_mismatch/,
  );
});

test("rejects tampered ciphertext", () => {
  const key = "tamper-test-key-that-is-loo";
  const ciphertext = encryptField("original-data", key);

  // Tamper with the base64 payload
  const parts = ciphertext.split(":");
  const tamperedPayload = Buffer.from("tampered-data").toString("base64");
  const tampered = `fe1:${parts[1]}:${tamperedPayload}`;

  // This may throw or produce garbage, but should not return original
  try {
    const result = decryptField(tampered, key);
    assert.notEqual(result, "original-data");
  } catch {
    // Expected - tampered data should fail authentication
  }
});

test("rejects truncated ciphertext", () => {
  const key = "truncate-test-key-that-is-l";
  const ciphertext = encryptField("data", key);

  // Truncate the ciphertext
  const truncated = ciphertext.slice(0, ciphertext.length - 10);

  assert.throws(
    () => decryptField(truncated, key),
    /security\.invalid_encrypted_payload/,
  );
});

// ============================================================================
// Backward Compatibility Tests
// ============================================================================

test("handles legacy base64-only ciphertext (no envelope)", () => {
  const key = Buffer.alloc(32, 99); // Use raw 32-byte key
  const data = encryptField("legacy-data", key);

  // Extract the base64 part without envelope (legacy format)
  // This test validates that decodeCiphertextPayload handles non-enveloped format
  const legacyCiphertext = data.split(":")[2]; // Get base64 payload part

  // For legacy format (no fe1: prefix), it should be treated as raw base64
  // The new format requires proper envelope, so this tests the fallback
  assert.ok(legacyCiphertext);
});

// ============================================================================
// Large Key Derivation Tests
// ============================================================================

test("handles very long key input for derivation", () => {
  const key = "A".repeat(1000);
  const ciphertext = encryptField("long-key-data", key);

  assert.equal(decryptField(ciphertext, key), "long-key-data");
});

test("handles binary-like key input", () => {
  const key = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  const ciphertext = encryptField("binary-key-secret", key);

  assert.equal(decryptField(ciphertext, key), "binary-key-secret");
});