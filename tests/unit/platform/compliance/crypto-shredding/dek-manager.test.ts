import assert from "node:assert/strict";
import test from "node:test";

import { DekStore, DekManager, type DekMetadata } from "../../../../../src/platform/compliance/crypto-shredding/dek-manager.js";

test("DekStore.create creates a new DEK for subject", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-123" });

  assert.ok(result.metadata.dekId.startsWith("dek_"), "DEK ID should start with dek_");
  assert.equal(result.metadata.subjectId, "user-123");
  assert.equal(result.metadata.algorithm, "aes-256-gcm");
  assert.equal(result.metadata.version, 1);
  assert.equal(result.metadata.status, "active");
  assert.ok(result.key.length === 32, "Key should be 32 bytes (256 bits)");
});

test("DekStore.create throws when active DEK already exists", async () => {
  const store = new DekStore();
  await store.create({ subjectId: "user-123" });

  await assert.rejects(
    async () => store.create({ subjectId: "user-123" }),
    (err: unknown) => (err as { code: string }).code === "dek.active_exists",
  );
});

test("DekStore.create allows rotation via replacesDekId", async () => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-123" });
  const second = await store.create({ subjectId: "user-123", replacesDekId: first.metadata.dekId });

  assert.equal(second.metadata.version, 2);
  assert.equal(second.metadata.replacesDekId, first.metadata.dekId);
});

test("DekStore.getMetadata returns metadata for existing DEK", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-123" });

  const metadata = await store.getMetadata(result.metadata.dekId);
  assert.ok(metadata !== null);
  assert.equal(metadata!.dekId, result.metadata.dekId);
});

test("DekStore.getMetadata returns null for unknown DEK", async () => {
  const store = new DekStore();
  const metadata = await store.getMetadata("unknown_dek_id");
  assert.equal(metadata, null);
});

test("DekStore.getActiveForSubject returns active DEK", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-123" });

  const active = await store.getActiveForSubject("user-123");
  assert.ok(active !== null);
  assert.equal(active!.dekId, result.metadata.dekId);
});

test("DekStore.getActiveForSubject returns null when no active DEK", async () => {
  const store = new DekStore();
  const active = await store.getActiveForSubject("unknown_user");
  assert.equal(active, null);
});

test("DekStore.getKey returns key for active DEK", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-123" });

  const key = await store.getKey(result.metadata.dekId);
  assert.ok(key !== null);
  assert.ok(key!.length === 32);
});

test("DekStore.getKey returns null for destroyed DEK", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-123" });
  await store.destroy(result.metadata.dekId);

  const key = await store.getKey(result.metadata.dekId);
  assert.equal(key, null);
});

test("DekStore.markRotated updates DEK status", async () => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-123" });
  const second = await store.create({ subjectId: "user-123", replacesDekId: first.metadata.dekId });

  await store.markRotated(first.metadata.dekId, second.metadata.dekId);

  const firstMeta = await store.getMetadata(first.metadata.dekId);
  assert.equal(firstMeta!.status, "rotated");
  assert.ok(firstMeta!.rotatedAt !== null);
  assert.equal(firstMeta!.replacedByDekId, second.metadata.dekId);
});

test("DekStore.markRotated throws for non-existent DEK", async () => {
  const store = new DekStore();

  await assert.rejects(
    async () => store.markRotated("unknown_dek", "some_replacement"),
    (err: unknown) => (err as { code: string }).code === "dek.not_found",
  );
});

test("DekStore.markRotated throws for non-active DEK", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-123" });
  await store.destroy(result.metadata.dekId);

  await assert.rejects(
    async () => store.markRotated(result.metadata.dekId, "replacement"),
    (err: unknown) => (err as { code: string }).code === "dek.not_active",
  );
});

test("DekStore.destroy marks DEK as destroyed", async () => {
  const store = new DekStore();
  const result = await store.create({ subjectId: "user-123" });

  await store.destroy(result.metadata.dekId);

  const metadata = await store.getMetadata(result.metadata.dekId);
  assert.equal(metadata!.status, "destroyed");
  assert.ok(metadata!.destroyedAt !== null);
});

test("DekStore.destroy is idempotent", async () => {
  await assert.doesNotReject(async () => {
    const store = new DekStore();
    const result = await store.create({ subjectId: "user-123" });

    await store.destroy(result.metadata.dekId);
    // Should not throw
    await store.destroy(result.metadata.dekId);
  });
});

test("DekStore.destroy throws for non-existent DEK", async () => {
  const store = new DekStore();

  await assert.rejects(
    async () => store.destroy("unknown_dek"),
    (err: unknown) => (err as { code: string }).code === "dek.not_found",
  );
});

