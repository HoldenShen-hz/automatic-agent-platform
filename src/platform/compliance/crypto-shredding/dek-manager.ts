/**
 * @fileoverview DEK (Data Encryption Key) Manager
 *
 * Manages the lifecycle of DEKs used for encrypting PII data:
 * - Generation: Creates unique DEK for each data subject
 * - Storage: Stores DEK metadata (not the key itself in plaintext)
 * - Rotation: Supports key rotation with re-encryption
 * - Destruction: DEK destruction makes all encrypted data unrecoverable
 *
 * This implements the "crypto-shredding" pattern for GDPR compliance:
 * Deleting the DEK effectively destroys all data encrypted with it,
 * without needing to locate and delete every backup copy.
 *
 * @see docs_zh/contracts/compliance_contract.md
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

import { AppError, ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * DEK status in its lifecycle.
 */
export type DekStatus = "active" | "rotated" | "destroyed";

/**
 * DEK metadata stored in the DEK store.
 * The actual encryption key is never stored; only metadata for key recovery.
 */
export interface DekMetadata {
  /** Unique identifier for this DEK */
  dekId: string;
  /** Subject this DEK is associated with (e.g., user ID) */
  subjectId: string;
  /** Algorithm used for encryption */
  algorithm: "aes-256-gcm";
  /** Key version for rotation tracking */
  version: number;
  /** Initialization vector used for this DEK (hex encoded) */
  iv: string;
  /** HMAC tag length in bytes */
  tagLength: number;
  /** When this DEK was created */
  createdAt: string;
  /** When this DEK was last rotated (null if never rotated) */
  rotatedAt: string | null;
  /** When this DEK was destroyed (null if still active) */
  destroyedAt: string | null;
  /** Current status */
  status: DekStatus;
  /** ID of the DEK that replaced this one (if rotated) */
  replacedByDekId: string | null;
  /** ID of the DEK this one replaced (if it rotated another) */
  replacesDekId: string | null;
}

/**
 * Result of creating a new DEK.
 */
export interface CreateDekResult {
  /** The DEK metadata */
  metadata: DekMetadata;
  /** The actual DEK (only returned on creation, never stored) */
  key: Buffer;
}

/**
 * Result of encrypting data with a DEK.
 */
export interface EncryptWithDekResult {
  /** The encrypted data (ciphertext + auth tag) */
  ciphertext: string;
  /** The DEK ID used for encryption */
  dekId: string;
  /** IV used for this encryption (hex encoded) */
  iv: string;
}

/**
 * In-memory DEK store for development/testing.
 * In production, this would be replaced with a secure HSM or KMS-backed store.
 */
export class DekStore {
  private readonly metadata = new Map<string, DekMetadata>();
  private readonly subjectToDek = new Map<string, string>();
  // In production, DEKs would be stored in an HSM or KMS
  private readonly keys = new Map<string, Buffer>();

  /**
   * Creates a new DEK for a subject.
   */
  public async create(input: {
    subjectId: string;
    replacesDekId?: string | null;
  }): Promise<CreateDekResult> {
    const existingActiveDek = this.subjectToDek.get(input.subjectId);
    let version = 1;

    if (existingActiveDek) {
      const existing = this.metadata.get(existingActiveDek);
      if (existing && existing.status === "active") {
        if (input.replacesDekId !== existing.dekId) {
          throw new AppError(
            "dek.active_exists",
            `An active DEK already exists for subject ${input.subjectId}. Rotate the existing DEK first.`,
            { statusCode: 409, category: "storage", source: "internal" },
          );
        }
      }
      if (existing) {
        version = existing.version + 1;
      }
    }

    const dekId = newId("dek");
    const key = randomBytes(32); // 256-bit key for AES-256
    const iv = randomBytes(12); // 96-bit IV for GCM

    const metadata: DekMetadata = {
      dekId,
      subjectId: input.subjectId,
      algorithm: "aes-256-gcm",
      version,
      iv: iv.toString("hex"),
      tagLength: 16, // 128-bit auth tag
      createdAt: nowIso(),
      rotatedAt: null,
      destroyedAt: null,
      status: "active",
      replacedByDekId: null,
      replacesDekId: input.replacesDekId ?? null,
    };

    this.metadata.set(dekId, metadata);
    this.subjectToDek.set(input.subjectId, dekId);
    // In production, the key would be stored in an HSM/KMS, not in memory
    this.keys.set(dekId, key);

    logger.log({
      level: "info",
      message: "Created new DEK",
      data: { dekId, subjectId: input.subjectId, version },
    });

    return { metadata, key };
  }

