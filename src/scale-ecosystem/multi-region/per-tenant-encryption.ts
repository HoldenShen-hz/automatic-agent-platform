/**
 * Per-Tenant Static Encryption Service
 *
 * Implements static encryption for tenant data at rest.
 * Each tenant has isolated encryption keys to ensure data separation.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §52
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encryption algorithm
 */
export type EncryptionAlgorithm = "aes-256-gcm" | "aes-256-cbc" | "aes-128-gcm";

/**
 * Tenant encryption key metadata
 */
export interface TenantEncryptionKey {
  readonly keyId: string;
  readonly tenantId: string;
  readonly algorithm: EncryptionAlgorithm;
  readonly keyVersion: number;
  readonly createdAt: string;
  readonly isActive: boolean;
}

/**
 * Encrypted data record
 */
export interface EncryptedRecord {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string | null;
  readonly keyId: string;
  readonly algorithm: EncryptionAlgorithm;
}

/**
 * Tenant encryption configuration
 */
export interface PerTenantEncryptionConfig {
  readonly tenantId: string;
  readonly algorithm: EncryptionAlgorithm;
  readonly keyRotationPeriodDays: number;
  readonly enforceHardwareSecurityModule: boolean;
}

/**
 * Per-Tenant Static Encryption Service
 */
export class PerTenantEncryptionService {
  private readonly tenantKeys = new Map<string, TenantEncryptionKey[]>();
  private readonly tenantConfigs = new Map<string, PerTenantEncryptionConfig>();
  private readonly keyStorage = new Map<string, Buffer>();

