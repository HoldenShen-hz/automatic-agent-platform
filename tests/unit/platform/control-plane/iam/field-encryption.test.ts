import assert from "node:assert/strict";
import test from "node:test";

import { decryptField, encryptField } from "../../../../../src/platform/control-plane/iam/field-encryption.js";

test("field encryption round-trips plaintext", () => {
  const key = "production-encryption-key-strong";
  const ciphertext = encryptField("secret-value", key);
  assert.notEqual(ciphertext, "secret-value");
  assert.match(ciphertext, /^fe1:[0-9a-f]{16}:/);
  assert.equal(decryptField(ciphertext, key), "secret-value");
});

test("field encryption accepts raw 32-byte keys", () => {
  const key = Buffer.alloc(32, 7);
  const ciphertext = encryptField("tenant-secret", key);
  assert.equal(decryptField(ciphertext, key), "tenant-secret");
});

test("field encryption rejects malformed payload", () => {
  assert.throws(() => decryptField("abc", "0123456789abcdef"), /security\.invalid_encrypted_payload/);
});

test("field encryption rejects short passphrases", () => {
  assert.throws(() => encryptField("secret-value", "short-key"), /security\.encryption_key_too_short/);
});

test("field encryption rejects ciphertext encrypted under a different key id", () => {
  const ciphertext = encryptField("secret-value", "0123456789abcdef");
  assert.throws(() => decryptField(ciphertext, "fedcba9876543210"), /security\.encryption_key_mismatch/);
});
