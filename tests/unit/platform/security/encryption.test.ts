import assert from "node:assert/strict";
import test from "node:test";

import { encryptField, decryptField, loadFieldEncryptionKeyFromEnv } from "../../../../src/platform/five-plane-control-plane/iam/field-encryption.js";

const TEST_KEY = "this-is-a-very-long-test-encryption-key-32bytes!";

test("encryptField produces base64-encoded envelope with fe1 prefix", (t) => {
  const ciphertext = encryptField("hello world", TEST_KEY);
  assert.match(ciphertext, /^fe1:/);
  const payload = ciphertext.slice(4);
  // Valid base64
  const decoded = Buffer.from(payload, "base64");
  // Salt(16) + IV(12) + Tag(16) + some ciphertext
  assert.ok(decoded.length >= 44);
});

test("decryptField returns original plaintext", (t) => {
  const plaintext = "secret message";
  const ciphertext = encryptField(plaintext, TEST_KEY);
  const decrypted = decryptField(ciphertext, TEST_KEY);
  assert.equal(decrypted, plaintext);
});

test("decryptField throws on wrong key", (t) => {
  const ciphertext = encryptField("data", TEST_KEY);
  assert.throws(() => decryptField(ciphertext, "wrong-key-that-is-long-enough!!"), /security/);
});

test("decryptField throws on tampered ciphertext", (t) => {
  const ciphertext = encryptField("data", TEST_KEY);
  const tampered = ciphertext.slice(0, -2) + "XX";
  assert.throws(() => decryptField(tampered, TEST_KEY), /security/);
});

test("encryptField and decryptField handle empty string", (t) => {
  const ciphertext = encryptField("", TEST_KEY);
  const decrypted = decryptField(ciphertext, TEST_KEY);
  assert.equal(decrypted, "");
});

test("encryptField and decryptField handle unicode", (t) => {
  const plaintext = "你好世界 🌍 αβγδ";
  const ciphertext = encryptField(plaintext, TEST_KEY);
  const decrypted = decryptField(ciphertext, TEST_KEY);
  assert.equal(decrypted, plaintext);
});

test("encryptField and decryptField handle long strings", (t) => {
  const plaintext = "A".repeat(10000);
  const ciphertext = encryptField(plaintext, TEST_KEY);
  const decrypted = decryptField(ciphertext, TEST_KEY);
  assert.equal(decrypted, plaintext);
});

test("encryptField produces different ciphertext each time (random IV)", (t) => {
  const c1 = encryptField("same data", TEST_KEY);
  const c2 = encryptField("same data", TEST_KEY);
  assert.notEqual(c1, c2);
  assert.equal(decryptField(c1, TEST_KEY), decryptField(c2, TEST_KEY));
});

test("decryptField throws on malformed envelope", (t) => {
  assert.throws(() => decryptField("not-formatted", TEST_KEY), /security/);
  assert.throws(() => decryptField("fe1", TEST_KEY), /security/);
  assert.throws(() => decryptField("fe1:", TEST_KEY), /security/);
  assert.throws(() => decryptField("wrong:" + Buffer.from("short").toString("base64"), TEST_KEY), /security/);
});

test("loadFieldEncryptionKeyFromEnv throws when key missing", (t) => {
  assert.throws(() => loadFieldEncryptionKeyFromEnv({}), /field_encryption_key_required/);
  assert.throws(() => loadFieldEncryptionKeyFromEnv({ AA_FIELD_ENCRYPTION_KEY: "" }), /field_encryption_key_required/);
  assert.throws(() => loadFieldEncryptionKeyFromEnv({ AA_FIELD_ENCRYPTION_KEY: "   " }), /field_encryption_key_required/);
});

test("loadFieldEncryptionKeyFromEnv accepts valid key", (t) => {
  const key = loadFieldEncryptionKeyFromEnv({ AA_FIELD_ENCRYPTION_KEY: TEST_KEY });
  assert.ok(Buffer.isBuffer(key));
});

test("loadFieldEncryptionKeyFromEnv rejects keys that are too short", (t) => {
  assert.throws(() => loadFieldEncryptionKeyFromEnv({ AA_FIELD_ENCRYPTION_KEY: "short" }), /encryption_key_too_weak/);
});

test("encryptField throws when key is too short (string)", (t) => {
  assert.throws(() => encryptField("data", "short"), /encryption_key_too_weak/);
});

test("encryptField and decryptField work with Buffer key (32 bytes)", (t) => {
  const keyBuf = Buffer.alloc(32).fill("k");
  const plaintext = "buffer key test";
  const ciphertext = encryptField(plaintext, keyBuf);
  const decrypted = decryptField(ciphertext, keyBuf);
  assert.equal(decrypted, plaintext);
});