  /**
   * Initialize encryption for a tenant
   */
  public initializeTenant(config: PerTenantEncryptionConfig): TenantEncryptionKey {
    const keyId = `key:${config.tenantId}:v1`;
    const key = this.generateKey(config.algorithm);

    const encryptionKey: TenantEncryptionKey = {
      keyId,
      tenantId: config.tenantId,
      algorithm: config.algorithm,
      keyVersion: 1,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    // Store key (in production, this would use HSM or KMS)
    this.keyStorage.set(keyId, key);

    // Store metadata
    const keys = this.tenantKeys.get(config.tenantId) ?? [];
    keys.push(encryptionKey);
    this.tenantKeys.set(config.tenantId, keys);

    this.tenantConfigs.set(config.tenantId, config);

    return encryptionKey;
  }

  /**
   * Encrypt data for a tenant
   */
  public encrypt(
    tenantId: string,
    plaintext: string | Buffer,
  ): EncryptedRecord {
    const keyInfo = this.getActiveKey(tenantId);
    if (!keyInfo) {
      throw new Error(`tenant_encryption.not_initialized:${tenantId}`);
    }

    const key = this.keyStorage.get(keyInfo.keyId);
    if (!key) {
      throw new Error(`tenant_encryption.key_not_found:${keyInfo.keyId}`);
    }

    const iv = randomBytes(this.getIvLength(keyInfo.algorithm));
    const plaintextBuffer = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;

    if (keyInfo.algorithm === "aes-256-gcm") {
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return {
        ciphertext: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        keyId: keyInfo.keyId,
        algorithm: keyInfo.algorithm,
      };
    } else {
      // aes-256-cbc
      const cipher = createCipheriv("aes-256-cbc", key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);

      return {
        ciphertext: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        authTag: null,
        keyId: keyInfo.keyId,
        algorithm: keyInfo.algorithm,
      };
    }
  }

  /**
   * Decrypt data for a tenant
   */
  public decrypt(tenantId: string, record: EncryptedRecord): Buffer {
    const tenantKey = this.getTenantKeys(tenantId).find((keyInfo) => keyInfo.keyId === record.keyId);
    if (!tenantKey) {
      throw new Error(`tenant_encryption.key_not_found:${record.keyId}`);
    }

    const key = this.keyStorage.get(record.keyId);
    if (!key) {
      throw new Error(`tenant_encryption.key_not_found:${record.keyId}`);
    }

    const iv = Buffer.from(record.iv, "base64");
    const ciphertext = Buffer.from(record.ciphertext, "base64");

    if (record.algorithm === "aes-256-gcm") {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      if (record.authTag) {
        decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
      }
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } else {
      // aes-256-cbc
      const decipher = createDecipheriv("aes-256-cbc", key, iv);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }
  }

  /**
   * Decrypt data and return as string
   */
  public decryptToString(tenantId: string, record: EncryptedRecord): string {
    return this.decrypt(tenantId, record).toString("utf8");
  }

  /**
   * Rotate encryption key for a tenant
   */
  public rotateKey(tenantId: string): TenantEncryptionKey {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      throw new Error(`tenant_encryption.not_initialized:${tenantId}`);
    }

    const currentKeys = this.tenantKeys.get(tenantId) ?? [];
    const latestVersion = currentKeys.reduce((max, k) => Math.max(max, k.keyVersion), 0);

    // Mark old key as inactive
    for (const key of currentKeys) {
      if (key.isActive) {
        const updated: TenantEncryptionKey = { ...key, isActive: false };
        const idx = currentKeys.indexOf(key);
        currentKeys[idx] = updated;
      }
    }

    // Generate new key
    const keyId = `key:${tenantId}:v${latestVersion + 1}`;
    const key = this.generateKey(config.algorithm);

    const newKey: TenantEncryptionKey = {
      keyId,
      tenantId,
      algorithm: config.algorithm,
      keyVersion: latestVersion + 1,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    this.keyStorage.set(keyId, key);
    currentKeys.push(newKey);
    this.tenantKeys.set(tenantId, currentKeys);

    return newKey;
  }

  /**
   * Get active encryption key for a tenant
   */
  public getActiveKey(tenantId: string): TenantEncryptionKey | null {
    const keys = this.tenantKeys.get(tenantId);
    if (!keys) {
      return null;
    }
    return keys.find((k) => k.isActive) ?? null;
  }

  /**
   * Get all keys for a tenant
   */
  public getTenantKeys(tenantId: string): readonly TenantEncryptionKey[] {
    return this.tenantKeys.get(tenantId) ?? [];
  }

  /**
   * Get encryption configuration for a tenant
   */
  public getConfig(tenantId: string): PerTenantEncryptionConfig | null {
    return this.tenantConfigs.get(tenantId) ?? null;
  }

  /**
   * Check if tenant has encryption initialized
   */
  public isInitialized(tenantId: string): boolean {
    return this.tenantKeys.has(tenantId);
  }

  /**
   * Remove tenant encryption (for deprovisioning)
   */
  public removeTenantKeys(tenantId: string): void {
    const keys = this.tenantKeys.get(tenantId) ?? [];
    for (const key of keys) {
      this.keyStorage.delete(key.keyId);
    }
    this.tenantKeys.delete(tenantId);
    this.tenantConfigs.delete(tenantId);
  }

  /**
   * Generate encryption key
   */
  private generateKey(algorithm: EncryptionAlgorithm): Buffer {
    const keyLength = algorithm === "aes-128-gcm" ? 16 : 32;
    return randomBytes(keyLength);
  }

  /**
   * Get IV length for algorithm
   */
  private getIvLength(algorithm: EncryptionAlgorithm): number {
    return algorithm === "aes-128-gcm" ? 12 : 16;
  }
}

/**
 * Derive a tenant-specific key from a master key
 */
export function deriveTenantKey(
  masterKey: Buffer,
  tenantId: string,
  algorithm: EncryptionAlgorithm,
): Buffer {
  const salt = createHash("sha256").update(tenantId).digest();
  const keyLength = algorithm === "aes-128-gcm" ? 16 : 32;
  return createHash("sha256").update(Buffer.concat([masterKey, salt])).digest().slice(0, keyLength);
}

/**
 * Singleton instance
 */
let GLOBAL_PER_TENANT_ENCRYPTION_SERVICE: PerTenantEncryptionService | null = null;

export function getPerTenantEncryptionService(): PerTenantEncryptionService {
  if (!GLOBAL_PER_TENANT_ENCRYPTION_SERVICE) {
    GLOBAL_PER_TENANT_ENCRYPTION_SERVICE = new PerTenantEncryptionService();
  }
  return GLOBAL_PER_TENANT_ENCRYPTION_SERVICE;
}

export function resetPerTenantEncryptionService(): void {
  GLOBAL_PER_TENANT_ENCRYPTION_SERVICE = null;
}
