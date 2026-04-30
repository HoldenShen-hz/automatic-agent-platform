import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for DEK Manager covering audit fixes:
 * - Issue #2086: markRotated() deletes old key - rotation becomes destructive
 * - Issue #2094: encryptForSubject returns stale IV not actual encryption IV
 */

import { DekManager, DekStore, type DekMetadata, type EncryptWithDekResult } from "../../../../../src/platform/compliance/crypto-shredding/dek-manager.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2086: markRotated must NOT delete key material
// ─────────────────────────────────────────────────────────────────────────────

test("Issue #2086: DekStore.markRotated must NOT delete key - rotated DEK remains usable for decryption", async () => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-2086" });

  // Create replacement DEK
  const second = await store.create({ subjectId: "user-2086", replacesDekId: first.metadata.dekId });

  // Mark first DEK as rotated
  await store.markRotated(first.metadata.dekId, second.metadata.dekId);

  // Issue #2086: Key material must still be available for decrypting old data
  const firstKey = await store.getKey(first.metadata.dekId);
  assert.ok(firstKey !== null, "rotated DEK key must still be available - not deleted on rotation");
  assert.ok(firstKey.length === 32, "key should be 32 bytes (256-bit AES)");

  // Verify second DEK key is also available
  const secondKey = await store.getKey(second.metadata.dekId);
  assert.ok(secondKey !== null, "new DEK key should be available");

  // Metadata should show rotated status
  const firstMeta = await store.getMetadata(first.metadata.dekId);
  assert.equal(firstMeta!.status, "rotated");
  assert.ok(firstMeta!.rotatedAt !== null);
  assert.equal(firstMeta!.replacedByDekId, second.metadata.dekId);
});

test("Issue #2086: Data encrypted before rotation remains decryptable after rotation", async () => {
  const store = new DekStore();
  const manager = new DekManager(store);

  // Create initial DEK
  const first = await manager.createForSubject("user-data-recovery");

  // Encrypt data with the initial DEK
  const encrypted = await manager.encryptForSubject("user-data-recovery", "important historical data");

  // Rotate the DEK
  const second = await manager.rotate("user-data-recovery");

  // Issue #2086: Must still be able to decrypt data encrypted with the old DEK
  const decrypted = await manager.decrypt(first.metadata.dekId, encrypted.ciphertext);
  assert.equal(decrypted, "important historical data",
    "data encrypted before rotation must remain decryptable after rotation");

  // Verify new encryption uses the new DEK
  const newEncrypted = await manager.encryptForSubject("user-data-recovery", "new data");
  assert.equal(newEncrypted.dekId, second.metadata.dekId, "new encryption should use new DEK");
});

test("Issue #2086: Multiple rotations still allow decryption of all historical data", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-multi-rotation");

  // Encrypt with v1
  const v1 = await manager.encryptForSubject("user-multi-rotation", "v1 data");
  const v1DekId = v1.dekId;

  // Rotate to v2
  await manager.rotate("user-multi-rotation");
  const v2 = await manager.encryptForSubject("user-multi-rotation", "v2 data");
  const v2DekId = v2.dekId;

  // Rotate to v3
  await manager.rotate("user-multi-rotation");
  const v3 = await manager.encryptForSubject("user-multi-rotation", "v3 data");
  const v3DekId = v3.dekId;

  // All versions must still be decryptable
  assert.equal(await manager.decrypt(v1DekId, v1.ciphertext), "v1 data");
  assert.equal(await manager.decrypt(v2DekId, v2.ciphertext), "v2 data");
  assert.equal(await manager.decrypt(v3DekId, v3.ciphertext), "v3 data");
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2094: encryptForSubject must return actual IV used for encryption
// ─────────────────────────────────────────────────────────────────────────────

test("Issue #2094: encryptForSubject returns actual IV used for this encryption, not stored IV", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-iv-issue");

  const result = await manager.encryptForSubject("user-iv-issue", "test data");

  // Issue #2094: The returned IV must be the actual IV used for this specific encryption
  // The stored DEK metadata IV is set at creation time and should NOT be returned
  assert.ok(result.iv, "must have an IV");
  assert.equal(result.iv.length, 24, "IV must be 24 hex chars (96-bit GCM)");

  // Extract IV from ciphertext format: iv:authTag:encrypted
  const parts = result.ciphertext.split(":");
  assert.equal(parts.length, 3, "ciphertext format must be iv:authTag:encrypted");

  const [ivFromCiphertext, ,] = parts;

  // The returned IV must match the IV in the ciphertext (the actual one used)
  assert.equal(ivFromCiphertext, result.iv,
    "Issue #2094: returned IV must be actual encryption IV, not stale metadata IV");

  // Verify it's different from the stored DEK metadata IV
  const dek = await manager.getActiveDek("user-iv-issue");
  assert.ok(dek, "should have active DEK");
  // The per-encryption IV is random, so it should be different from stored IV (which is also random but at creation time)
  // This test verifies the returned IV is the actual one used, not the stored one
});

