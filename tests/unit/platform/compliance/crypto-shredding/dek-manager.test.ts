import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for DEK Manager covering:
 * - Issue #2086: markRotated() deletes old key, already-encrypted data unrecoverable
 * - Issue #2094: encryptForSubject returns stale IV not actual encryption IV
 */

import { DekManager, DekStore, type DekMetadata } from "../../../../../src/platform/compliance/crypto-shredding/dek-manager.js";

test("DekStore.markRotated does NOT delete key material - Issue #2086 fix", async () => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-123" });

  // Create replacement DEK
  const second = await store.create({ subjectId: "user-123", replacesDekId: first.metadata.dekId });

  // Mark first DEK as rotated
  await store.markRotated(first.metadata.dekId, second.metadata.dekId);

  // Issue #2086: Key material should still be available for decrypting old data
  const firstKey = await store.getKey(first.metadata.dekId);
  assert.ok(firstKey !== null, "rotated DEK key should still be available for decryption");
  assert.ok(firstKey.length === 32, "key should be 32 bytes (256 bits)");

  // Second DEK should also have its key
  const secondKey = await store.getKey(second.metadata.dekId);
  assert.ok(secondKey !== null, "new DEK key should be available");

  // Metadata should show rotated status
  const firstMeta = await store.getMetadata(first.metadata.dekId);
  assert.equal(firstMeta!.status, "rotated", "DEK should be marked as rotated");
  assert.ok(firstMeta!.rotatedAt !== null, "rotatedAt should be set");
  assert.equal(firstMeta!.replacedByDekId, second.metadata.dekId, "replacedByDekId should be set");
});

test("DekStore.markRotated allows decryption of data encrypted before rotation - Issue #2086", async () => {
  const store = new DekStore();
  const manager = new DekManager(store);

  // Create initial DEK
  const first = await manager.createForSubject("user-old-data");

  // Encrypt some data with the initial DEK
  const encrypted = await manager.encryptForSubject("user-old-data", "important data");

  // Rotate the DEK
  const second = await manager.rotate("user-old-data");

  // Issue #2086: Should still be able to decrypt data encrypted with the old DEK
  const decrypted = await manager.decrypt(first.metadata.dekId, encrypted.ciphertext);
  assert.equal(decrypted, "important data", "should be able to decrypt data encrypted before rotation");

  // Also verify new encryption uses the new DEK
  const newEncrypted = await manager.encryptForSubject("user-old-data", "new data");
  const newDecrypted = await manager.decrypt(newEncrypted.dekId, newEncrypted.ciphertext);
  assert.equal(newDecrypted, "new data");
});

test("DekStore.destroy permanently deletes key material", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-destroy" });

  // Verify key exists
  const keyBefore = await store.getKey(result.metadata.dekId);
  assert.ok(keyBefore !== null, "key should exist before destroy");

  // Destroy the DEK
  await store.destroy(result.metadata.dekId);

  // Key should be gone
  const keyAfter = await store.getKey(result.metadata.dekId);
  assert.equal(keyAfter, null, "key should be deleted after destroy");

  // Metadata should show destroyed status
  const meta = await store.getMetadata(result.metadata.dekId);
  assert.equal(meta!.status, "destroyed", "DEK should be marked as destroyed");
  assert.ok(meta!.destroyedAt !== null, "destroyedAt should be set");
});

test("DekManager.encryptForSubject returns actual IV used for encryption - Issue #2094 fix", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-iv-test");

  // Encrypt some data
  const result = await manager.encryptForSubject("user-iv-test", "test data");

  // Issue #2094: The returned IV should be the actual IV used for this encryption,
  // not a stale/old IV from the DEK metadata
  assert.ok(result.iv, "should have an IV");

  // The IV should be 24 hex chars (96 bits for GCM)
  assert.equal(result.iv.length, 24, "IV should be 24 hex chars (96-bit)");

  // The IV from metadata is set at creation time and is different from the per-encryption IV
  const dek = await manager.getActiveDek("user-iv-test");
  assert.ok(dek, "should have active DEK");

  // Issue #2094: The returned IV should be the actual encryption IV (random per operation)
  // not the stored DEK metadata IV which is used only for key derivation
  // We can't easily verify it's the "actual" one without decrypting, but we can verify format
  const parts = result.ciphertext.split(":");
  assert.equal(parts.length, 3, "ciphertext format should be iv:authTag:encrypted");

  const [ivFromCiphertext, ,] = parts;
  assert.equal(ivFromCiphertext, result.iv, "IV in ciphertext should match returned IV");
});

test("DekManager can decrypt using IV from encryptForSubject result", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-decrypt-test");

  const originalData = "sensitive information";
  const encrypted = await manager.encryptForSubject("user-decrypt-test", originalData);

  // Decrypt using the DEK ID and ciphertext
  const decrypted = await manager.decrypt(encrypted.dekId, encrypted.ciphertext);
  assert.equal(decrypted, originalData, "should decrypt correctly using returned IV");
});

test("DekManager.encryptForSubject creates unique ciphertext each time (random IV)", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-random-iv");

  const plaintext = "same data";

  // Encrypt the same data twice
  const result1 = await manager.encryptForSubject("user-random-iv", plaintext);
  const result2 = await manager.encryptForSubject("user-random-iv", plaintext);

  // Should have different ciphertexts due to random IV
  assert.notEqual(result1.ciphertext, result2.ciphertext, "same plaintext should produce different ciphertext");

  // But both should decrypt to the same plaintext
  const dec1 = await manager.decrypt(result1.dekId, result1.ciphertext);
  const dec2 = await manager.decrypt(result2.dekId, result2.ciphertext);
  assert.equal(dec1, plaintext, "first encryption should decrypt correctly");
  assert.equal(dec2, plaintext, "second encryption should decrypt correctly");
});

test("DekStore.getAllForSubject returns all DEKs including rotated ones", async () => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-multi-dek" });
  const second = await store.create({ subjectId: "user-multi-dek", replacesDekId: first.metadata.dekId });

  await store.markRotated(first.metadata.dekId, second.metadata.dekId);

  const all = await store.getAllForSubject("user-multi-dek");
  assert.equal(all.length, 2, "should return both DEKs");

  const statuses = all.map((d) => d.status);
  assert.ok(statuses.includes("active"), "should have active DEK");
  assert.ok(statuses.includes("rotated"), "should have rotated DEK");
});

test("DekManager.rotate marks old DEK as rotated, new DEK as active", async () => {
  const manager = new DekManager();
  const first = await manager.createForSubject("user-rotate-test");

  const result = await manager.rotate("user-rotate-test");

  assert.equal(result.metadata.version, 2, "new DEK should have version 2");
  assert.equal(result.metadata.replacesDekId, first.metadata.dekId, "should reference old DEK");

  // Old DEK should be rotated
  const firstMeta = await manager.getStore().getMetadata(first.metadata.dekId);
  assert.equal(firstMeta!.status, "rotated", "old DEK should be rotated");

  // New DEK should be active
  const activeDek = await manager.getActiveDek("user-rotate-test");
  assert.equal(activeDek!.dekId, result.metadata.dekId, "new DEK should be active");
});

test("DekStore.listAll returns all DEKs across all subjects", async () => {
  const store = new DekStore();
  await store.create({ subjectId: "user-1" });
  await store.create({ subjectId: "user-2" });
  await store.create({ subjectId: "user-3" });

  const all = await store.listAll();
  assert.equal(all.length, 3, "should return all DEKs");
});