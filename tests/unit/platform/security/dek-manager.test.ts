import assert from "node:assert/strict";
import test from "node:test";

import { DekManager, DekStore, type DekMetadata, type EncryptWithDekResult } from "../../../../src/platform/compliance/crypto-shredding/dek-manager.js";
import { AppError } from "../../../../src/platform/contracts/errors.js";

function assertAppErrorCode(error: unknown, code: string): boolean {
  return error instanceof AppError && error.code === code;
}

test("DekStore.create creates a new DEK", async (t) => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-1" });

  assert.equal(result.metadata.subjectId, "user-1");
  assert.equal(result.metadata.status, "active");
  assert.equal(result.metadata.version, 1);
  assert.ok(Buffer.isBuffer(result.key));
  assert.equal(result.key.length, 32);
});

test("DekStore.create rejects creating a second active DEK without replacesDekId", async (t) => {
  const store = new DekStore();
  await store.create({ subjectId: "user-2" });
  await assert.rejects(
    () => store.create({ subjectId: "user-2" }),
    (error) => assertAppErrorCode(error, "dek.active_exists"),
  );
});

test("DekStore.create allows creating second DEK with explicit replacesDekId", async (t) => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-3" });
  const second = await store.create({ subjectId: "user-3", replacesDekId: first.metadata.dekId });

  assert.equal(second.metadata.version, 2);
  assert.equal(second.metadata.replacesDekId, first.metadata.dekId);
});

test("DekStore.create throws when active DEK exists and replacesDekId differs", async (t) => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-4" });
  await assert.rejects(
    () => store.create({ subjectId: "user-4", replacesDekId: "wrong-id" }),
    (error) => assertAppErrorCode(error, "dek.active_exists"),
  );
});

test("DekStore.getMetadata returns metadata by dekId", async (t) => {
  const store = new DekStore();
  const { metadata } = await store.create({ subjectId: "user-5" });
  const found = await store.getMetadata(metadata.dekId);

  assert.deepEqual(found, metadata);
});

test("DekStore.getMetadata returns null for unknown dekId", async (t) => {
  const store = new DekStore();
  const found = await store.getMetadata("unknown");
  assert.equal(found, null);
});

test("DekStore.getActiveForSubject returns active DEK", async (t) => {
  const store = new DekStore();
  const { metadata } = await store.create({ subjectId: "user-6" });
  const found = await store.getActiveForSubject("user-6");

  assert.deepEqual(found, metadata);
});

test("DekStore.getActiveForSubject returns null when no DEK exists", async (t) => {
  const store = new DekStore();
  const found = await store.getActiveForSubject("unknown-user");
  assert.equal(found, null);
});

test("DekStore.getKey returns key buffer", async (t) => {
  const store = new DekStore();
  const { metadata, key } = await store.create({ subjectId: "user-7" });
  const found = await store.getKey(metadata.dekId);

  assert.ok(Buffer.isBuffer(found));
  assert.deepEqual(found, key);
});

test("DekStore.getKey returns null for unknown DEK", async (t) => {
  const store = new DekStore();
  const found = await store.getKey("unknown");
  assert.equal(found, null);
});

test("DekStore.getKey returns null for destroyed DEK", async (t) => {
  const store = new DekStore();
  const { metadata } = await store.create({ subjectId: "user-8" });
  await store.destroy(metadata.dekId);
  const found = await store.getKey(metadata.dekId);
  assert.equal(found, null);
});

test("DekStore.markRotated updates status and metadata", async (t) => {
  const store = new DekStore();
  const { metadata: old } = await store.create({ subjectId: "user-9" });
  const { metadata: fresh } = await store.create({ subjectId: "user-9", replacesDekId: old.dekId });

  await store.markRotated(old.dekId, fresh.dekId);

  const rotated = await store.getMetadata(old.dekId);
  assert.equal(rotated?.status, "rotated");
  assert.ok(rotated?.rotatedAt);
  assert.equal(rotated?.replacedByDekId, fresh.dekId);

  const newDek = await store.getMetadata(fresh.dekId);
  assert.equal(newDek?.replacesDekId, old.dekId);
});

test("DekStore.markRotated throws when DEK not found", async (t) => {
  const store = new DekStore();
  await assert.rejects(() => store.markRotated("not-found", "replacement"), (error) => assertAppErrorCode(error, "dek.not_found"));
});

test("DekStore.markRotated throws when DEK not active", async (t) => {
  const store = new DekStore();
  const { metadata } = await store.create({ subjectId: "user-10" });
  await store.markRotated(metadata.dekId, "new-id");
  await assert.rejects(() => store.markRotated(metadata.dekId, "new-id-2"), (error) => assertAppErrorCode(error, "dek.not_active"));
});

test("DekStore.destroy marks DEK as destroyed and wipes key", async (t) => {
  const store = new DekStore();
  const { metadata, key } = await store.create({ subjectId: "user-11" });

  await store.destroy(metadata.dekId);

  const found = await store.getMetadata(metadata.dekId);
  assert.equal(found?.status, "destroyed");
  assert.ok(found?.destroyedAt);
  assert.equal(await store.getKey(metadata.dekId), null);
});