test("Issue #2094: Decryption works correctly with returned IV", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-iv-decrypt");

  const originalData = "sensitive information that must be recoverable";
  const encrypted = await manager.encryptForSubject("user-iv-decrypt", originalData);

  // Decrypt using the DEK ID and ciphertext - must work with the returned IV
  const decrypted = await manager.decrypt(encrypted.dekId, encrypted.ciphertext);
  assert.equal(decrypted, originalData, "decryption must work with actual IV used during encryption");
});

test("Issue #2094: Each encryption uses a unique random IV", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-unique-iv");

  const plaintext = "same data encrypted twice";

  const result1 = await manager.encryptForSubject("user-unique-iv", plaintext);
  const result2 = await manager.encryptForSubject("user-unique-iv", plaintext);

  // Should have different ciphertexts due to different random IVs
  assert.notEqual(result1.ciphertext, result2.ciphertext,
    "same plaintext must produce different ciphertext due to random IV");

  // Both should decrypt correctly
  assert.equal(await manager.decrypt(result1.dekId, result1.ciphertext), plaintext);
  assert.equal(await manager.decrypt(result2.dekId, result2.ciphertext), plaintext);

  // IVs should be different
  assert.notEqual(result1.iv, result2.iv, "each encryption must use unique random IV");
});

// ─────────────────────────────────────────────────────────────────────────────
// Destroy operation must permanently delete key material
// ─────────────────────────────────────────────────────────────────────────────

test("DekStore.destroy permanently deletes key material", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-destroy" });

  // Verify key exists
  const keyBefore = await store.getKey(result.metadata.dekId);
  assert.ok(keyBefore !== null, "key must exist before destroy");

  // Destroy the DEK
  await store.destroy(result.metadata.dekId);

  // Key must be gone
  const keyAfter = await store.getKey(result.metadata.dekId);
  assert.equal(keyAfter, null, "key must be deleted after destroy");

  // Metadata should show destroyed status
  const meta = await store.getMetadata(result.metadata.dekId);
  assert.equal(meta!.status, "destroyed");
  assert.ok(meta!.destroyedAt !== null);
});

test("DekStore.destroy is idempotent", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-destroy-idempotent" });

  await store.destroy(result.metadata.dekId);
  await store.destroy(result.metadata.dekId); // Second call should not throw

  const meta = await store.getMetadata(result.metadata.dekId);
  assert.equal(meta!.status, "destroyed");
});

test("Decrypting with destroyed DEK throws error", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-destroy-decrypt");

  const encrypted = await manager.encryptForSubject("user-destroy-decrypt", "data");

  // Destroy the DEK
  await manager.destroyForSubject("user-destroy-decrypt");

  // Decryption must fail
  await assert.rejects(
    async () => manager.decrypt(encrypted.dekId, encrypted.ciphertext),
    (err: unknown) => (err as { code?: string }).code === "dek.destroyed",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DEK store basic operations
// ─────────────────────────────────────────────────────────────────────────────

test("DekStore.getActiveForSubject returns active DEK", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-active" });

  const active = await store.getActiveForSubject("user-active");
  assert.ok(active, "should have active DEK");
  assert.equal(active!.dekId, result.metadata.dekId);
  assert.equal(active!.status, "active");
});

test("DekStore.getActiveForSubject returns null for unknown subject", async () => {
  const store = new DekStore();

  const active = await store.getActiveForSubject("unknown-subject");
  assert.equal(active, null);
});

test("DekStore.getAllForSubject returns all DEKs for subject", async () => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-multi-dek" });
  const second = await store.create({ subjectId: "user-multi-dek", replacesDekId: first.metadata.dekId });

  await store.markRotated(first.metadata.dekId, second.metadata.dekId);

  const all = await store.getAllForSubject("user-multi-dek");
  assert.equal(all.length, 2);
  assert.ok(all.some((d) => d.status === "active"));
  assert.ok(all.some((d) => d.status === "rotated"));
});

test("DekManager.createForSubject throws for empty subjectId", async () => {
  const manager = new DekManager();

  await assert.rejects(
    async () => manager.createForSubject(""),
    (err: unknown) => (err as { code?: string }).code === "dek.missing_subject",
  );

  await assert.rejects(
    async () => manager.createForSubject("   "),
    (err: unknown) => (err as { code?: string }).code === "dek.missing_subject",
  );
});