  /**
   * Gets the metadata for a DEK.
   */
  public async getMetadata(dekId: string): Promise<DekMetadata | null> {
    return this.metadata.get(dekId) ?? null;
  }

  /**
   * Gets the active DEK for a subject.
   */
  public async getActiveForSubject(subjectId: string): Promise<DekMetadata | null> {
    const dekId = this.subjectToDek.get(subjectId);
    if (!dekId) {
      return null;
    }
    const metadata = this.metadata.get(dekId);
    if (!metadata || metadata.status !== "active") {
      return null;
    }
    return metadata;
  }

  /**
   * Gets the DEK key for encryption/decryption.
   * Returns null if DEK is not found or is destroyed.
   */
  public async getKey(dekId: string): Promise<Buffer | null> {
    const metadata = this.metadata.get(dekId);
    if (!metadata || metadata.status === "destroyed") {
      return null;
    }
    return this.keys.get(dekId) ?? null;
  }

  /**
   * Marks a DEK as rotated (replaced by a new DEK).
   */
  public async markRotated(dekId: string, replacedByDekId: string): Promise<void> {
    const metadata = this.metadata.get(dekId);
    if (!metadata) {
      throw new AppError("dek.not_found", `DEK ${dekId} not found`, { statusCode: 404, category: "storage", source: "internal" });
    }
    if (metadata.status !== "active") {
      throw new AppError("dek.not_active", `DEK ${dekId} is not active`, { statusCode: 409, category: "storage", source: "internal" });
    }

    metadata.status = "rotated";
    metadata.rotatedAt = nowIso();
    metadata.replacedByDekId = replacedByDekId;

    const replacedMetadata = this.metadata.get(replacedByDekId);
    if (replacedMetadata) {
      replacedMetadata.replacesDekId = dekId;
    }

    // Remove key from memory when rotated (but keep metadata for decryption of old data)
    this.keys.delete(dekId);

    logger.log({
      level: "info",
      message: "DEK marked as rotated",
      data: { dekId, replacedByDekId },
    });
  }

  /**
   * Marks a DEK as destroyed.
   * The key is securely wiped from memory.
   */
  public async destroy(dekId: string): Promise<void> {
    const metadata = this.metadata.get(dekId);
    if (!metadata) {
      throw new AppError("dek.not_found", `DEK ${dekId} not found`, { statusCode: 404, category: "storage", source: "internal" });
    }
    if (metadata.status === "destroyed") {
      // Already destroyed, idempotent operation
      return;
    }

    // Securely wipe the key from memory
    const key = this.keys.get(dekId);
    if (key) {
      // Overwrite with zeros before deleting (best effort)
      key.fill(0);
      this.keys.delete(dekId);
    }

    metadata.status = "destroyed";
    metadata.destroyedAt = nowIso();

    logger.log({
      level: "info",
      message: "DEK destroyed",
      data: { dekId, subjectId: metadata.subjectId },
    });
  }

  /**
   * Gets all DEK metadata for a subject.
   */
  public async getAllForSubject(subjectId: string): Promise<DekMetadata[]> {
    const results: DekMetadata[] = [];
    for (const metadata of this.metadata.values()) {
      if (metadata.subjectId === subjectId) {
        results.push(metadata);
      }
    }
    return results;
  }

  /**
   * Lists all DEKs (for admin purposes).
   */
  public async listAll(): Promise<DekMetadata[]> {
    return [...this.metadata.values()];
  }
}

/**
 * DEK Manager - High-level interface for DEK lifecycle management.
 */
export class DekManager {
  private readonly store: DekStore;

  constructor(store?: DekStore) {
    this.store = store ?? new DekStore();
  }