test("DekStore.destroy is idempotent", async (t) => {
  await assert.doesNotReject(async () => {
    const store = new DekStore();
    const { metadata } = await store.create({ subjectId: "user-12" });
    await store.destroy(metadata.dekId);
    // Should not throw
    await store.destroy(metadata.dekId);
  });
});

test("DekStore.destroy throws when DEK not found", async (t) => {
  const store = new DekStore();
  await assert.rejects(() => store.destroy("not-found"), (error) => assertAppErrorCode(error, "dek.not_found"));
});

test("DekStore.getAllForSubject returns all DEK versions", async (t) => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-13" });
  await store.create({ subjectId: "user-13", replacesDekId: first.metadata.dekId });
  const all = await store.getAllForSubject("user-13");

  assert.equal(all.length, 2);
});

test("DekStore.listAll returns all DEKs", async (t) => {
  const store = new DekStore();
  await store.create({ subjectId: "user-14" });
  await store.create({ subjectId: "user-15" });
  const all = await store.listAll();

  assert.equal(all.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// DekManager Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DekManager.createForSubject creates DEK for subject", async (t) => {
  const manager = new DekManager();
  const result = await manager.createForSubject("subject-1");

  assert.equal(result.metadata.subjectId, "subject-1");
  assert.equal(result.metadata.status, "active");
});

test("DekManager.createForSubject throws on empty subjectId", async (t) => {
  const manager = new DekManager();
  await assert.rejects(() => manager.createForSubject(""), (error) => error instanceof AppError && error.code === "dek.missing_subject");
  await assert.rejects(() => manager.createForSubject("   "), (error) => error instanceof AppError && error.code === "dek.missing_subject");
});

test("DekManager.getActiveDek returns active DEK", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-2");
  const active = await manager.getActiveDek("subject-2");

  assert.ok(active);
  assert.equal(active?.subjectId, "subject-2");
});

test("DekManager.getActiveDek returns null for unknown subject", async (t) => {
  const manager = new DekManager();
  const active = await manager.getActiveDek("unknown");
  assert.equal(active, null);
});

test("DekManager.rotate creates new DEK and marks old as rotated", async (t) => {
  const manager = new DekManager();
  const first = await manager.createForSubject("subject-3");
  const second = await manager.rotate("subject-3");

  assert.equal(second.metadata.version, 2);
  assert.equal(second.metadata.replacesDekId, first.metadata.dekId);

  const updated = await manager.getActiveDek("subject-3");
  assert.equal(updated?.dekId, second.metadata.dekId);
});

test("DekManager.rotate handles first-time creation (no active DEK)", async (t) => {
  const manager = new DekManager();
  const result = await manager.rotate("new-subject");

  assert.equal(result.metadata.version, 1);
  assert.equal(result.metadata.subjectId, "new-subject");
});

test("DekManager.destroyForSubject destroys active DEK", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-4");
  const { destroyedDekId } = await manager.destroyForSubject("subject-4");
  const active = await manager.getActiveDek("subject-4");

  assert.ok(destroyedDekId);
  assert.equal(active, null);
});

test("DekManager.destroyForSubject returns null when no DEK exists", async (t) => {
  const manager = new DekManager();
  const { destroyedDekId } = await manager.destroyForSubject("unknown-subject");
  assert.equal(destroyedDekId, null);
});

test("DekManager.encryptForSubject encrypts plaintext", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-5");
  const result = await manager.encryptForSubject("subject-5", "secret data");

  assert.ok(result.ciphertext.length > 0);
  assert.ok(result.dekId.length > 0);
  assert.ok(result.iv.length > 0);
  assert.notEqual(result.ciphertext, "secret data");
});

test("DekManager.encryptForSubject throws when no active DEK", async (t) => {
  const manager = new DekManager();
  await assert.rejects(
    () => manager.encryptForSubject("no-dek-subject", "data"),
    (error) => assertAppErrorCode(error, "dek.not_found"),
  );
});

test("DekManager.decrypt decrypts ciphertext", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-6");
  const encrypted = await manager.encryptForSubject("subject-6", "hello world");
  const decrypted = await manager.decrypt(encrypted.dekId, encrypted.ciphertext);

  assert.equal(decrypted, "hello world");
});

test("DekManager.decrypt throws when DEK not found", async (t) => {
  const manager = new DekManager();
  await assert.rejects(
    () => manager.decrypt("unknown-dek", "ciphertext"),
    (error) => assertAppErrorCode(error, "dek.not_found"),
  );
});

test("DekManager.decrypt throws when DEK destroyed", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-7");
  const { destroyedDekId } = await manager.destroyForSubject("subject-7");
  await assert.rejects(
    () => manager.decrypt(destroyedDekId!, "ciphertext"),
    (error) => assertAppErrorCode(error, "dek.destroyed"),
  );
});

test("DekManager.decrypt throws on malformed ciphertext", async (t) => {
  const manager = new DekManager();
  const { metadata } = await manager.createForSubject("subject-8");
  await assert.rejects(
    () => manager.decrypt(metadata.dekId, "not-three-parts"),
    (error) => assertAppErrorCode(error, "dek.invalid_ciphertext"),
  );
});

test("DekManager.getStore exposes underlying store", async (t) => {
  const manager = new DekManager();
  const store = manager.getStore();
  assert.ok(store instanceof DekStore);
});