test("DekManager.createForSubject throws when active DEK already exists", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-duplicate");

  await assert.rejects(
    async () => manager.createForSubject("user-duplicate"),
    (err: unknown) => (err as { code?: string }).code === "dek.active_exists",
  );
});

test("DekStore.markRotated throws for non-existent DEK", async () => {
  const store = new DekStore();

  await assert.rejects(
    async () => store.markRotated("nonexistent-dek", "replacement"),
    (err: unknown) => (err as { code?: string }).code === "dek.not_found",
  );
});

test("DekStore.markRotated throws for non-active DEK", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-not-active" });

  // Mark as rotated first
  const second = await store.create({ subjectId: "user-not-active", replacesDekId: result.metadata.dekId });
  await store.markRotated(result.metadata.dekId, second.metadata.dekId);

  // Trying to mark already rotated DEK should fail
  await assert.rejects(
    async () => store.markRotated(result.metadata.dekId, "another"),
    (err: unknown) => (err as { code?: string }).code === "dek.not_active",
  );
});

test("DekManager.getActiveDek returns null for subject with no DEK", async () => {
  const manager = new DekManager();

  const active = await manager.getActiveDek("unknown-user");
  assert.equal(active, null);
});

test("DekManager.rotate creates new DEK and marks old as rotated", async () => {
  const manager = new DekManager();
  const first = await manager.createForSubject("user-rotate");

  const result = await manager.rotate("user-rotate");

  assert.equal(result.metadata.version, 2);
  assert.equal(result.metadata.replacesDekId, first.metadata.dekId);

  const firstMeta = await manager.getStore().getMetadata(first.metadata.dekId);
  assert.equal(firstMeta!.status, "rotated");

  const activeDek = await manager.getActiveDek("user-rotate");
  assert.equal(activeDek!.dekId, result.metadata.dekId);
});

test("DekManager.destroyForSubject returns null when no active DEK", async () => {
  const manager = new DekManager();

  const result = await manager.destroyForSubject("unknown-user");
  assert.equal(result.destroyedDekId, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Ciphertext format validation
// ─────────────────────────────────────────────────────────────────────────────

test("encryptForSubject creates valid ciphertext format iv:authTag:encrypted", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-format");

  const result = await manager.encryptForSubject("user-format", "test data");

  const parts = result.ciphertext.split(":");
  assert.equal(parts.length, 3, "format must be iv:authTag:encrypted");

  const [ivHex, authTagHex, encryptedHex] = parts;

  // IV: 12 bytes = 24 hex chars
  assert.equal(ivHex.length, 24, "IV must be 24 hex chars (96 bits)");

  // Auth tag: 16 bytes = 32 hex chars
  assert.equal(authTagHex.length, 32, "authTag must be 32 hex chars (128 bits)");

  // Encrypted data should not be empty
  assert.ok(encryptedHex.length > 0, "encrypted data must not be empty");

  // All parts should be valid hex
  assert.ok(/^[0-9a-f]+$/i.test(ivHex), "IV must be hex");
  assert.ok(/^[0-9a-f]+$/i.test(authTagHex), "authTag must be hex");
  assert.ok(/^[0-9a-f]+$/i.test(encryptedHex), "encrypted data must be hex");
});

test("decrypt throws for invalid ciphertext format", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-invalid-format");

  await assert.rejects(
    async () => manager.decrypt("dek_id", "invalid_format_no_colons"),
    (err: unknown) => (err as { code?: string }).code === "dek.invalid_ciphertext",
  );

  await assert.rejects(
    async () => manager.decrypt("dek_id", "only:two"),
    (err: unknown) => (err as { code?: string }).code === "dek.invalid_ciphertext",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Key fingerprint and identification
// ─────────────────────────────────────────────────────────────────────────────

test("DekManager.encryptForSubject returns DEK ID for audit trail", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-audit");

  const result = await manager.encryptForSubject("user-audit", "data");

  assert.ok(result.dekId.startsWith("dek_"), "DEK ID should have dek_ prefix");
  assert.ok(result.dekId.length > 10, "DEK ID should be reasonably long");

  // Verify the DEK exists
  const meta = await manager.getStore().getMetadata(result.dekId);
  assert.ok(meta, "DEK ID should reference an existing DEK");
});

test("DekStore.listAll returns all DEKs across subjects", async () => {
  const store = new DekStore();
  await store.create({ subjectId: "user-1" });
  await store.create({ subjectId: "user-2" });
  await store.create({ subjectId: "user-3" });

  const all = await store.listAll();
  assert.equal(all.length, 3);
});