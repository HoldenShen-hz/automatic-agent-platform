/**
 * @fileoverview Crypto-Shredding Service
 *
 * Implements GDPR-compliant "right to be forgotten" using the crypto-shredding pattern.
 * Instead of deleting data directly (which doesn't affect backups), we destroy the
 * DEK (Data Encryption Key) used to encrypt the subject's PII data.
 *
 * With crypto-shredding:
 * - All data encrypted with the destroyed DEK becomes permanently unrecoverable
 * - Backups containing the encrypted data are also effectively destroyed
 * - Audit trail records the destruction for compliance
 *
 * This is more robust than traditional deletion because:
 * 1. We don't need to find and delete every backup copy
 * 2. Data encrypted with the destroyed key is mathematically unrecoverable
 * 3. The destruction is instant (just delete the key)
 *
 * @see docs_zh/contracts/compliance_contract.md
 */
import type { DekMetadata } from "./dek-manager.js";
import { DekManager } from "./dek-manager.js";
/**
 * Result of a crypto-shredding operation.
 */
export interface ShredResult {
    /** Unique identifier for this shred operation */
    shredId: string;
    /** Subject whose data was shredded */
    subjectId: string;
    /** DEK that was destroyed */
    destroyedDekId: string | null;
    /** When the shred operation completed */
    shreddedAt: string;
    /** Status of the operation */
    status: "completed" | "no_dek_found";
    /** All DEKs associated with the subject (including rotated ones) */
    affectedDekCount: number;
}
/**
 * Audit record for a crypto-shredding operation.
 */
export interface ShredAuditRecord {
    shredId: string;
    subjectId: string;
    destroyedDekId: string | null;
    affectedDekCount: number;
    shreddedAt: string;
    previousDekIds: string[];
    requesterId: string;
}
/**
 * PII field specification for encryption.
 */
export interface PiiFieldSpec {
    /** JSON path to the field (e.g., "user.name" or "messages[0].content") */
    fieldPath: string;
    /** Classification of the PII */
    classification: "internal" | "confidential" | "restricted";
}
/**
 * Result of encrypting a record's PII fields.
 */
export interface EncryptRecordResult {
    /** The original record with PII fields encrypted */
    encryptedRecord: Record<string, unknown>;
    /** List of encryptions performed */
    encryptions: Array<{
        fieldPath: string;
        dekId: string;
        originalValue: string;
    }>;
}
/**
 * Audit trail interface for recording shred operations.
 */
export interface ShredAuditTrail {
    record(ShredAuditRecord: ShredAuditRecord): Promise<void>;
    getRecord(shredId: string): Promise<ShredAuditRecord | null>;
}
/**
 * In-memory audit trail implementation for development/testing.
 */
export declare class InMemoryShredAuditTrail implements ShredAuditTrail {
    private readonly records;
    record(record: ShredAuditRecord): Promise<void>;
    getRecord(shredId: string): Promise<ShredAuditRecord | null>;
}
/**
 * Crypto-Shredding Service
 *
 * Main service for performing crypto-shredding operations.
 * This implements the GDPR "right to be forgotten" pattern.
 */
export declare class CryptoShreddingService {
    private readonly dekManager;
    private readonly auditTrail;
    private readonly piiFields;
    constructor(options: {
        dekManager?: DekManager;
        auditTrail?: ShredAuditTrail;
        piiFields?: PiiFieldSpec[];
    });
    /**
     * Performs crypto-shredding for a subject.
     *
     * This operation:
     * 1. Destroys the subject's active DEK
     * 2. Records the operation in the audit trail
     * 3. Returns the shred result
     *
     * After this operation, ALL data encrypted with the subject's DEK
     * becomes permanently unrecoverable.
     */
    shred(subjectId: string, requesterId?: string): Promise<ShredResult>;
    /**
     * Gets the shred audit record for a specific operation.
     */
    getShredRecord(shredId: string): Promise<ShredAuditRecord | null>;
    /**
     * Gets the active DEK information for a subject.
     */
    getSubjectDekInfo(subjectId: string): Promise<{
        activeDek: DekMetadata | null;
        allDekCount: number;
    }>;
    /**
     * Encrypts PII fields in a record using the subject's DEK.
     *
     * @param subjectId - The subject whose DEK to use
     * @param record - The record containing PII fields
     * @returns The encrypted record and encryption details
     */
    encryptRecordForSubject(subjectId: string, record: Record<string, unknown>): Promise<EncryptRecordResult>;
    /**
     * Decrypts a PII field in a record using the specified DEK.
     *
     * @param dekId - The DEK ID to use for decryption
     * @param fieldPath - The path to the field
     * @param record - The record containing the encrypted field
     * @returns The decrypted value
     */
    decryptField(dekId: string, fieldPath: string, record: Record<string, unknown>): Promise<string>;
    /**
     * Rotates the DEK for a subject.
     *
     * The old DEK is marked as rotated but NOT destroyed.
     * Data encrypted with the old DEK can still be decrypted.
     * This is useful for periodic key rotation.
     */
    rotateSubjectKey(subjectId: string): Promise<{
        previousDekId: string | null;
        newDekId: string;
    }>;
    /**
     * Registers a PII field for encryption.
     */
    registerPiiField(fieldSpec: PiiFieldSpec): void;
    /**
     * Gets the registered PII fields.
     */
    getPiiFields(): readonly PiiFieldSpec[];
    /**
     * Reads a field from a record using dot notation path.
     */
    private readField;
    /**
     * Writes a field in a record using dot notation path.
     */
    private writeField;
}