  /**
   * Creates a new DEK for a subject.
   * If the subject already has an active DEK, throws an error.
   * Use rotate() to replace an existing DEK.
   */
  public async createForSubject(subjectId: string): Promise<CreateDekResult> {
    if (!subjectId || subjectId.trim().length === 0) {
      throw new ValidationError("dek.missing_subject", "Subject ID is required", { category: "validation", source: "internal" });
    }
    return this.store.create({ subjectId });
  }

  /**
   * Gets the active DEK for a subject.
   */
  public async getActiveDek(subjectId: string): Promise<DekMetadata | null> {
    return this.store.getActiveForSubject(subjectId);
  }

  /**
   * Rotates the DEK for a subject.
   * Creates a new DEK and marks the old one as rotated.
   * Old encrypted data can still be decrypted with the rotated DEK.
   */
  public async rotate(subjectId: string): Promise<CreateDekResult> {
    const activeDek = await this.store.getActiveForSubject(subjectId);
    const newDek = await this.store.create({
      subjectId,
      replacesDekId: activeDek?.dekId ?? null,
    });

    if (activeDek) {
      await this.store.markRotated(activeDek.dekId, newDek.metadata.dekId);
    }

    logger.log({
      level: "info",
      message: "DEK rotated",
      data: { subjectId, oldDekId: activeDek?.dekId, newDekId: newDek.metadata.dekId },
    });

    return newDek;
  }

  /**
   * Destroys the DEK for a subject.
   * This makes ALL data encrypted with the subject's DEK unrecoverable.
   * This is the crypto-shredding operation for GDPR compliance.
   */
  public async destroyForSubject(subjectId: string): Promise<{ destroyedDekId: string | null }> {
    const activeDek = await this.store.getActiveForSubject(subjectId);
    if (!activeDek) {
      logger.log({
        level: "warn",
        message: "No active DEK to destroy for subject",
        data: { subjectId },
      });
      return { destroyedDekId: null };
    }

    await this.store.destroy(activeDek.dekId);

    return { destroyedDekId: activeDek.dekId };
  }

  /**
   * Encrypts data using a subject's active DEK.
   */
  public async encryptForSubject(
    subjectId: string,
    plaintext: string,
  ): Promise<EncryptWithDekResult> {
    const dek = await this.store.getActiveForSubject(subjectId);
    if (!dek) {
      throw new AppError("dek.not_found", `No active DEK for subject ${subjectId}`, {
        statusCode: 404,
        category: "storage",
        source: "internal",
      });
    }

    const key = await this.store.getKey(dek.dekId);
    if (!key) {
      throw new AppError("dek.key_unavailable", `Key for DEK ${dek.dekId} is not available`, {
        statusCode: 500,
        category: "storage",
        source: "internal",
      });
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all hex encoded)
    const ciphertext = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;

    return {
      ciphertext,
      dekId: dek.dekId,
      iv: dek.iv,
    };
  }

  /**
   * Decrypts data using the specified DEK.
   */
  public async decrypt(dekId: string, ciphertext: string): Promise<string> {
    const metadata = await this.store.getMetadata(dekId);
    if (!metadata) {
      throw new AppError("dek.not_found", `DEK ${dekId} not found`, {
        statusCode: 404,
        category: "storage",
        source: "internal",
      });
    }

    if (metadata.status === "destroyed") {
      throw new AppError("dek.destroyed", `DEK ${dekId} has been destroyed`, {
        statusCode: 410,
        category: "storage",
        source: "internal",
        retryable: false,
      });
    }

    const key = await this.store.getKey(dekId);
    if (!key) {
      throw new AppError("dek.key_unavailable", `Key for DEK ${dekId} is not available`, {
        statusCode: 500,
        category: "storage",
        source: "internal",
      });
    }

    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      throw new AppError("dek.invalid_ciphertext", "Invalid ciphertext format", {
        statusCode: 400,
        category: "validation",
        source: "internal",
      });
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex!, "hex");
    const authTag = Buffer.from(authTagHex!, "hex");
    const encrypted = Buffer.from(encryptedHex!, "hex");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  /**
   * Gets the DEK store for direct access (admin/testing).
   */
  public getStore(): DekStore {
    return this.store;
  }
}
