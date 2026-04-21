/**
 * Crypto-Shredding Module
 *
 * Implements GDPR-compliant "right to be forgotten" using the crypto-shredding pattern.
 * Instead of deleting data directly, we destroy the DEK (Data Encryption Key) used to
 * encrypt the subject's PII data, making all encrypted data permanently unrecoverable.
 */
export { type DekStatus, type DekMetadata, type CreateDekResult, type EncryptWithDekResult, DekStore, DekManager, } from "./dek-manager.js";
export { type ShredResult, type ShredAuditRecord, type PiiFieldSpec, type EncryptRecordResult, type ShredAuditTrail, InMemoryShredAuditTrail, CryptoShreddingService, } from "./crypto-shredding-service.js";
