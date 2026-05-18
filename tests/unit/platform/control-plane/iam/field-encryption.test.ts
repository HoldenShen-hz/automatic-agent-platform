import assert from "node:assert/strict";
import test from "node:test";

import { decryptField, encryptField } from "../../../../../src/platform/five-plane-control-plane/iam/field-encryption.js";

test("field encryption round-trips plaintext", () => {
  const key = "production-encryption-key";
  const ciphertext = encryptField("secret-value", key);
  assert.notEqual(ciphertext, "secret-value");
  assert.equal(decryptField(ciphertext, key), "secret-value");
});

test("field encryption accepts raw 32-byte keys", () => {
  const key = Buffer.alloc(32, 7);
  const ciphertext = encryptField("tenant-secret", key);
  assert.equal(decryptField(ciphertext, key), "tenant-secret");
});

test("field encryption rejects malformed payload", () => {
  assert.throws(() => decryptField("abc", "valid-16-byte-key-!!"), /security\.invalid_encrypted_payload/);
});

test("field encryption rejects legacy payloads without version delimiter", () => {
  const legacyPayload = Buffer.from("legacy-ciphertext", "utf8").toString("base64");
  assert.throws(() => decryptField(legacyPayload, "valid-16-byte-key-!!"), /security\.invalid_encrypted_payload/);
});
