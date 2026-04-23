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
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ComplianceStore } from "./types.js";
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
export declare class DataEncryptionKeyService {
    private readonly db;
    private readonly store;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore & {
        compliance: ComplianceStore;
    });
    /**
     * Creates a new DEK for a tenant.
     *
     * If the tenant already has an active DEK, it will be marked as rotated.
     * Only one DEK per tenant can be active at a time.
     *
     * @param input - DEK creation details
     * @returns The created DEK
     */
    createDek(input: CreateDekInput): DataEncryptionKey;
    /**
     * Rotates a tenant's DEK by creating a new version.
     *
     * The previous active DEK is marked as rotated and retained for audit.
     * The new DEK becomes the active DEK for the tenant.
     *
     * @param input - Rotation details
     * @returns The new (active) DEK
     */
    rotateDek(input: RotateDekInput): DataEncryptionKey;
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
    destroyDek(input: DestroyDekInput): DataEncryptionKey;
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
    destroyAllTenantDeks(tenantId: string, destroyedBy: string, reason: string, traceId?: string): DataEncryptionKey[];
    /**
     * Gets the active DEK for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @returns The active DEK or null if none exists
     */
    getActiveDek(tenantId: string): DataEncryptionKey | null;
    /**
     * Requires an active DEK, throwing if none exists.
     *
     * @param tenantId - The tenant identifier
     * @returns The active DEK
     * @throws StorageError if no active DEK found
     */
    requireActiveDek(tenantId: string): DataEncryptionKey;
    /**
     * Gets a DEK by ID.
     *
     * @param keyId - The DEK identifier
     * @returns The DEK or null if not found
     */
    getDek(keyId: string): DataEncryptionKey | null;
    /**
     * Lists all DEK versions for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @returns Array of DEKs sorted by version (newest first)
     */
    listDekVersions(tenantId: string): DataEncryptionKey[];
    /**
     * Gets a summary of DEK status for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @returns Summary of DEK status
     */
    getTenantDekSummary(tenantId: string): TenantDekSummary;
    /**
     * Lists all destroyed DEKs for a tenant (for audit).
     *
     * @param tenantId - The tenant identifier
     * @returns Array of destroyed DEKs
     */
    listDestroyedDeks(tenantId: string): DataEncryptionKey[];
}
