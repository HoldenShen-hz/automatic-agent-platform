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
import { AppError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { DekManager } from "./dek-manager.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
/**
 * In-memory audit trail implementation for development/testing.
 */
export class InMemoryShredAuditTrail {
    records = new Map();
    async record(record) {
        this.records.set(record.shredId, record);
        logger.log({
            level: "info",
            message: "Shred audit record created",
            data: { shredId: record.shredId, subjectId: record.subjectId },
        });
    }
    async getRecord(shredId) {
        return this.records.get(shredId) ?? null;
    }
}
/**
 * Crypto-Shredding Service
 *
 * Main service for performing crypto-shredding operations.
 * This implements the GDPR "right to be forgotten" pattern.
 */
export class CryptoShreddingService {
    dekManager;
    auditTrail;
    piiFields;
    constructor(options) {
        this.dekManager = options.dekManager ?? new DekManager();
        this.auditTrail = options.auditTrail ?? new InMemoryShredAuditTrail();
        this.piiFields = options.piiFields ?? [];
    }
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
    async shred(subjectId, requesterId = "system") {
        if (!subjectId || subjectId.trim().length === 0) {
            throw new AppError("shred.missing_subject", "Subject ID is required", {
                statusCode: 400,
                category: "validation",
                source: "internal",
            });
        }
        const shredId = newId("shred");
        const shreddedAt = nowIso();
        // Get all DEKs for the subject before destroying
        const allDekRecords = await this.dekManager.getStore().getAllForSubject(subjectId);
        const previousDekIds = allDekRecords.map((d) => d.dekId);
        // Perform the crypto-shredding operation across all DEKs for the subject.
        let destroyedDekId = null;
        for (const dek of allDekRecords) {
            if (destroyedDekId === null && dek.status === "active") {
                destroyedDekId = dek.dekId;
            }
            await this.dekManager.getStore().destroy(dek.dekId);
        }
        // Create audit record
        const auditRecord = {
            shredId,
            subjectId,
            destroyedDekId,
            affectedDekCount: previousDekIds.length,
            shreddedAt,
            previousDekIds,
            requesterId,
        };
        await this.auditTrail.record(auditRecord);
        logger.log({
            level: "info",
            message: "Crypto-shredding completed",
            data: {
                shredId,
                subjectId,
                destroyedDekId,
                affectedDekCount: previousDekIds.length,
            },
        });
        return {
            shredId,
            subjectId,
            destroyedDekId,
            shreddedAt,
            status: destroyedDekId ? "completed" : "no_dek_found",
            affectedDekCount: previousDekIds.length,
        };
    }
    /**
     * Gets the shred audit record for a specific operation.
     */
    async getShredRecord(shredId) {
        return this.auditTrail.getRecord(shredId);
    }
    /**
     * Gets the active DEK information for a subject.
     */
    async getSubjectDekInfo(subjectId) {
        const activeDek = await this.dekManager.getActiveDek(subjectId);
        const allDekRecords = await this.dekManager.getStore().getAllForSubject(subjectId);
        return {
            activeDek,
            allDekCount: allDekRecords.length,
        };
    }
    /**
     * Encrypts PII fields in a record using the subject's DEK.
     *
     * @param subjectId - The subject whose DEK to use
     * @param record - The record containing PII fields
     * @returns The encrypted record and encryption details
     */
    async encryptRecordForSubject(subjectId, record) {
        const encryptions = [];
        const encryptedRecord = structuredClone(record);
        for (const fieldSpec of this.piiFields) {
            const value = this.readField(encryptedRecord, fieldSpec.fieldPath);
            if (typeof value !== "string" || value.length === 0) {
                continue;
            }
            const result = await this.dekManager.encryptForSubject(subjectId, value);
            this.writeField(encryptedRecord, fieldSpec.fieldPath, result.ciphertext);
            encryptions.push({
                fieldPath: fieldSpec.fieldPath,
                dekId: result.dekId,
                originalValue: value,
            });
        }
        return { encryptedRecord, encryptions };
    }
    /**
     * Decrypts a PII field in a record using the specified DEK.
     *
     * @param dekId - The DEK ID to use for decryption
     * @param fieldPath - The path to the field
     * @param record - The record containing the encrypted field
     * @returns The decrypted value
     */
    async decryptField(dekId, fieldPath, record) {
        const encryptedValue = this.readField(record, fieldPath);
        if (typeof encryptedValue !== "string") {
            throw new AppError("decrypt.invalid_value", "Encrypted field value must be a string", {
                statusCode: 400,
                category: "validation",
                source: "internal",
            });
        }
        return this.dekManager.decrypt(dekId, encryptedValue);
    }
    /**
     * Rotates the DEK for a subject.
     *
     * The old DEK is marked as rotated but NOT destroyed.
     * Data encrypted with the old DEK can still be decrypted.
     * This is useful for periodic key rotation.
     */
    async rotateSubjectKey(subjectId) {
        const previousDek = await this.dekManager.getActiveDek(subjectId);
        const newDek = await this.dekManager.rotate(subjectId);
        logger.log({
            level: "info",
            message: "Subject DEK rotated",
            data: {
                subjectId,
                previousDekId: previousDek?.dekId ?? null,
                newDekId: newDek.metadata.dekId,
            },
        });
        return {
            previousDekId: previousDek?.dekId ?? null,
            newDekId: newDek.metadata.dekId,
        };
    }
    /**
     * Registers a PII field for encryption.
     */
    registerPiiField(fieldSpec) {
        const existing = this.piiFields.findIndex((f) => f.fieldPath === fieldSpec.fieldPath);
        if (existing >= 0) {
            this.piiFields[existing] = fieldSpec;
        }
        else {
            this.piiFields.push(fieldSpec);
        }
    }
    /**
     * Gets the registered PII fields.
     */
    getPiiFields() {
        return this.piiFields;
    }
    /**
     * Reads a field from a record using dot notation path.
     */
    readField(record, path) {
        return path.split(".").reduce((cursor, segment) => {
            if (cursor == null || typeof cursor !== "object") {
                return undefined;
            }
            // Handle array access like "items[0]"
            const arrayMatch = segment.match(/^([^\[]+)\[(\d+)\]$/);
            if (arrayMatch) {
                const key = arrayMatch[1];
                const index = arrayMatch[2];
                const obj = cursor[key];
                if (Array.isArray(obj)) {
                    return obj[parseInt(index, 10)];
                }
                return undefined;
            }
            return cursor[segment];
        }, record);
    }
    /**
     * Writes a field in a record using dot notation path.
     */
    writeField(record, path, value) {
        const segments = path.split(".");
        let cursor = record;
        for (let i = 0; i < segments.length - 1; i++) {
            const segment = segments[i];
            // Handle array access like "items[0]"
            const arrayMatch = segment.match(/^([^\[]+)\[(\d+)\]$/);
            if (arrayMatch) {
                const key = arrayMatch[1];
                const index = arrayMatch[2];
                const nextSegment = segments[i + 1];
                const nextIsArray = /^\d+$/.test(nextSegment) || nextSegment.includes("[");
                let arr = cursor[key];
                if (!Array.isArray(arr)) {
                    arr = [];
                    cursor[key] = arr;
                }
                if (nextIsArray) {
                    // Need to drill deeper into array
                    const arrIndex = parseInt(nextSegment.match(/^(\d+)/)?.[1] ?? "0", 10);
                    while (arr.length <= arrIndex) {
                        arr.push({});
                    }
                    cursor = arr[arrIndex];
                }
                else {
                    if (arr[parseInt(index, 10)] == null) {
                        arr[parseInt(index, 10)] = {};
                    }
                    cursor = arr[parseInt(index, 10)];
                }
            }
            else {
                if (cursor[segment] == null) {
                    cursor[segment] = {};
                }
                cursor = cursor[segment];
            }
        }
        const lastSegment = segments.at(-1);
        // Handle array access in last segment
        const lastArrayMatch = lastSegment.match(/^([^\[]+)\[(\d+)\]$/);
        if (lastArrayMatch) {
            const key = lastArrayMatch[1];
            const index = lastArrayMatch[2];
            const arr = cursor[key] ?? [];
            while (arr.length <= parseInt(index, 10)) {
                arr.push(null);
            }
            arr[parseInt(index, 10)] = value;
            cursor[key] = arr;
        }
        else {
            cursor[lastSegment] = value;
        }
    }
}
//# sourceMappingURL=crypto-shredding-service.js.map