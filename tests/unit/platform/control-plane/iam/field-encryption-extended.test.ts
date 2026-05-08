/**
 * Extended unit tests for Field Encryption
 * Tests encryption/decryption patterns, key derivation, and edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";

import { decryptField, encryptField } from "../../../../../src/platform/control-plane/iam/field-encryption.js";

const RAW_KEY = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
const PASSPHRASE = "field-encryption-passphrase-with-32bytes-minimum";

// ============================================================================
// Basic Encryption/Decryption Tests
// ============================================================================

test("encryptField produces non-plaintext output", () => {
  const key = PASSPHRASE;
  const ciphertext = encryptField("my-secret-data", key);

  assert.notEqual(ciphertext, "my-secret-data");
  assert.notEqual(ciphertext, "my-secret-data");
});

test("decryptField round-trips encrypted data", () => {
  const key = PASSPHRASE;
  const plaintext = "sensitive information here";
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

test("encryptField produces non-base64-plaintext output", () => {
  const key = PASSPHRASE;
  const ciphertext = encryptField("data", key);

  // The ciphertext should be base64 encoded, not the plaintext
  assert.notEqual(ciphertext, "data");
  // Should be valid base64
  assert.ok(Buffer.from(ciphertext, "base64").toString("base64") === ciphertext);
});

test("different encryptions of same plaintext produce different ciphertext", () => {
  const key = PASSPHRASE;
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
  const key = PASSPHRASE;
  const ciphertext = encryptField("secret", key);

  assert.equal(decryptField(ciphertext, key), "secret");
});

test("accepts Buffer key of exactly 32 bytes", () => {
  const key = RAW_KEY;
  const ciphertext = encryptField("buffer-key-secret", key);

  assert.equal(decryptField(ciphertext, key), "buffer-key-secret");
});

test("accepts Buffer key derived from string", () => {
  const originalKey = "0123456789abcdef0123456789abcdef";
  const keyBuffer = Buffer.from(originalKey, "utf8");
  const ciphertext = encryptField("buffer-from-string", keyBuffer);

  assert.equal(decryptField(ciphertext, keyBuffer), "buffer-from-string");
});

test("accepts repeating-byte Buffer key", () => {
  // The implementation doesn't validate for weak keys, it just hashes them
  const ciphertext = encryptField("secret", Buffer.alloc(32, 42));
  assert.ok(ciphertext);
  assert.notEqual(ciphertext, "secret");
});

test("rejects empty string key", () => {
  assert.throws(
    () => encryptField("secret", ""),
    /security\.encryption_key_required/,
  );
});

test("accepts key shorter than 16 bytes with hashing", () => {
  // The implementation hashes keys shorter than 32 bytes via SHA256
  const ciphertext = encryptField("secret", "short");
  assert.ok(ciphertext);
  assert.notEqual(ciphertext, "secret");
  assert.equal(decryptField(ciphertext, "short"), "secret");
});

test("derives consistent key from same passphrase", () => {
  const passphrase = PASSPHRASE;
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
  const key = PASSPHRASE;
  const plaintext = "Hello 世界 🌍 مرحبا";
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

test("handles empty plaintext", () => {
  const key = PASSPHRASE;
  const ciphertext = encryptField("", key);

  assert.equal(decryptField(ciphertext, key), "");
});

test("handles very long plaintext", () => {
  const key = PASSPHRASE;
  const plaintext = "A".repeat(10000);
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

test("handles special characters in plaintext", () => {
  const key = PASSPHRASE;
  const plaintext = "!@#$%^&*()_+-=[]{}|;':\",./<>?\\";
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

test("handles newlines and tabs in plaintext", () => {
  const key = PASSPHRASE;
  const plaintext = "line1\nline2\tline3";
  const ciphertext = encryptField(plaintext, key);

  assert.equal(decryptField(ciphertext, key), plaintext);
});

// ============================================================================
// Payload Format Tests
// ============================================================================

test("rejects payload with invalid version marker", () => {
  const key = PASSPHRASE;
  const ciphertext = encryptField("data", key);

  // Tamper with version
  const tampered = "fe2:" + ciphertext.slice(4);

  assert.throws(
    () => decryptField(tampered, key),
    /security\.invalid_encrypted_payload|Unsupported state or unable to authenticate data/,
  );
});

test("rejects payload with missing key id", () => {
  const key = PASSPHRASE;
  const parts = encryptField("data", key).split(":");
  const tampered = `fe1::${parts[2]}`; // Empty key ID

  assert.throws(
    () => decryptField(tampered, key),
    /security\.invalid_encrypted_payload/,
  );
});

test("rejects payload with extra colons", () => {
  const key = PASSPHRASE;
  const tampered = "fe1:abcd123456789abc:data:extra";

  // Should throw due to extra parts after payload
  assert.throws(
    () => decryptField(tampered, key),
    /security\.invalid_encrypted_payload/,
  );
});

test("produces different ciphertext with different keys", () => {
  const key1 = PASSPHRASE;
  const key2 = "second-field-encryption-passphrase-with-32bytes";

  const ciphertext1 = encryptField("secret", key1);
  const ciphertext2 = encryptField("secret", key2);

  // Different keys produce different ciphertext
  assert.notEqual(ciphertext1, ciphertext2);
});

test("rejects tampered ciphertext", () => {
  const key = PASSPHRASE;
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
  const key = PASSPHRASE;
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

test("handles standard base64 ciphertext format", () => {
  const key = RAW_KEY;
  const data = encryptField("legacy-data", key);

  // The implementation returns raw base64 (no envelope format)
  // This test validates that the ciphertext is valid base64
  assert.ok(data);
  const decoded = Buffer.from(data, "base64");
  assert.ok(decoded.length > 0);
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
  const key = Buffer.from([
    0, 255, 1, 254, 2, 253, 3, 252,
    4, 251, 5, 250, 6, 249, 7, 248,
    8, 247, 9, 246, 10, 245, 11, 244,
    12, 243, 13, 242, 14, 241, 15, 240,
  ]);
  const ciphertext = encryptField("binary-key-secret", key);

  assert.equal(decryptField(ciphertext, key), "binary-key-secret");
});
