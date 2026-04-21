/**
 * @fileoverview Data Encryption Key (DEK) Service - Per-tenant DEK management for crypto-shredding
 *
 * ## Overview
 *
 * Manages per-tenant data encryption keys for crypto-shredding based erasure.
 * Each tenant has one or more DEK versions, with only the latest being active.
 * When an erasure request is processed, DEKs are marked as destroyed,
 * making the tenant's data cryptographically inaccessible.
 *
 * ## Key Concepts
 *
 * - **DEK (Data Encryption Key)**: Per-tenant key used to encrypt tenant data
 * - **Crypto-shredding**: Destroying DEKs makes encrypted data unrecoverable
 * - **Key rotation**: New DEK versions are created while old ones are retained for audit
 * - **Key destruction**: DEKs are marked as destroyed, not physically deleted
 *
 * ## DEK Lifecycle
 *
 * 1. DEK created for tenant with encrypted key material
 * 2. DEK marked as active (one active per tenant)
 * 3. On rotation: new DEK becomes active, old DEK marked as rotated
 * 4. On erasure: DEK marked as destroyed, key material cleared
 *
 * @see docs_zh/architecture/00-platform-architecture.md
 *
 * @packageDocumentation
 */

import { newId, nowIso } from "../../../contracts/types/ids.js";
import { ValidationError, StorageError } from "../../../contracts/errors.js";
import type { AuthoritativeSqlDatabase } from "../../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";

/**
 * DEK status enum
 */
export type DekStatus = "active" | "rotating" | "destroyed";

/**
 * Data encryption key record stored in the database
 */
export interface DataEncryptionKey {
  /** Unique identifier for the DEK */
  keyId: string;
  /** Tenant identifier */
  tenantId: string;
  /** Version number (incremented on rotation) */
  version: number;
  /** Current status */
  status: DekStatus;
  /** Encrypted key material (cleared on destruction) */
  encryptedKeyMaterial: string | null;
  /** Algorithm used for encryption (e.g., "AES-256-GCM") */
  algorithm: string;
  /** Key identifier in external KMS (e.g., AWS KMS key ARN) */
  externalKeyId: string | null;
  /** ISO timestamp when key was created */
  createdAt: string;
  /** ISO timestamp when key was last updated */
  updatedAt: string;
  /** ISO timestamp when key was destroyed (null if active) */
  destroyedAt: string | null;
  /** User or system that created the key */
  createdBy: string;
  /** User or system that destroyed the key (null if active) */
  destroyedBy: string | null;
  /** Reason for destruction (e.g., "erasure_request", "key_rotation") */
  destructionReason: string | null;
  /** Trace ID for lineage tracking */
  traceId: string | null;
  /** Metadata JSON for additional context */
  metadataJson: string | null;
}

/**
 * Input for creating a new DEK
 */
