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
export declare class DekStore {
    private readonly metadata;
    private readonly subjectToDek;
    private readonly keys;
    /**
     * Creates a new DEK for a subject.
     */
    create(input: {
        subjectId: string;
        replacesDekId?: string | null;
    }): Promise<CreateDekResult>;
    /**
     * Gets the metadata for a DEK.
     */
    getMetadata(dekId: string): Promise<DekMetadata | null>;
    /**
     * Gets the active DEK for a subject.
     */
    getActiveForSubject(subjectId: string): Promise<DekMetadata | null>;
    /**
     * Gets the DEK key for encryption/decryption.
     * Returns null if DEK is not found or is destroyed.
     */
    getKey(dekId: string): Promise<Buffer | null>;
    /**
     * Marks a DEK as rotated (replaced by a new DEK).
     */
    markRotated(dekId: string, replacedByDekId: string): Promise<void>;
    /**
     * Marks a DEK as destroyed.
     * The key is securely wiped from memory.
     */
    destroy(dekId: string): Promise<void>;
    /**
     * Gets all DEK metadata for a subject.
     */
    getAllForSubject(subjectId: string): Promise<DekMetadata[]>;
    /**
     * Lists all DEKs (for admin purposes).
     */
    listAll(): Promise<DekMetadata[]>;
}
/**
 * DEK Manager - High-level interface for DEK lifecycle management.
 */
export declare class DekManager {
    private readonly store;
    constructor(store?: DekStore);
    /**
     * Creates a new DEK for a subject.
     * If the subject already has an active DEK, throws an error.
     * Use rotate() to replace an existing DEK.
     */
    createForSubject(subjectId: string): Promise<CreateDekResult>;
    /**
     * Gets the active DEK for a subject.
     */
    getActiveDek(subjectId: string): Promise<DekMetadata | null>;
    /**
     * Rotates the DEK for a subject.
     * Creates a new DEK and marks the old one as rotated.
     * Old encrypted data can still be decrypted with the rotated DEK.
     */
    rotate(subjectId: string): Promise<CreateDekResult>;
    /**
     * Destroys the DEK for a subject.
     * This makes ALL data encrypted with the subject's DEK unrecoverable.
     * This is the crypto-shredding operation for GDPR compliance.
     */
    destroyForSubject(subjectId: string): Promise<{
        destroyedDekId: string | null;
    }>;
    /**
     * Encrypts data using a subject's active DEK.
     */
    encryptForSubject(subjectId: string, plaintext: string): Promise<EncryptWithDekResult>;
    /**
     * Decrypts data using the specified DEK.
     */
    decrypt(dekId: string, ciphertext: string): Promise<string>;
    /**
     * Gets the DEK store for direct access (admin/testing).
     */
    getStore(): DekStore;
}
