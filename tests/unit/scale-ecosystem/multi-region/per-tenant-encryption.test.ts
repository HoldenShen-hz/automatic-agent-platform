/**
 * Unit tests for Per-Tenant Encryption Service
 * in src/scale-ecosystem/multi-region/per-tenant-encryption.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  PerTenantEncryptionService,
  deriveTenantKey,
  type EncryptionAlgorithm,
} from "../../../src/scale-ecosystem/multi-region/per-tenant-encryption.js";

function createEncryptionConfig(
  tenantId: string,
  algorithm: EncryptionAlgorithm = "aes-256-gcm",
): {
  tenantId: string;
  algorithm: EncryptionAlgorithm;
  keyRotationPeriodDays: number;
  enforceHardwareSecurityModule: boolean;
} {
  return {
    tenantId,
    algorithm,
    keyRotationPeriodDays: 90,
    enforceHardwareSecurityModule: false,
  };
}

test("PerTenantEncryptionService initializes tenant encryption", () => {
  const service = new PerTenantEncryptionService();
  const config = createEncryptionConfig("tenant-1");

  const key = service.initializeTenant(config);

  assert.equal(key.tenantId, "tenant-1");
  assert.equal(key.algorithm, "aes-256-gcm");
  assert.equal(key.keyVersion, 1);
  assert.equal(key.isActive, true);
});

test("PerTenantEncryptionService encrypts and decrypts data with aes-256-gcm", () => {
  const service = new PerTenantEncryptionService();
  const config = createEncryptionConfig("tenant-1", "aes-256-gcm");
  service.initializeTenant(config);

  const plaintext = "Hello, secure world!";
  const encrypted = service.encrypt("tenant-1", plaintext);

  assert.equal(encrypted.algorithm, "aes-256-gcm");
  assert.ok(encrypted.ciphertext);
  assert.ok(encrypted.iv);
  assert.ok(encrypted.authTag);
  assert.notEqual(encrypted.ciphertext, plaintext);

  const decrypted = service.decryptToString("tenant-1", encrypted);
  assert.equal(decrypted, plaintext);
});

test("PerTenantEncryptionService encrypts and decrypts data with aes-256-cbc", () => {
  const service = new PerTenantEncryptionService();
  const config = createEncryptionConfig("tenant-1", "aes-256-cbc");
  service.initializeTenant(config);

  const plaintext = "CBC encrypted data";
  const encrypted = service.encrypt("tenant-1", plaintext);

  assert.equal(encrypted.algorithm, "aes-256-cbc");
  assert.ok(encrypted.ciphertext);
  assert.ok(encrypted.iv);
  assert.equal(encrypted.authTag, null);

  const decrypted = service.decryptToString("tenant-1", encrypted);
  assert.equal(decrypted, plaintext);
});

test("PerTenantEncryptionService encrypts binary data", () => {
  const service = new PerTenantEncryptionService();
  const config = createEncryptionConfig("tenant-1");
  service.initializeTenant(config);

  const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]);
  const encrypted = service.encrypt("tenant-1", binaryData);

  const decrypted = service.decrypt("tenant-1", encrypted);
  assert.deepEqual(decrypted, binaryData);
});

test("PerTenantEncryptionService rotates keys correctly", () => {
  const service = new PerTenantEncryptionService();
  const config = createEncryptionConfig("tenant-1");
  service.initializeTenant(config);

  const originalKey = service.getActiveKey("tenant-1");
  assert.equal(originalKey?.keyVersion, 1);

  const newKey = service.rotateKey("tenant-1");
  assert.equal(newKey.keyVersion, 2);
  assert.equal(newKey.isActive, true);

  const oldKey = service.getTenantKeys("tenant-1").find((k) => k.keyVersion === 1);
  assert.equal(oldKey?.isActive, false);
});

test("PerTenantEncryptionService throws when encrypting uninitialized tenant", () => {
  const service = new PerTenantEncryptionService();

  assert.throws(
    () => service.encrypt("unknown-tenant", "data"),
    /tenant_encryption.not_initialized/,
  );
});

test("PerTenantEncryptionService throws when decrypting with wrong key", () => {
  const service = new PerTenantEncryptionService();
  const config1 = createEncryptionConfig("tenant-1");
  const config2 = createEncryptionConfig("tenant-2");
  service.initializeTenant(config1);
  service.initializeTenant(config2);

  const encrypted = service.encrypt("tenant-1", "secret");

  // Decrypt with tenant-2's key should fail
  assert.throws(
    () => service.decrypt("tenant-2", encrypted),
    /tenant_encryption.key_not_found/,
  );
});

test("PerTenantEncryptionService isInitialized returns correct state", () => {
  const service = new PerTenantEncryptionService();
  const config = createEncryptionConfig("tenant-1");

  assert.equal(service.isInitialized("tenant-1"), false);

  service.initializeTenant(config);

  assert.equal(service.isInitialized("tenant-1"), true);
  assert.equal(service.isInitialized("tenant-2"), false);
});

test("PerTenantEncryptionService removeTenantKeys cleans up properly", () => {
  const service = new PerTenantEncryptionService();
  const config = createEncryptionConfig("tenant-1");
  service.initializeTenant(config);

  assert.equal(service.isInitialized("tenant-1"), true);

  service.removeTenantKeys("tenant-1");

  assert.equal(service.isInitialized("tenant-1"), false);
  assert.deepEqual(service.getTenantKeys("tenant-1"), []);
});

test("deriveTenantKey produces consistent derived keys", () => {
  const masterKey = Buffer.alloc(32, 0x42);
  const tenantId = "tenant-123";

  const derived1 = deriveTenantKey(masterKey, tenantId, "aes-256-gcm");
  const derived2 = deriveTenantKey(masterKey, tenantId, "aes-256-gcm");

  assert.deepEqual(derived1, derived2);
  assert.equal(derived1.length, 32);
});

test("deriveTenantKey produces different keys for different tenants", () => {
  const masterKey = Buffer.alloc(32, 0x42);

  const derived1 = deriveTenantKey(masterKey, "tenant-1", "aes-256-gcm");
  const derived2 = deriveTenantKey(masterKey, "tenant-2", "aes-256-gcm");

  assert.notDeepEqual(derived1, derived2);
});

test("PerTenantEncryptionService getConfig returns tenant config", () => {
  const service = new PerTenantEncryptionService();
  const config = createEncryptionConfig("tenant-1");

  service.initializeTenant(config);

  const retrievedConfig = service.getConfig("tenant-1");
  assert.ok(retrievedConfig);
  assert.equal(retrievedConfig?.tenantId, "tenant-1");
  assert.equal(retrievedConfig?.algorithm, "aes-256-gcm");
});