export interface CreateDekInput {
  tenantId: string;
  encryptedKeyMaterial: string;
  algorithm?: string;
  externalKeyId?: string;
  createdBy: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for rotating a DEK
 */
export interface RotateDekInput {
  tenantId: string;
  newEncryptedKeyMaterial: string;
  newExternalKeyId?: string;
  rotatedBy: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for destroying a DEK
 */
export interface DestroyDekInput {
  keyId: string;
  destroyedBy: string;
  reason: string;
  traceId?: string;
}

/**
 * Summary of DEK status for a tenant
 */
export interface TenantDekSummary {
  tenantId: string;
  activeKey: DataEncryptionKey | null;
  totalVersions: number;
  destroyedKeys: number;
  oldestKeyAt: string | null;
  newestKeyAt: string | null;
}

/**
 * Validates a DEK input
 */
function validateCreateDekInput(input: CreateDekInput): void {
  if (!input.tenantId || input.tenantId.trim().length === 0) {
    throw new ValidationError("dek.invalid_tenant_id", "Tenant ID is required", {
      details: { tenantId: input.tenantId },
    });
  }
  if (!input.encryptedKeyMaterial || input.encryptedKeyMaterial.trim().length === 0) {
    throw new ValidationError("dek.invalid_key_material", "Encrypted key material is required", {
      details: { encryptedKeyMaterial: input.encryptedKeyMaterial },
    });
  }
  if (!input.createdBy || input.createdBy.trim().length === 0) {
    throw new ValidationError("dek.invalid_created_by", "Creator is required", {
      details: { createdBy: input.createdBy },
    });
  }
}

/**
 * Validates a rotation input
 */
function validateRotateDekInput(input: RotateDekInput): void {
  if (!input.tenantId || input.tenantId.trim().length === 0) {
    throw new ValidationError("dek.invalid_tenant_id", "Tenant ID is required", {
      details: { tenantId: input.tenantId },
    });
  }
  if (!input.newEncryptedKeyMaterial || input.newEncryptedKeyMaterial.trim().length === 0) {
    throw new ValidationError("dek.invalid_key_material", "New encrypted key material is required", {
      details: { newEncryptedKeyMaterial: input.newEncryptedKeyMaterial },
    });
  }
  if (!input.rotatedBy || input.rotatedBy.trim().length === 0) {
    throw new ValidationError("dek.invalid_rotated_by", "Rotator is required", {
      details: { rotatedBy: input.rotatedBy },
    });
  }
}

/**
 * Service for managing per-tenant data encryption keys (DEKs).
 *
 * Handles DEK creation, rotation, and destruction for crypto-shredding
 * based data erasure. Each tenant can have multiple DEK versions,
 * with only the latest being active.
 *
 * ## Usage
 *
 * ```typescript
 * const dekService = new DataEncryptionKeyService(db, store);
 *
 * // Create DEK for new tenant
 * const dek = dekService.createDek({
 *   tenantId: "tenant-123",
 *   encryptedKeyMaterial: "enc_key_data_here",
 *   algorithm: "AES-256-GCM",
 *   createdBy: "system",
 * });
 *
 * // Get active DEK
 * const active = dekService.getActiveDek("tenant-123");
 *
 * // Rotate DEK
 * const newDek = dekService.rotateDek({
 *   tenantId: "tenant-123",
 *   newEncryptedKeyMaterial: "new_enc_key_data",
 *   rotatedBy: "system",
 * });
 *
 * // Destroy DEK (crypto-shredding)
 * dekService.destroyDek({
 *   keyId: dek.keyId,
 *   destroyedBy: "erasure-service",
 *   reason: "erasure_request",
 * });
 * ```
 */
export class DataEncryptionKeyService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {}