test("DekStore.getAllForSubject returns all DEKs for subject", async () => {
  const store = new DekStore();
  const first = await store.create({ subjectId: "user-123" });
  const second = await store.create({ subjectId: "user-123", replacesDekId: first.metadata.dekId });

  const all = await store.getAllForSubject("user-123");
  assert.equal(all.length, 2);
});

test("DekStore.listAll returns all DEKs", async () => {
  const store = new DekStore();
  await store.create({ subjectId: "user-1" });
  await store.create({ subjectId: "user-2" });

  const all = await store.listAll();
  assert.equal(all.length, 2);
});

test("DekManager.createForSubject creates new DEK", async () => {
  const manager = new DekManager();
  const result = await manager.createForSubject("user-123");

  assert.ok(result.metadata.dekId.startsWith("dek_"));
  assert.equal(result.metadata.subjectId, "user-123");
});

test("DekManager.createForSubject validates subject ID", async () => {
  const manager = new DekManager();

  await assert.rejects(
    async () => manager.createForSubject(""),
    (err: unknown) => (err as { code: string }).code === "dek.missing_subject",
  );

  await assert.rejects(
    async () => manager.createForSubject("   "),
    (err: unknown) => (err as { code: string }).code === "dek.missing_subject",
  );
});

test("DekManager.rotate creates new DEK and marks old as rotated", async () => {
  const manager = new DekManager();
  const first = await manager.createForSubject("user-123");
  const second = await manager.rotate("user-123");

  assert.equal(second.metadata.version, 2);
  assert.equal(second.metadata.replacesDekId, first.metadata.dekId);

  const firstMeta = await manager.getStore().getMetadata(first.metadata.dekId);
  assert.equal(firstMeta!.status, "rotated");
});

test("DekManager.rotate works for subject with no existing DEK", async () => {
  const manager = new DekManager();
  const result = await manager.rotate("new-user");

  assert.equal(result.metadata.version, 1);
  assert.equal(result.metadata.replacesDekId, null);
});

test("DekManager.getActiveDek returns active DEK", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-123");

  const active = await manager.getActiveDek("user-123");
  assert.ok(active !== null);
  assert.equal(active!.subjectId, "user-123");
});

test("DekManager.getActiveDek returns null for unknown subject", async () => {
  const manager = new DekManager();
  const active = await manager.getActiveDek("unknown");
  assert.equal(active, null);
});

test("DekManager.encryptForSubject encrypts data", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-123");

  const result = await manager.encryptForSubject("user-123", "sensitive data");

  assert.ok(result.ciphertext.includes(":"), "Ciphertext should be in iv:tag:data format");
  assert.ok(result.dekId.startsWith("dek_"));
});

test("DekManager.encryptForSubject throws when no DEK exists", async () => {
  const manager = new DekManager();

  await assert.rejects(
    async () => manager.encryptForSubject("unknown-user", "data"),
    (err: unknown) => (err as { code: string }).code === "dek.not_found",
  );
});

test("DekManager.decrypt decrypts encrypted data", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-123");

  const encrypted = await manager.encryptForSubject("user-123", "sensitive data");
  const decrypted = await manager.decrypt(encrypted.dekId, encrypted.ciphertext);

  assert.equal(decrypted, "sensitive data");
});

test("DekManager.decrypt throws for destroyed DEK", async () => {
  const manager = new DekManager();
  const created = await manager.createForSubject("user-123");
  await manager.destroyForSubject("user-123");

  await assert.rejects(
    async () => manager.decrypt(created.metadata.dekId, "some:ciphertext"),
    (err: unknown) => (err as { code: string }).code === "dek.destroyed",
  );
});

test("DekManager.decrypt throws for invalid ciphertext format", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-123");
  const active = await manager.getActiveDek("user-123");

  await assert.rejects(
    async () => manager.decrypt(active!.dekId, "invalid-format"),
    (err: unknown) => (err as { code: string }).code === "dek.invalid_ciphertext",
  );
});

test("DekManager.destroyForSubject destroys active DEK", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user-123");

  const result = await manager.destroyForSubject("user-123");
  assert.ok(result.destroyedDekId !== null);

  const active = await manager.getActiveDek("user-123");
  assert.equal(active, null);
});

test("DekManager.destroyForSubject returns null when no DEK exists", async () => {
  const manager = new DekManager();
  const result = await manager.destroyForSubject("unknown-user");
  assert.equal(result.destroyedDekId, null);
});