  /**
   * Creates a new DEK for a tenant.
   *
   * If the tenant already has an active DEK, it will be marked as rotated.
   * Only one DEK per tenant can be active at a time.
   *
   * @param input - DEK creation details
   * @returns The created DEK
   */
  public createDek(input: CreateDekInput): DataEncryptionKey {
    validateCreateDekInput(input);

    return this.db.transaction(() => {
      const now = nowIso();
      const keyId = newId("dek");

      // Check if tenant already has an active DEK
      const existingActive = this.store.compliance.getActiveDataEncryptionKey(input.tenantId);

      // If there's an existing active DEK, mark it as rotated
      if (existingActive) {
        const rotated: DataEncryptionKey = {
          ...existingActive,
          status: "rotating",
          updatedAt: now,
        };
        this.store.compliance.updateDataEncryptionKey(rotated);
      }

      // Get the next version number
      const existingKeys = this.store.compliance.listDataEncryptionKeysByTenant(input.tenantId);
      const maxVersion = existingKeys.reduce((max, k) => Math.max(max, k.version), 0);

      const dek: DataEncryptionKey = {
        keyId,
        tenantId: input.tenantId,
        version: maxVersion + 1,
        status: "active",
        encryptedKeyMaterial: input.encryptedKeyMaterial,
        algorithm: input.algorithm ?? "AES-256-GCM",
        externalKeyId: input.externalKeyId ?? null,
        createdAt: now,
        updatedAt: now,
        destroyedAt: null,
        createdBy: input.createdBy,
        destroyedBy: null,
        destructionReason: null,
        traceId: input.traceId ?? null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      };

      this.store.compliance.insertDataEncryptionKey(dek);

      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: "dek:created",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({
          keyId,
          tenantId: input.tenantId,
          version: dek.version,
          traceId: input.traceId,
        }),
        traceId: input.traceId ?? null,
        createdAt: now,
      });

      return dek;
    });
  }

  /**
   * Rotates a tenant's DEK by creating a new version.
   *
   * The previous active DEK is marked as rotated and retained for audit.
   * The new DEK becomes the active DEK for the tenant.
   *
   * @param input - Rotation details
   * @returns The new (active) DEK
   */
  public rotateDek(input: RotateDekInput): DataEncryptionKey {
    validateRotateDekInput(input);

    return this.db.transaction(() => {
      const now = nowIso();

      // Get current active DEK
      const currentActive = this.store.compliance.getActiveDataEncryptionKey(input.tenantId);

      if (currentActive) {
        // Mark current as rotated
        const rotated: DataEncryptionKey = {
          ...currentActive,
          status: "rotating",
          updatedAt: now,
        };
        this.store.compliance.updateDataEncryptionKey(rotated);
      }

      // Create new DEK with next version
      const existingKeys = this.store.compliance.listDataEncryptionKeysByTenant(input.tenantId);
      const maxVersion = existingKeys.reduce((max, k) => Math.max(max, k.version), 0);

      const newDek: DataEncryptionKey = {
        keyId: newId("dek"),
        tenantId: input.tenantId,
        version: maxVersion + 1,
        status: "active",
        encryptedKeyMaterial: input.newEncryptedKeyMaterial,
        algorithm: "AES-256-GCM",
        externalKeyId: input.newExternalKeyId ?? null,
        createdAt: now,
        updatedAt: now,
        destroyedAt: null,
        createdBy: input.rotatedBy,
        destroyedBy: null,
        destructionReason: null,
        traceId: input.traceId ?? null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      };

      this.store.compliance.insertDataEncryptionKey(newDek);

      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: "dek:rotated",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({
          previousKeyId: currentActive?.keyId,
          newKeyId: newDek.keyId,
          tenantId: input.tenantId,
          traceId: input.traceId,
        }),
        traceId: input.traceId ?? null,
        createdAt: now,
      });

      return newDek;
    });
  }

  /**
   * Destroys a DEK (crypto-shredding).
   *
   * Marks the DEK as destroyed and clears the encrypted key material.
   * This makes any data encrypted with this key cryptographically inaccessible.
   *
   * @param input - Destruction details
   * @returns The destroyed DEK
   * @throws StorageError if DEK not found
   */
  public destroyDek(input: DestroyDekInput): DataEncryptionKey {
    return this.db.transaction(() => {
      const now = nowIso();

      const existing = this.store.compliance.getDataEncryptionKey(input.keyId);

      if (!existing) {
        throw new StorageError(`dek.not_found:${input.keyId}`, `DEK not found: ${input.keyId}`, {
          details: { keyId: input.keyId },
        });
      }

      if (existing.status === "destroyed") {
        // Already destroyed - return as-is
        return existing;
      }

      const destroyed: DataEncryptionKey = {
        ...existing,
        status: "destroyed",
        encryptedKeyMaterial: null, // Clear the key material
        updatedAt: now,
        destroyedAt: now,
        destroyedBy: input.destroyedBy,
        destructionReason: input.reason,
        traceId: input.traceId ?? existing.traceId,
      };

      this.store.compliance.updateDataEncryptionKey(destroyed);

      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: "dek:destroyed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({
          keyId: input.keyId,
          tenantId: existing.tenantId,
          version: existing.version,
          reason: input.reason,
          traceId: input.traceId ?? existing.traceId,
        }),
        traceId: input.traceId ?? existing.traceId,
        createdAt: now,
      });

      return destroyed;
    });
  }

  /**
   * Destroys all DEKs for a tenant (complete crypto-shredding).
   *
   * Used when an entire tenant is being erased.
   *
   * @param tenantId - The tenant identifier
   * @param destroyedBy - User or system performing destruction
   * @param reason - Reason for destruction
   * @param traceId - Trace ID for lineage tracking
   * @returns Array of destroyed DEKs
   */
  public destroyAllTenantDeks(
    tenantId: string,
    destroyedBy: string,
    reason: string,
    traceId?: string,
  ): DataEncryptionKey[] {
    return this.db.transaction(() => {
      const keys = this.store.compliance.listDataEncryptionKeysByTenant(tenantId);
      const destroyed: DataEncryptionKey[] = [];

      for (const key of keys) {
        if (key.status !== "destroyed") {
          const result = this.destroyDek({
            keyId: key.keyId,
            destroyedBy,
            reason,
            traceId,
          });
          destroyed.push(result);
        }
      }

      return destroyed;
    });
  }

  /**
   * Gets the active DEK for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @returns The active DEK or null if none exists
   */
  public getActiveDek(tenantId: string): DataEncryptionKey | null {
    return this.store.compliance.getActiveDataEncryptionKey(tenantId);
  }

  /**
   * Requires an active DEK, throwing if none exists.
   *
   * @param tenantId - The tenant identifier
   * @returns The active DEK
   * @throws StorageError if no active DEK found
   */
  public requireActiveDek(tenantId: string): DataEncryptionKey {
    const dek = this.store.compliance.getActiveDataEncryptionKey(tenantId);
    if (!dek) {
      throw new StorageError(`dek.no_active_dek:${tenantId}`, `No active DEK for tenant: ${tenantId}`, {
        details: { tenantId },
      });
    }
    return dek;
  }

  /**
   * Gets a DEK by ID.
   *
   * @param keyId - The DEK identifier
   * @returns The DEK or null if not found
   */
  public getDek(keyId: string): DataEncryptionKey | null {
    return this.store.compliance.getDataEncryptionKey(keyId);
  }

  /**
   * Lists all DEK versions for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @returns Array of DEKs sorted by version (newest first)
   */
  public listDekVersions(tenantId: string): DataEncryptionKey[] {
    return this.store.compliance.listDataEncryptionKeysByTenant(tenantId).sort((a, b) => b.version - a.version);
  }

  /**
   * Gets a summary of DEK status for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @returns Summary of DEK status
   */
  public getTenantDekSummary(tenantId: string): TenantDekSummary {
    const keys = this.store.compliance.listDataEncryptionKeysByTenant(tenantId);
    const active = keys.find((k) => k.status === "active") ?? null;
    const destroyedKeys = keys.filter((k) => k.status === "destroyed");

    if (keys.length === 0) {
      return {
        tenantId,
        activeKey: null,
        totalVersions: 0,
        destroyedKeys: 0,
        oldestKeyAt: null,
        newestKeyAt: null,
      };
    }

    const sortedKeys = [...keys].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

    return {
      tenantId,
      activeKey: active,
      totalVersions: keys.length,
      destroyedKeys: destroyedKeys.length,
      oldestKeyAt: sortedKeys[0].createdAt,
      newestKeyAt: sortedKeys[sortedKeys.length - 1].createdAt,
    };
  }

  /**
   * Lists all destroyed DEKs for a tenant (for audit).
   *
   * @param tenantId - The tenant identifier
   * @returns Array of destroyed DEKs
   */
  public listDestroyedDeks(tenantId: string): DataEncryptionKey[] {
    return this.store.compliance
      .listDataEncryptionKeysByTenant(tenantId)
      .filter((k) => k.status === "destroyed")
      .sort((a, b) => (b.destroyedAt ? Date.parse(b.destroyedAt) : 0) - (a.destroyedAt ? Date.parse(a.destroyedAt) : 0));
  }
}
